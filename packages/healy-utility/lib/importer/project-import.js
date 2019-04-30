'use strict';

const PLAYER_IN_ROSTER_REGEX = /^[\d]+\.roster\.[\d]+/;
const PLAYER_IN_GROUP_REGEX = /^[\d]+\.players\.[\d]+/;
const MATCH_IN_GROUP_REGEX = /^[\d]+\.matches\.[\d]+/;
const COLUMN_NAME_REGEX = /\w+$/;
const META_COLUMN_NAME_REGEX = /\w*_meta/;

// Packages
const app = require('express')();
const cacache = require('cacache');
const clone = require('clone');
const equal = require('fast-deep-equal');
const EventEmitter2 = require('eventemitter2').EventEmitter2;
const multer = require('multer');
const objectPath = require('object-path');
const parseGoogleSheetsKey = require('google-spreadsheets-key-parser');

// Ours
const cachePath = require('../cache/cache-path');
const importerOptions = require('../util/options').get();
const ingestGoogleSheet = require('./import-from-gdrive');
const ingestZip = require('./import-from-zip');
const nodecg = require('../util/nodecg-api-context').get();
const queue = require('../util/queue');
const replicants = require('../util/replicants');
const reprocessImages = require('./reprocess-images');

let googlePollInterval;
const log = new nodecg.Logger('healy');
const emitter = new EventEmitter2({wildcard: true});
const upload = multer({
	storage: multer.diskStorage({}),
	fileSize: 1000000 * 1024 // 1024 MB
});
module.exports = emitter;

app.post(`/${nodecg.bundleName}/import_project`,
	// First, check if the user is authorized.
	nodecg.util.authCheck,

	// Then, receive the uploaded file.
	upload.single('file'),

	// Finally, process the file and send a response.
	(req, res) => {
		if (!req.file) {
			res.status(400).send('Bad Request');
			log.warn('Bad zip upload request; no file data was found. Ignoring.');
			return;
		}

		// TODO: This isn't sufficient for stopping a request-in-flight.
		// Stop polling Google Drive for new data when a zip import begins.
		clearInterval(googlePollInterval);

		queue.add(() => {
			log.info('Starting zip ingest...');
			clearInterval(googlePollInterval);
			return ingestZip({
				zipPath: req.file.path,
				lastModified: req.body.lastModified,
				originalName: req.file.originalname
			});
		}).then(project => {
			clearInterval(googlePollInterval);
			handleProjectImport(project);
			log.info('Zip successfully ingested.');
			res.status(200).send('Success');
		}).catch(error => {
			console.error(error.stack);
			res.status(500).send('Internal Server Error');
			log.warn('Error importing zip %s:\n', req.file.originalname, (error && error.stack) ? error.stack : error);
		});
	}
);

nodecg.mount(app);

if (replicants.metadata.value.id && replicants.metadata.value.source === 'googleDrive') {
	log.info('Restoring previous Google Drive project "%s"', replicants.metadata.value.title);
	doUpdateGoogleSheet();
}

nodecg.listenFor('importer:immediatelyPollGoogleSheet', () => {
	if (replicants.metadata.value.updating) {
		log.warn('Manual update requested, but an update was already in-progress. Ignoring.');
		return;
	}

	log.info('Manual update of Google Sheet requested.');
	doUpdateGoogleSheet({force: true});
});

nodecg.listenFor('importer:loadGoogleSheet', (url, cb) => {
	const key = parseGoogleSheetsKey(url).key;
	if (!key) {
		const message = `Invalid URL "${url}", does not contain a Google Sheets key`;
		log.error(message);
		return cb(message);
	}

	replicants.metadata.value.lastPollTime = Date.now();
	replicants.metadata.value.updating = false;
	queue.add(() => ingestGoogleSheet(key)).then(project => {
		if (project) {
			handleProjectImport(project);
		}

		googlePollInterval = setInterval(doUpdateGoogleSheet, 60000);
		cb(null, {title: replicants.metadata.value.title});
	}).catch(err => {
		let message = err.message;
		if (err.code === 404) {
			message = `Spreadsheet not found at url "${url}"`;
			log.error(message);
		} else {
			log.error('Error loading spreadsheet:\n', (err && err.stack) ? err.stack : err);
		}

		console.error(err);
		cb(message);
	});
});

nodecg.listenFor('importer:reprocessImages', (data, cb = function () {}) => {
	queue.add(() => {
		log.info('Reprocessing image cache...');
		replicants.metadata.value.reprocessing = true;
		return reprocessImages();
	}).then(() => {
		log.info('Successfully reprocessed image cache.');
		replicants.metadata.value.reprocessing = false;
		cb();
	}).catch(err => {
		replicants.metadata.value.reprocessing = false;
		log.error('Failed to reprocess images:', (err && err.stack) ? err.stack : err);
		cb(err);
	});
});

nodecg.listenFor('importer:clearCache', (data, cb = function () {}) => {
	queue.add(() => {
		log.info('Clearing image cache...');
		replicants.metadata.value.clearing = true;
		return cacache.rm.all(cachePath);
	}).then(() => {
		log.info('Successfully cleared image cache.');
		replicants.metadata.value.clearing = false;
		cb();
	}).catch(err => {
		replicants.metadata.value.clearing = false;
		log.error('Failed to clear cache:', (err && err.stack) ? err.stack : err);
		cb(err);
	});
});

function doUpdateGoogleSheet(opts) {
	clearInterval(googlePollInterval);

	queue.add(() => ingestGoogleSheet(null, opts)).then(project => {
		// Project will only have value if an actual update was performed,
		// which will not be the case if we determined that we didn't need to update
		// because the sheet hadn't changed since our last poll.
		if (project) {
			handleProjectImport(project);
		}

		// Use an interval instead of a timeout so that it keeps trying if there is an error.
		clearInterval(googlePollInterval);
		googlePollInterval = setInterval(doUpdateGoogleSheet, 60000);
		replicants.metadata.value.lastPollTime = Date.now();
		replicants.metadata.value.updating = false;
	}).catch(err => {
		log.error('Error updating spreadsheet:\n', (err && err.stack) ? err.stack : err);

		// Use an interval instead of a timeout so that it keeps trying if there is an error.
		clearInterval(googlePollInterval);
		googlePollInterval = setInterval(doUpdateGoogleSheet, 60000);
		replicants.metadata.value.lastPollTime = Date.now();
		replicants.metadata.value.updating = false;
	});
}

function handleProjectImport(project) {
	replicants.metadata.value = Object.assign({
		// Only update lastPollTime if the new metadata specifies one.
		lastPollTime: replicants.metadata.value.lastPollTime
	}, project._metadata);
	replicants.metadata.value.updating = false;

	const validationErrors = [];
	const newValuesMap = new Map();
	const replicantsMap = new Map();

	// On the first loop, just validate. We do an atomic update where we only
	// update the replicants if every single one of them passes validation with their new value.
	for (const sheetName in importerOptions.replicantMappings) {
		if (!{}.hasOwnProperty.call(importerOptions.replicantMappings, sheetName)) {
			continue;
		}

		// We support either directly supplying a Replicant, or
		// supplying an object which defines both a "replicant" and a "processor".
		// This bit of code handles figuring out what is the replicant and what is the processor, if any.
		let replicant;
		let processor;
		const mapping = importerOptions.replicantMappings[sheetName];
		if (mapping.constructor.name === 'Replicant' || mapping.constructor.name === 'MockReplicant') {
			replicant = mapping;
		} else if (typeof mapping === 'object') {
			if (!{}.hasOwnProperty.call(mapping, 'replicant')) {
				throw new Error('Mapping object must specify a "replicant" key');
			}

			replicant = mapping.replicant;

			if (mapping.processor) {
				if (typeof mapping.processor === 'function') {
					processor = mapping.processor;
				} else {
					throw new Error('Mapping processor must be a function');
				}
			}
		} else {
			throw new Error('Unexpected mapping value, please check your replicantMappings.');
		}

		if (!{}.hasOwnProperty.call(project, sheetName)) {
			log.error('Replicant %s is mapped to non-existent dataset "%s"', replicant.name, sheetName);
			return;
		}

		replicantsMap.set(sheetName, replicant);

		const newValue = processor ?
			processor(project[sheetName]) :
			project[sheetName];

		// Don't assign the new value if it is equal to the existing value.
		if (equal(replicant.value, newValue)) {
			continue;
		}

		const validationPassed = replicant.validate(newValue, {
			throwOnInvalid: false
		});

		if (validationPassed) {
			newValuesMap.set(sheetName, newValue);
			continue;
		}

		// If we're here, then we had validation errors and we need to format & report them.
		replicant.validationErrors.forEach(error => {
			const field = error.field.replace(/^data\./, '');
			const columnName = calcColumnName(field);
			const culpritObject = error.type === 'object' ?
				objectPath.get(newValue, field.split('.')) :
				objectPath.get(newValue, field.split('.').slice(0, -1));
			const primaryKeyName = getPrimaryKey(culpritObject);

			const errorReport = {
				sheetName,
				columnName,
				id: {}.hasOwnProperty.call(culpritObject, primaryKeyName) ? culpritObject[primaryKeyName] : 'Unknown',
				validatorError: error
			};

			if (sheetName === 'teams' && PLAYER_IN_ROSTER_REGEX.test(field)) {
				// The problem is with one of the players listings in the roster.
				errorReport.sheetName = 'players';
			}

			if (sheetName === 'groups') {
				if (PLAYER_IN_GROUP_REGEX.test(field)) {
					// The problem is with one of the player listings in the group.
					errorReport.sheetName = 'group_players';
					errorReport.id = `group-id-${culpritObject.group_id}_user-id-${culpritObject.user_id}`;
				} else if (MATCH_IN_GROUP_REGEX.test(field)) {
					// The problem is with one of the match listings in the group.
					errorReport.sheetName = 'group_matches';
					errorReport.id = `group-id-${culpritObject.group_id}_match-num-${culpritObject.match}`;
				}
			}

			// If the error is coming from one of the "_meta" columns, which is a JSON object,
			// we have to a little extra work to grab the correct row ID to report.
			const metaColumnMatches = field.match(META_COLUMN_NAME_REGEX);
			const metaColumnName = (metaColumnMatches && metaColumnMatches.length) > 0 ?
				metaColumnMatches[0] :
				null;
			if (metaColumnName) {
				const pathParts = field.split('.');
				const metaIndex = pathParts.findIndex(part => part.endsWith('_meta'));
				errorReport.id = objectPath.get(newValue, pathParts.slice(0, metaIndex)).id || 'Unknown';
				errorReport.metaColumnName = metaColumnName;
			}

			validationErrors.push(errorReport);
		});
	}

	replicants.errors.value.validationErrors = validationErrors;

	const numErrors = calcNumErrors();
	if (numErrors > 0) {
		emitter.emit('importFailed', validationErrors);
		log.error('Import failed with %d errors; replicants will not be updated.', numErrors);
	} else {
		// Loop again, and do the actual assignments this time.
		for (const sheetName in importerOptions.replicantMappings) {
			if (!{}.hasOwnProperty.call(importerOptions.replicantMappings, sheetName)) {
				continue;
			}

			if (newValuesMap.has(sheetName)) {
				const replicant = replicantsMap.get(sheetName);
				replicant.value = clone(newValuesMap.get(sheetName));
			}
		}

		emitter.emit('projectImported', project);
	}
}

function calcNumErrors() {
	let numErrors = 0;
	for (const categoryName in replicants.errors.value) {
		if (!{}.hasOwnProperty.call(replicants.errors.value, categoryName)) {
			continue;
		}

		numErrors += replicants.errors.value[categoryName].length;
	}

	return numErrors;
}

function calcColumnName(field) {
	return field.match(COLUMN_NAME_REGEX)[0].replace('.', '');
}

/**
 * Finds the key to use as the primary key (aka "ID key") for an object.
 * The default key used in most sheets is simply "id".
 * However, other sheets may use "player_id", or "group_id" as their primary keys.
 *
 * This algorithm assumes that if an "id" field exists, then that must be the primary key.
 * Else, it returns the first field which ends with "_id".
 *
 * @param object
 * @returns {string | undefined}
 */
function getPrimaryKey(object) {
	const DEFAULT_IDS = ['id', 'key'];
	const keys = Object.keys(object);
	for (const defaultId of DEFAULT_IDS) {
		if (keys.includes(defaultId)) {
			return defaultId;
		}
	}

	return Object.keys(object).find(key => {
		return key.endsWith('_id');
	});
}

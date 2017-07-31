'use strict';

const PLAYER_IN_ROSTER_REGEX = /^[\d]+\.roster\.[\d]+/;
const COLUMN_NAME_REGEX = /\w+$/;
const META_COLUMN_NAME_REGEX = /\w*_meta/;

// Native
const path = require('path');

// Packages
const app = require('express')();
const equal = require('deep-equal');
const EventEmitter2 = require('eventemitter2').EventEmitter2;
const multer = require('multer');
const NanoTimer = require('nanotimer');
const objectPath = require('object-path');
const parseGoogleSheetsKey = require('google-spreadsheets-key-parser');

// NodeCG
// Bit hacky, this is loading one of NodeCG's own lib files.
const authCheck = require(path.resolve('lib/util/index')).authCheck;

// Ours
const importerOptions = require('../util/options').get();
const ingestGoogleSheet = require('./import-from-gdrive');
const ingestZip = require('./import-from-zip');
const nodecg = require('../util/nodecg-api-context').get();
const replicants = require('../util/replicants');

const googlePollTimer = new NanoTimer();
const log = new nodecg.Logger('healy');
const emitter = new EventEmitter2({wildcard: true});
const upload = multer({
	storage: multer.diskStorage({}),
	fileSize: 1000000 * 1024 // 1024 MB
});
module.exports = emitter;

app.post(`/${nodecg.bundleName}/import_project`,
	// First, check if the user is authorized.
	authCheck,

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
		googlePollTimer.clearInterval();

		ingestZip({
			zipPath: req.file.path,
			lastModified: req.body.lastModified,
			originalName: req.file.originalname
		}).then(project => {
			handleProjectImport(project);
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

	ingestGoogleSheet(key).then(project => {
		if (project) {
			handleProjectImport(project);
		}

		googlePollTimer.setInterval(doUpdateGoogleSheet, '', '60s');
		cb(null, {title: replicants.metadata.value.title});
	}).catch(err => {
		let message = err.message;
		if (err.code === 404) {
			message = `Spreadsheet not found at url "${url}"`;
			log.error(message);
		} else {
			log.error('Error loading spreadsheet:\n', (err && err.stack) ? err.stack : err);
		}

		cb(message);
	});
});

function doUpdateGoogleSheet(opts) {
	googlePollTimer.clearInterval();

	ingestGoogleSheet(null, opts).then(project => {
		// Project will only have value if an actual update was performed,
		// which will not be the case if we determined that we didn't need to update
		// because the sheet hadn't changed since our last poll.
		if (project) {
			handleProjectImport(project);
		}

		// Use an interval instead of a timeout so that it keeps trying if there is an error.
		googlePollTimer.setInterval(doUpdateGoogleSheet, '', '60s');
		replicants.metadata.value.lastPollTime = Date.now();
		replicants.metadata.value.updating = false;
	}).catch(err => {
		log.error('Error updating spreadsheet:\n', (err && err.stack) ? err.stack : err);

		// Use an interval instead of a timeout so that it keeps trying if there is an error.
		googlePollTimer.setInterval(doUpdateGoogleSheet, '', '60s');
		replicants.metadata.value.lastPollTime = Date.now();
		replicants.metadata.value.updating = false;
	});
}

function handleProjectImport(project) {
	replicants.metadata.value = Object.assign({
		// Only update lastPollTime if the new metadata specifies one.
		lastPollTime: replicants.metadata.value.lastPollTime
	}, project.metadata);
	replicants.metadata.value.updating = false;

	const validationErrors = [];

	// On the first loop, just validate. We do an atomic update where we only
	// update the replicants if every single one of them passes validation with their new value.
	for (const datasetName in importerOptions.replicantMappings) {
		if (!{}.hasOwnProperty.call(importerOptions.replicantMappings, datasetName)) {
			continue;
		}

		const replicant = importerOptions.replicantMappings[datasetName];
		if (!{}.hasOwnProperty.call(project, datasetName)) {
			log.error('Replicant %s is mapped to non-existent dataset "%s"', replicant.name, datasetName);
			return;
		}

		// Don't assign the new value if it is equal to the existing value.
		if (equal(replicant.value, project[datasetName])) {
			continue;
		}

		const result = replicant.validate(project[datasetName], {
			throwOnInvalid: false
		});

		if (!result) {
			replicant.validationErrors.forEach(error => {
				const field = error.field.replace(/^data\./, '');
				const columnName = calcColumnName(field);
				const parentObject = objectPath.get(project[datasetName], field.split('.').slice(0, -1));
				const errorReport = {
					sheetName: datasetName,
					columnName,
					id: parentObject.id || 'Unknown',
					validatorError: error
				};

				// Errors in player objects are a special case, because the way we store players/rosters is
				// completely different from how the sheet stores them. This means that we have to do a
				// little extra work to map these errors back to the sheet in a way that makes sense.
				if (datasetName === 'teams' && PLAYER_IN_ROSTER_REGEX.test(field)) {
					errorReport.sheetName = 'players';
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
					errorReport.id = objectPath.get(project[datasetName], pathParts.slice(0, metaIndex)).id || 'Unknown';
					errorReport.metaColumnName = metaColumnName;
				}

				validationErrors.push(errorReport);
			});
		}
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

			importerOptions.replicantMappings[sheetName].value = project[sheetName];
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

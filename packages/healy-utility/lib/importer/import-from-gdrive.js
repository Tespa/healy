'use strict';

// Packages
const BB = require('bluebird');
const EventEmitter = require('events');
const google = require('googleapis');
const NanoTimer = require('nanotimer');
const parseGoogleSheetsKey = require('google-spreadsheets-key-parser');

// Ours
const addToCache = require('../cache/add-to-cache');
const authClient = require('../google/google-auth-client').get();
const digestWorkbook = require('./digest-workbook');
const downloadGoogleDriveFile = require('../google/download-google-drive-file');
const importerOptions = require('../util/options').get();
const isCached = require('../cache/is-cached');
const nodecg = require('../util/nodecg-api-context').get();
const replicants = require('../util/replicants');
const zipImporter = require('./import-from-zip');

const emitter = new EventEmitter();
const log = new nodecg.Logger('healy:gdrive');
const googlePollTimer = new NanoTimer();
const driveApi = google.drive('v3');
const sheetsApi = google.sheets('v4');

BB.promisifyAll(driveApi.files);
BB.promisifyAll(sheetsApi.spreadsheets);
BB.promisifyAll(sheetsApi.spreadsheets.values);

module.exports = emitter;

if (replicants.metadata.value.id && replicants.metadata.value.source === 'googleDrive') {
	log.info('Restoring previous Google Drive project "%s"', replicants.metadata.value.title);
	doUpdateGoogleSheet();
}

// Stop polling Google Drive for new data when a zip import begins.
zipImporter.on('importStarted', () => {
	googlePollTimer.clearInterval();
});

nodecg.listenFor('importer:immediatelyPollGoogleSheet', () => {
	if (replicants.metadata.value.updating) {
		log.warn('Manual update requested, but an update was already in-progress. Ignoring.');
		return;
	}

	log.info('Manual update of Google Sheet requested.');
	doUpdateGoogleSheet();
});

nodecg.listenFor('importer:loadGoogleSheet', (url, cb) => {
	const key = parseGoogleSheetsKey(url).key;

	if (!key) {
		const message = `Invalid URL "${url}", does not contain a Google Sheets key`;
		log.error(message);
		return cb(message);
	}

	driveApi.files.getAsync({
		fileId: key,
		fields: 'modifiedTime',
		auth: authClient
	}).then(() => {
		return updateGoogleSheet(key);
	}).then(() => {
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

async function updateGoogleSheet(fileId) {
	googlePollTimer.clearInterval();

	// If an explicit fileId was not provided, use the previous one from the metadata replicant.
	if (!fileId) {
		if (!replicants.metadata.value) {
			log.error('Tried to update google sheet, but there was no metadata!');
			return;
		}

		if (replicants.metadata.value.source !== 'googleDrive') {
			log.error('Tried to update google sheet, but the current project is sourced from "%s"!',
				replicants.metadata.value.source);
			return;
		}

		if (!replicants.metadata.value.id) {
			log.error('Tried to update google sheet, but there was no ID in the metadata!');
			return;
		}
	}

	replicants.metadata.value.updating = true;

	const key = fileId || replicants.metadata.value.id;
	const {modifiedTime} = await driveApi.files.getAsync({
		fileId: key,
		fields: 'modifiedTime',
		auth: authClient
	});

	if (replicants.metadata.value && replicants.metadata.value.modifiedTime === modifiedTime) {
		log.debug('Workbook unchanged, not updating.');
		replicants.metadata.value.updating = false;
		return;
	}

	const spreadsheet = await sheetsApi.spreadsheets.getAsync({
		spreadsheetId: key,
		includeGridData: false,
		auth: authClient
	});

	const sheetNames = spreadsheet.sheets.map(sheet => sheet.properties.title);
	const response = await sheetsApi.spreadsheets.values.batchGetAsync({
		spreadsheetId: key,
		ranges: sheetNames,
		auth: authClient
	});

	const project = digestWorkbook({
		metadata: {
			title: spreadsheet.properties.title,
			id: spreadsheet.spreadsheetId,
			url: spreadsheet.spreadsheetUrl,
			modifiedTime: Date.parse(modifiedTime),
			lastPollTime: Date.now(),
			source: 'googleDrive'
		},
		sheets: sheetNames.map((name, index) => {
			return {
				name,
				values: Array.isArray(response.valueRanges[index].values) ?
					response.valueRanges[index].values :
					[]
			};
		})
	});

	const imageCacheErrors = await cacheProjectImagesFromGoogleDrive(project);

	if (imageCacheErrors.length > 0) {
		// TODO: report errors
	} else {
		emitter.emit('projectImported', project);
	}

	// Use an interval instead of a timeout so that it keeps trying if there is an error.
	googlePollTimer.setInterval(doUpdateGoogleSheet, '', '60s');
}

function doUpdateGoogleSheet() {
	updateGoogleSheet().catch(err => {
		replicants.metadata.value.updating = false;
		log.error('Error updating spreadsheet:\n', (err && err.stack) ? err.stack : err);
	});
}

async function cacheProjectImagesFromGoogleDrive(project) {
	const promises = [];
	importerOptions.gdriveImageProcessingJobs.forEach(job => {
		const dataSet = project[job.sheetName];
		dataSet.forEach(entry => {
			const metadata = entry[job.metadataField];
			if (!metadata || isCached(metadata.md5)) {
				return;
			}

			const cachePromise = downloadGoogleDriveFile({
				fileId: metadata.id,
				fileHash: metadata.md5
			}).then(buffer => {
				return addToCache(buffer, {
					namespace: job.namespace,
					extension: metadata.extension,
					hash: metadata.md5,
					processor: job.processor
				});
			});

			promises.push(cachePromise);
		});
	});

	return BB.all(promises.map(promise => {
		return promise.reflect();
	})).then(inspections => {
		const errors = [];
		inspections.forEach(inspection => {
			if (inspection.isFulfilled()) {
				console.log('A promise in the array was fulfilled with', inspection.value());
			} else {
				errors.push(inspection.reason());
				console.error('A promise in the array was rejected with', inspection.reason());
			}
		});

		return errors;
	});
}

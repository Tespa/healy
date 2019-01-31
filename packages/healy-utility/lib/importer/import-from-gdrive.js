'use strict';

// Packages
const BB = require('bluebird');
const serializeError = require('serialize-error');

// Ours
const addToCache = require('../cache/add-to-cache');
const authClient = require('../google/google-auth-client').get();
const digestWorkbook = require('./digest-workbook');
const downloadGoogleDriveFile = require('../google/download-google-drive-file');
const importerOptions = require('../util/options').get();
const isCached = require('../cache/is-cached');
const nodecg = require('../util/nodecg-api-context').get();
const replicants = require('../util/replicants');
const {driveApi, sheetsApi} = require('../google/request-mediator');

const log = new nodecg.Logger('healy:gdrive');

module.exports = ingestGoogleSheet;

async function ingestGoogleSheet(fileId, {force = false} = {}) {
	replicants.metadata.value.updating = true;

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

	const key = fileId || replicants.metadata.value.id;
	const gdriveFileData = await driveApi.files.get({
		fileId: key,
		fields: 'modifiedTime',
		auth: authClient,
		supportsTeamDrives: true
	});
	const modifiedTime = Date.parse(gdriveFileData.modifiedTime);

	if (!force && replicants.metadata.value && replicants.metadata.value.modifiedTime === modifiedTime) {
		log.debug('Workbook unchanged, not updating.');
		replicants.metadata.value.updating = false;
		return;
	}

	const spreadsheet = await sheetsApi.spreadsheets.get({
		spreadsheetId: key,
		includeGridData: false,
		auth: authClient
	});

	const sheetNames = spreadsheet.sheets.map(sheet => sheet.properties.title);
	const response = await sheetsApi.spreadsheets.values.batchGet({
		spreadsheetId: key,
		ranges: sheetNames,
		auth: authClient
	});

	const project = digestWorkbook({
		metadata: {
			title: spreadsheet.properties.title,
			id: spreadsheet.spreadsheetId,
			url: spreadsheet.spreadsheetUrl,
			modifiedTime,
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

	const imageErrors = await cacheProjectImagesFromGoogleDrive(project);
	replicants.errors.value.imageErrors = imageErrors.map(serializeError);
	return project;
}

function cacheProjectImagesFromGoogleDrive(project) {
	const promises = [];
	const metadataArray = [];

	importerOptions.imageProcessingJobs.forEach(job => {
		const dataSet = project[job.sheetName];
		if (!dataSet) {
			return;
		}

		dataSet.forEach(entry => {
			const metadata = entry[job.metadataField];
			if (!metadata) {
				return;
			}

			const cachePromise = isCached(metadata.md5).then(cached => {
				if (cached) {
					return;
				}

				return downloadGoogleDriveFile({
					fileId: metadata.id,
					fileHash: metadata.md5
				}).then(buffer => {
					return addToCache(buffer, {
						fileName: metadata.id,
						folder: job.folder,
						hash: metadata.md5,
						processor: job.processor
					});
				});
			});

			promises.push(cachePromise);
			metadataArray.push(metadata);
		});
	});

	return BB.all(promises.map(promise => {
		return promise.reflect();
	})).then(inspections => {
		const errors = [];
		inspections.forEach((inspection, index) => {
			if (!inspection.isFulfilled()) {
				const metadata = metadataArray[index];
				errors.push({
					fileName: metadata.id,
					error: serializeError(inspection.reason())
				});
			}
		});

		return errors;
	});
}

'use strict';

const PLAYER_IN_ROSTER_REGEX = /^[\d]+\.roster\.[\d]+/;
const COLUMN_NAME_REGEX = /\w+$/;

// Packages
const EventEmitter2 = require('eventemitter2').EventEmitter2;
const objectPath = require('object-path');

// Ours
const googleImporter = require('./import-from-gdrive');
const importerOptions = require('../util/options').get();
const nodecg = require('../util/nodecg-api-context').get();
const replicants = require('../util/replicants');
const zipImporter = require('./import-from-zip');

const log = new nodecg.Logger('healy');
const emitter = new EventEmitter2({wildcard: true});
module.exports = emitter;

googleImporter.on('projectImported', handleProjectImport);
zipImporter.on('projectImported', handleProjectImport);
googleImporter.on('importFailed', handleImportFailed);
zipImporter.on('importFailed', handleImportFailed);

function handleProjectImport(project) {
	replicants.metadata.value = project.metadata;
	replicants.metadata.value.updating = false;

	const validationErrors = [];

	// On the first loop, just validate. We do an atomic update where we only
	// update the replicants if every single one of them passes validation with their new value.
	for (const datasetName in importerOptions.replicantMappings) {
		if (!{}.hasOwnProperty.call(importerOptions.replicantMappings, datasetName)) {
			continue;
		}

		if (!{}.hasOwnProperty.call(project, datasetName)) {
			// TODO: error here.
		}

		const replicant = importerOptions.replicantMappings[datasetName];
		const result = replicant.validate(project[datasetName], {
			throwOnInvalid: false
		});

		if (!result) {
			replicant.validationErrors.forEach(error => {
				const field = error.field.replace(/^data\./, '');
				const columnName = field.match(COLUMN_NAME_REGEX)[0].replace('.', '');
				const parentObject = objectPath.get(project[datasetName], field.split('.').slice(0, -1));
				const errorReport = {
					sheetName: datasetName,
					columnName,
					id: parentObject.id || 'Unknown',
					message: error.message
				};

				if (datasetName === 'teams' && PLAYER_IN_ROSTER_REGEX.test(field)) {
					errorReport.sheetName = 'players';
					errorReport.id = parentObject.user_id;
				}

				if (error.message === 'is the wrong type') {
					errorReport.message = `Value "${error.value}" is a "${typeof error.value}", expected a "${error.type}"`;
				} else if (error.message === 'has additional properties') {
					errorReport.message = `Has these additional properties: ${error.value.replace(/^data\./g, '')}`;
				}

				validationErrors.push(errorReport);
			});
		}
	}

	replicants.errors.value = validationErrors;

	if (validationErrors.length > 0) {
		emitter.emit('importFailed', validationErrors);
		log.error('Import failed with %d errors.', validationErrors.length);
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

function handleImportFailed(errors) {
	// TODO: this
	replicants.errors.value = errors;
	emitter.emit('importFailed', errors);
}

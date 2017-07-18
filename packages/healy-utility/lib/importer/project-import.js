'use strict';

// Packages
const EventEmitter2 = require('eventemitter2').EventEmitter2;

// Ours
const googleImporter = require('./import-from-gdrive');
const importerOptions = require('../util/options').get();
const replicants = require('../util/replicants');
const zipImporter = require('./import-from-zip');

const emitter = new EventEmitter2({wildcard: true});
module.exports = emitter;

googleImporter.on('projectImported', handleProjectImport);
zipImporter.on('projectImported', handleProjectImport);
googleImporter.on('importFailed', handleImportFailed);
zipImporter.on('importFailed', handleImportFailed);

replicants.errors.on('change', newVal => {
	console.log(newVal);
});

function handleProjectImport(project) {
	replicants.metadata.value = project.metadata;
	replicants.metadata.value.updating = false;

	const validationErrors = [];

	// On the first loop, just validate. We do an atomic update where we only
	// update the replicants if every single one of them passes validation with their new value.
	for (const sheetName in importerOptions.replicantMappings) {
		if (!{}.hasOwnProperty.call(importerOptions.replicantMappings, sheetName)) {
			continue;
		}

		if (!{}.hasOwnProperty.call(project, sheetName)) {
			// TODO: error here.
		}

		const replicant = importerOptions.replicantMappings[sheetName];
		console.log('validating %s against sheet %s', replicant.name, sheetName);
		const result = replicant.validate(project[sheetName], {
			throwOnInvalid: false
		});
		console.log('\tresult:', result);

		if (!result) {
			// TODO: these are just strings. Is that how I want the final thing to be?
			replicant.validationErrors.forEach(error => {
				const field = error.field.replace('data.', '');
				const rowNum = field.match(/^[\d]+[\\.]/)[0].replace('.', '');
				const columnName = field.match(/[\\.]\w+$/)[0].replace('.', '');
				if (error.message === 'is the wrong type') {
					validationErrors.push({
						sheetName,
						rowNum: parseInt(rowNum, 10),
						columnName,
						message: `Cell `
					});
					validationErrors.push(`Field "${field}" ${error.message}. Value "${error.value}" (type: ${typeof error.value}) was provided, expected type "${error.type}"\n `);
				} else if (error.message === 'has additional properties') {
					validationErrors.push(`Field "${field}" ${error.message}: "${error.value}"\n`);
				} else {
					validationErrors.push(`Field "${field}" ${error.message}\n`);
				}
			});
		}
	}

	if (validationErrors.length > 0) {
		emitter.emit('importFailed', validationErrors);
		replicants.errors.value = validationErrors;
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

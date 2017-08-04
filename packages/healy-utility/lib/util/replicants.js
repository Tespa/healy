'use strict';

// Native
const path = require('path');

// Ours
const nodecg = require('../util/nodecg-api-context').get();

module.exports = {
	metadata: nodecg.Replicant('importer:metadata', {schemaPath: buildSchemaPath('metadata')}),
	errors: nodecg.Replicant('importer:errors', {schemaPath: buildSchemaPath('errors')})
};

// Reset a few boolean state values on startup.
module.exports.metadata.value.updating = false;
module.exports.metadata.value.reprocessing = false;
module.exports.metadata.value.clearing = false;

/**
 * Calculates the absolute file path to one of our local Replicant schemas.
 * @param schemaName {string}
 */
function buildSchemaPath(schemaName) {
	return path.resolve(__dirname, '../../schemas', `${encodeURIComponent(schemaName)}.json`);
}

'use strict';

// Native
const path = require('path');

// Ours
const nodecg = require('../util/nodecg-api-context').get();

module.exports = {
	metadata: nodecg.Replicant('importer:metadata', {schemaPath: buildSchemaPath('metadata')}),
	errors: nodecg.Replicant('importer:errors', {schemaPath: buildSchemaPath('errors')})
};

/**
 * Calculates the absolute file path to one of our local Replicant schemas.
 * @param schemaName {string}
 */
function buildSchemaPath(schemaName) {
	return path.resolve(__dirname, '../../schemas', `${encodeURIComponent(schemaName)}.json`);
}

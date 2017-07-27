'use strict';

const MAX_RETRIES = 5;

// Ours
const authClient = require('./google-auth-client').get();
const nodecg = require('../util/nodecg-api-context').get();
const computeHash = require('../util/compute-hash');
const {driveApi} = require('./request-mediator');

/**
 * Download a file from Google Drive, with checksum validation and automatic retries.
 * @param fileId {string} - The Google Drive file ID of the image being cached.
 * @param fileHash {string} - The hash of this file.
 * @param [hashAlgorithm='md5'] {string} - The algorithm used to derive the fileHash.
 * @returns {Promise}
 */
module.exports = async function ({fileId, fileHash, hashAlgorithm = 'md5'}) {
	let buffer;
	let attempts = 0;
	do {
		try {
			buffer = await driveApi.files.get({ // eslint-disable-line no-await-in-loop
				fileId,
				alt: 'media',
				auth: authClient
			}, {
				encoding: null
			});
		} catch (err) {
			nodecg.log.error('Failed to cache image\n', (err && err.stack) ? err.stack : err);
			throw err;
		}

		const downloadHash = computeHash(buffer, hashAlgorithm);
		if (downloadHash !== fileHash) {
			nodecg.log.warn(`Google Drive download for file ID "${fileId}" had a mismatched ${hashAlgorithm} hash. Retrying.`);
		}

		attempts++;
	} while (!buffer && attempts < MAX_RETRIES);

	if (!buffer) {
		nodecg.log.error(`Failed to download file ID "${fileId}" after ${MAX_RETRIES} retries!`);
	}

	return buffer;
};

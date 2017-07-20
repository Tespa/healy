'use strict';

// Packages
const cacache = require('cacache');

// Ours
const cachePath = require('./cache-path');

module.exports = async function (buffer, {key, fileName, hash, hashAlgorithm = 'md5', processor}) {
	const opts = {
		algorithms: [ // Ignored when an integrity is provided.
			hashAlgorithm
		]
	};

	if (hash) {
		opts.integrity = hashAlgorithm + '-' + Buffer.from(hash, 'hex').toString('base64');

		if (typeof key === 'undefined') {
			key = hash;
		}
	}

	if (processor) {
		if (typeof processor !== 'function') {
			throw new Error(`processor must be a function, got a ${typeof processor}`);
		}
		await processor({buffer, hash, fileName});
	}

	return cacache.put(cachePath, key, buffer, opts);
};

module.exports.stream = function (readStream) {
	return readStream.pipe(
		cacache.put.stream(cachePath, '_streamedKey', {
			hashAlgorithm: 'md5',
			algorithms: ['md5']
		})
	);
};

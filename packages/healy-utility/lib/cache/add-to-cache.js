'use strict';

// Packages
const cacache = require('cacache');

// Ours
const cachePath = require('./cache-path');

module.exports = function (buffer, {key, hash, hashAlgorithm = 'md5'}) {
	const opts = {
		hashAlgorithm // Ignored when an integrity is provided.
	};

	if (hash) {
		opts.integrity = hashAlgorithm + '-' + Buffer.from(hash, 'hex').toString('base64');

		if (typeof key === 'undefined') {
			key = hash;
		}
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

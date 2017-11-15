'use strict';

// Packages
const cacache = require('cacache');

// Ours
const cachePath = require('./cache-path');

module.exports = async function (buffer, {key, fileName, hash, folder, hashAlgorithm = 'md5', processor}) {
	if (!Buffer.isBuffer(buffer)) {
		throw new Error(`Argument "buffer" must be of type "buffer", got a(n) "${typeof buffer}"`);
	} else if (typeof fileName !== 'string') {
		throw new Error(`Argument "fileName" must be of type "string", got a(n) "${typeof fileName}"`);
	} else if (typeof folder !== 'string') {
		throw new Error(`Argument "folder" must be of type "string", got a(n) "${typeof folder}"`);
	}

	if (processor) {
		const jobPromises = [];
		if (typeof processor !== 'function') {
			throw new Error(`processor must be a function, got a ${typeof processor}`);
		}

		const results = await processor({buffer, hash, fileName});
		if (Array.isArray(results)) {
			results.forEach(result => {
				const promise = cacache.put(cachePath, result.key, result.buffer, {algorithms: [hashAlgorithm]});
				jobPromises.push(promise);
			});
		} else {
			const promise = cacache.put(cachePath, results.key, results.buffer, {algorithms: [hashAlgorithm]});
			jobPromises.push(promise);
		}

		// Ensure that the processing job has completed successfully before moving on.
		await Promise.all(jobPromises);
	}

	const opts = {
		algorithms: [ // Ignored when an integrity is provided.
			hashAlgorithm
		],
		metadata: {
			hash,
			hashAlgorithm,
			fileName,
			folder
		}
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

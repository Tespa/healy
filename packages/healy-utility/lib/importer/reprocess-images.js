'use strict';

const CACACHE_OPTS = {algorithms: ['md5']};

// Packages
const cacache = require('cacache');
const ssri = require('ssri');

// Ours
const cachePath = require('../cache/cache-path');
const importerOptions = require('../util/options').get();

module.exports = function () {
	let hasErrored = false;
	const promises = [];
	const processorMap = new Map();
	importerOptions.imageProcessingJobs.forEach(job => {
		if (job.processor) {
			processorMap.set(job.folder, job.processor);
		}
	});

	return new Promise((resolve, reject) => {
		const stream = cacache.ls.stream(cachePath);
		stream.on('data', entry => {
			if (hasErrored) {
				return;
			}

			if (!entry.metadata || !processorMap.has(entry.metadata.folder)) {
				return;
			}

			const processor = processorMap.get(entry.metadata.folder);
			const promise = cacache.get(cachePath, entry.key).then(({data, metadata, integrity}) => {
				const sri = ssri.parse(integrity);
				return processor({
					buffer: data,
					hash: sri.digest,
					fileName: metadata.fileName
				});
			}).then(results => {
				if (Array.isArray(results)) {
					const putPromises = [];
					results.forEach(({buffer, key}) => {
						const putPromise = cacache.put(cachePath, key, buffer, CACACHE_OPTS);
						putPromises.push(putPromise);
					});
					return Promise.all(putPromises);
				}

				return cacache.put(cachePath, results.key, results.buffer, CACACHE_OPTS);
			});

			promises.push(promise);
		});

		stream.on('end', () => {
			if (hasErrored) {
				return;
			}
			Promise.all(promises).then(() => {
				return resolve();
			});
		});

		stream.on('error', error => {
			if (hasErrored) {
				return;
			}
			hasErrored = true;
			reject(error);
		});
	});
};

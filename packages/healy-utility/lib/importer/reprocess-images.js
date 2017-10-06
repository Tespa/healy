'use strict';

const CACACHE_OPTS = {algorithms: ['md5']};

// Packages
const cacache = require('cacache');
const ssri = require('ssri');

// Ours
const cachePath = require('../cache/cache-path');
const importerOptions = require('../util/options').get();

module.exports = async function () {
	const promises = [];
	const processorMap = new Map();
	importerOptions.imageProcessingJobs.forEach(job => {
		if (job.processor) {
			processorMap.set(job.folder, job.processor);
		}
	});

	const cacheEntries = await cacache.ls(cachePath);
	Object.values(cacheEntries).forEach(entry => {
		if (!entry.metadata || !processorMap.has(entry.metadata.folder)) {
			return;
		}

		const processor = processorMap.get(entry.metadata.folder);
		const promise = cacache.get(cachePath, entry.key).then(async ({data, metadata, integrity}) => {
			const processorResults = await processor({
				buffer: data,
				hash: ssri.parse(integrity).hexDigest(),
				fileName: metadata.fileName
			});

			if (Array.isArray(processorResults)) {
				const putPromises = [];
				processorResults.forEach(({buffer, key}) => {
					const putPromise = cacache.put(cachePath, key, buffer, CACACHE_OPTS);
					putPromises.push(putPromise);
				});
				return Promise.all(putPromises);
			}

			return cacache.put(cachePath, processorResults.key, processorResults.buffer, CACACHE_OPTS);
		});

		promises.push(promise);
	});

	await Promise.all(promises);
	await cacache.verify(cachePath);
};

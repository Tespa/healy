'use strict';

// Packages
const app = require('express')();
const cacache = require('cacache');
const clone = require('clone');
const ssri = require('ssri');

// Ours
const isCached = require('./is-cached');
const nodecg = require('../util/nodecg-api-context').get();
const cachePath = require('./cache-path');

const log = new nodecg.Logger('healy:cache-server');

app.get(`/${nodecg.bundleName}/cache/:hash`, async (req, res) => {
	try {
		const hash = req.params.hash;
		const variant = req.query.variant;
		const returnHash = 'returnHash' in req.query && req.query.returnHash !== 'false';
		if (!await isCached(hash, variant)) {
			return res.sendStatus(404);
		}

		let key = hash;
		if (variant) {
			key += `_${variant}`;
		}

		const info = await cacache.get(cachePath, key);
		if (returnHash) {
			const clonedInfo = clone(info);
			delete clonedInfo.data;
			clonedInfo.hexDigest = ssri.parse(clonedInfo.integrity).hexDigest();
			res.send(clonedInfo);
			return;
		}

		if (info.metadata && info.metadata.fileType) {
			// SVG files _must_ have a proper content-type set, otherwise the browser will not display them.
			// Its less important to set the content-type for other formats, as the browser seems to be able to figure them out.
			// Still, it certainly doesn't hurt.
			// We're lucky that express uses a `mime.lookup()` function to determine the correct content type 
			// based on the file extension, so that's all we have to pass in here.
			res.type(info.metadata.fileType.toLowerCase());
		}

		res.send(info.data);
	} catch (err) {
		if (err.code === 'ENOENT') {
			return res.sendStatus(404);
		}

		log.error('Failed to serve file from cache:\n', err.stack ? err.stack : err);
		return res.sendStatus(500);
	}
});

app.get(`/${nodecg.bundleName}/checkCache`, async (req, res) => {
	if (!req.query.hashes || typeof req.query.hashes !== 'string') {
		return res.sendStatus(400);
	}

	const hashes = req.query.hashes.split(',');
	const variants = req.query.variants ? req.query.variants.split(',') : [];
	const promises = hashes.map((hash, index) => {
		return isCached(hash, variants[index]);
	});

	Promise.all(promises).then(results => {
		res.send(results);
	}).catch(err => {
		log.error('Failed to check cache for hashes "%s":\n', hashes, err.stack ? err.stack : err);
		res.sendStatus(500);
	});
});

function errorHandler(error, res) {
	if (error.code === 'ENOENT') {
		return res.sendStatus(404);
	}

	log.error('Failed to serve file from cache:\n', error.stack ? error.stack : error);
	res.sendStatus(500);
}

nodecg.mount(app);

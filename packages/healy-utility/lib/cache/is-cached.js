'use strict';

// Packages
const cacache = require('cacache');

// Ours
const cachePath = require('./cache-path');

module.exports = function (hash, variant) {
	if (variant) {
		return cacache.get(cachePath, `${hash}_${variant}`).then(info => {
			return Boolean(info);
		});
	}

	const integrity = 'md5-' + Buffer.from(hash, 'hex').toString('base64');
	return cacache.get.hasContent(cachePath, integrity).then(result => {
		return Boolean(result.sri);
	});
};

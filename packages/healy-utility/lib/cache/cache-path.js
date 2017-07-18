'use strict';

// Native
const path = require('path');

// Ours
const nodecg = require('../util/nodecg-api-context').get();

if (typeof nodecg.bundleConfig.cachePath !== 'string') {
	throw new Error('Required bundle config param "cachePath" is not defined or is of the wrong type.');
}

module.exports = path.isAbsolute(nodecg.bundleConfig.cachePath) ?
	nodecg.bundleConfig.cachePath :
	path.join(process.env.NODECG_ROOT, nodecg.bundleConfig.cachePath);

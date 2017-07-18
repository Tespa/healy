'use strict';

// Native
const crypto = require('crypto');

module.exports = function (buffer, hashAlgorithm = 'md5') {
	const hash = crypto.createHash(hashAlgorithm);
	hash.update(buffer);
	return hash.digest('hex');
};

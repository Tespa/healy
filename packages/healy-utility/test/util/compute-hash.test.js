'use strict';

// Native
const fs = require('fs');
const path = require('path');

// Packages
const test = require('ava');

const buffer = fs.readFileSync(path.resolve(__dirname, '../fixtures/pexels-photo-472457.jpeg'));

// Unit under test
const computeHash = require('../../lib/util/compute-hash');

test('computes correct md5 hashes, and computes md5 by default', t => {
	const hash = computeHash(buffer);
	t.is(hash, '01d805622cd2a6226f83974202d595c2');
});

test('computes correct sha256 hashes', t => {
	const hash = computeHash(buffer, 'sha256');
	t.is(hash, 'd7034e0c2a98008f41b2ef861fe5b48a8483db0d05fca6954b1f1017ebaf71ab');
});

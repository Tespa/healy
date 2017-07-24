'use strict';

const PORT = 59650;

// Native
const fs = require('fs');
const path = require('path');

// Packages
const express = require('express');
const fetch = require('make-fetch-happen');
const FormData = require('form-data');
const mockery = require('mockery');
const test = require('ava');

// Mocks
const MockNodeCG = require('mock-nodecg');
mockery.registerMock(path.resolve('lib/util/index'), {
	authCheck(req, res, next) {
		return next();
	}
});
mockery.enable({warnOnUnregistered: false});
const nodecg = new MockNodeCG({bundleName: 'test_bundle'});

// Ours
const cachePath = require('../helpers/makeTempCachePath')(test);
const healyUtility = require('../../index');
const nominalHelpers = require('../helpers/nominal-helpers')(nodecg);

const app = express();
nodecg.bundleConfig = {cachePath};
nodecg.mount = app.use.bind(app);

app.listen(PORT);

test.before(() => {
	return healyUtility.init(nodecg, nominalHelpers.healyOptions);
});

test('importing a project from a .zip archive', async t => {
	const zipPath = path.resolve(__dirname, '../fixtures/nominal.zip');
	const form = new FormData();
	form.append('file', fs.createReadStream(zipPath));
	form.append('lastModified', Date.parse(fs.lstatSync(zipPath).mtime));

	const response = await fetch(`http://localhost:${PORT}/${nodecg.bundleName}/import_project`, {
		method: 'POST',
		body: form
	});

	if (!response.ok) {
		return t.fail('response was not OK');
	}

	const replicants = require('../../lib/util/replicants');
	const fixture = JSON.parse(fs.readFileSync('test/fixtures/nominal-zip.json', 'utf-8'));
	t.deepEqual(replicants.errors.value, {
		imageErrors: [],
		validationErrors: []
	});

	Object.entries(nominalHelpers.healyOptions.replicantMappings).forEach(([key, replicant]) => {
		t.deepEqual(replicant.value, fixture[key]);
	});
});

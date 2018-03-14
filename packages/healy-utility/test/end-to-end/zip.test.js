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
		body: form,
		timeout: 60000
	});

	if (!response.ok) {
		return t.fail('response was not OK');
	}

	const replicants = require('../../lib/util/replicants');

	/* eslint-disable spaced-comment */
	// Uncomment this to write a new fixture.
	/*const foo = {};
	foo.metadata = replicants.metadata.value;
	Object.entries(nominalHelpers.healyOptions.replicantMappings).forEach(([key, replicant]) => {
		foo[key] = replicant.value;
	});
	fs.writeFileSync('test/fixtures/nominal-zip.json', JSON.stringify(foo, null, 2), 'utf8');*/
	/* eslint-enable spaced-comment */

	const fixture = JSON.parse(fs.readFileSync('test/fixtures/nominal-zip.json', 'utf8'));
	t.deepEqual(replicants.errors.value, {
		imageErrors: [],
		validationErrors: []
	});

	Object.entries(nominalHelpers.healyOptions.replicantMappings).forEach(([key, replicant]) => {
		t.deepEqual(replicant.value, fixture[key]);
	});
});

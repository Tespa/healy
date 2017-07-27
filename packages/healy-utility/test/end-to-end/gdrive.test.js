'use strict';

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1v3zuGE6sAh_Lo0udg8jeQeaeZ4XCqoWdaKkSZ9c3hIc';

// Native
const fs = require('fs');
const path = require('path');

// Packages
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
const nodecg = new MockNodeCG();

// Ours
const cachePath = require('../helpers/makeTempCachePath')(test);
const healyUtility = require('../../index');
const nominalHelpers = require('../helpers/nominal-helpers')(nodecg);

nodecg.bundleConfig = {cachePath};

test.before(() => {
	return healyUtility.init(nodecg, nominalHelpers.healyOptions);
});

test.cb('importing a project from Google Drive', t => {
	nodecg.emit('importer:loadGoogleSheet', SHEET_URL, err => {
		if (err) {
			t.fail(err);
		} else {
			const replicants = require('../../lib/util/replicants');
			const fixture = JSON.parse(fs.readFileSync('test/fixtures/nominal-zip.json', 'utf-8'));
			t.deepEqual(replicants.errors.value, {
				imageErrors: [],
				validationErrors: []
			});

			Object.entries(nominalHelpers.healyOptions.replicantMappings).forEach(([key, replicant]) => {
				t.deepEqual(replicant.value, fixture[key]);
			});

			t.end();
		}
	});
});

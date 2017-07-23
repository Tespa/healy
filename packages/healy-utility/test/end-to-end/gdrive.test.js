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

// Ours
const cachePath = require('../helpers/makeTempCachePath')(test);
const healyUtility = require('../../index');

const nodecg = new MockNodeCG();
nodecg.bundleConfig = {cachePath};

test.before(() => {
	return healyUtility.init(nodecg, {
		googleApplicationCredentialsPath: path.resolve(__dirname, '../../../../google-application-credentials.json'),
		replicantMappings: {},
		casts: {
			integer: [
				'deaths',
				'game_loss',
				'game_win',
				'kills',
				'kda',
				'map_loss',
				'map_win',
				'match',
				'match_loss',
				'match_win',
				'order',
				'round',
				'seed',
				'team1_score',
				'team2_score'
			],
			float: [
				'time'
			]
		},
		gdriveImageProcessingJobs: [{
			namespace: 'teams.logo',
			sheetName: 'teams',
			metadataField: 'logo_meta'
		}, {
			namespace: 'teams.school_image',
			sheetName: 'teams',
			metadataField: 'school_image_meta'
		}, {
			namespace: 'teams.image',
			sheetName: 'teams',
			metadataField: 'image_meta'
		}, {
			namespace: 'sponsors.image',
			sheetName: 'sponsors_rotation',
			metadataField: 'image_meta'
		}, {
			namespace: 'players.image',
			sheetName: 'players',
			metadataField: 'image_meta'
		}]
	});
});

test.cb('importing a project from Google Drive', t => {
	nodecg.emit('importer:loadGoogleSheet', SHEET_URL, err => {
		console.log('in the callback, err:', err);
		if (err) {
			t.fail(err);
		} else {
			t.end();
		}
	});
});

'use strict';

const SHEETS_LIMIT = 100;
const DRIVE_LIMIT = 1000;
const LIMIT_MODIFIER = 0.9;
const ONE_HUNDRED_SECONDS = 100 * 1000;

// Packages
const BB = require('bluebird');
const google = require('googleapis');
const stopcock = require('stopcock');

const driveApi = google.drive('v3');
const sheetsApi = google.sheets('v4');

const DRIVE_STOPCOCK_OPTIONS = {
	interval: ONE_HUNDRED_SECONDS,
	limit: Math.floor(DRIVE_LIMIT * LIMIT_MODIFIER / 100)
};

const SHEETS_STOPCOCK_OPTIONS = {
	interval: 1000,
	limit: Math.floor(SHEETS_LIMIT * LIMIT_MODIFIER / 100)
};

BB.promisifyAll(driveApi.files);
BB.promisifyAll(sheetsApi.spreadsheets);
BB.promisifyAll(sheetsApi.spreadsheets.values);

// TODO: handle ratelimit responses
module.exports = {
	driveApi: {
		files: {
			get: stopcock((...args) => {
				return driveApi.files.getAsync(...args);
			}, DRIVE_STOPCOCK_OPTIONS)
		}
	},
	sheetsApi: {
		spreadsheets: {
			get: stopcock((...args) => {
				return sheetsApi.spreadsheets.getAsync(...args);
			}, SHEETS_STOPCOCK_OPTIONS),
			values: {
				batchGet: stopcock((...args) => {
					return sheetsApi.spreadsheets.values.batchGetAsync(...args);
				}, SHEETS_STOPCOCK_OPTIONS)
			}
		}
	}
};

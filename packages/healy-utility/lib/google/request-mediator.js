'use strict';

const ONE_SECOND = 1000;

// Packages
const BB = require('bluebird');
const google = require('googleapis');
const stopcock = require('stopcock');
const promiseRetry = require('promise-retry');

const driveApi = google.drive('v3');
const sheetsApi = google.sheets('v4');

const DRIVE_STOPCOCK_OPTIONS = {
	interval: ONE_SECOND,
	limit: 9
};

const SHEETS_STOPCOCK_OPTIONS = {
	interval: ONE_SECOND,
	limit: 1
};

const PROMISE_RETRY_OPTIONS = {
	retries: 10,
	factor: 2,
	minTimeout: 1000,
	maxTimeout: Infinity,
	randomize: false
};

function isRateLimitErrorMessage(message) {
	return message === 'User Rate Limit Exceeded' ||
		message === 'Daily Limit Exceeded' ||
		message === 'Rate Limit Exceeded';
}

function isRetryableCode(code) {
	return code === 'ETIMEDOUT';
}

function catcherFactory(retry) {
	return function (err) {
		if (isRateLimitErrorMessage(err.message) || isRetryableCode(err.code)) {
			return retry();
		}

		throw err;
	};
}

BB.promisifyAll(driveApi.files);
BB.promisifyAll(sheetsApi.spreadsheets);
BB.promisifyAll(sheetsApi.spreadsheets.values);

module.exports = {
	driveApi: {
		files: {
			get: stopcock((...args) => {
				return promiseRetry(retry => {
					return driveApi.files.getAsync(...args).catch(catcherFactory(retry));
				}, PROMISE_RETRY_OPTIONS);
			}, DRIVE_STOPCOCK_OPTIONS)
		}
	},
	sheetsApi: {
		spreadsheets: {
			get: stopcock((...args) => {
				return promiseRetry(retry => {
					return sheetsApi.spreadsheets.getAsync(...args).catch(catcherFactory(retry));
				}, PROMISE_RETRY_OPTIONS);
			}, SHEETS_STOPCOCK_OPTIONS),
			values: {
				batchGet: stopcock((...args) => {
					return promiseRetry(retry => {
						return sheetsApi.spreadsheets.values.batchGetAsync(...args).catch(catcherFactory(retry));
					}, PROMISE_RETRY_OPTIONS);
				}, SHEETS_STOPCOCK_OPTIONS)
			}
		}
	}
};

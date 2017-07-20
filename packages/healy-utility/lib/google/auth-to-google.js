'use strict';

// Packages
const GoogleAuth = require('google-auth-library');

const authFactory = new GoogleAuth();
let initialized = false;

module.exports = function () {
	if (initialized) {
		throw new Error('auth-to-google can only be run once');
	}

	initialized = true;

	return new Promise((resolve, reject) => {
		const importerOptions = require('../util/options').get();
		process.env.GOOGLE_APPLICATION_CREDENTIALS = importerOptions.googleApplicationCredentialsPath;
		authFactory.getApplicationDefault(async (err, authClient) => {
			if (err) {
				return reject(err);
			}

			if (authClient.createScopedRequired && authClient.createScopedRequired()) {
				const scopes = [
					'https://www.googleapis.com/auth/spreadsheets.readonly',
					'https://www.googleapis.com/auth/drive.readonly'
				];

				authClient = authClient.createScoped(scopes);
			}

			resolve(authClient);
		});
	});
};

'use strict';

// Native
const EventEmitter = require('events');

// Ours
const authToGoogle = require('./lib/google/auth-to-google');
const googleAuthClient = require('./lib/google/google-auth-client');
const nodecgApiContext = require('./lib/util/nodecg-api-context');
const options = require('./lib/util/options');

const emitter = new EventEmitter();
module.exports = emitter;

module.exports.init = async function (nodecg, opts) {
	// Store a reference to this nodecg API context in a place where other libs can easily access it.
	// This must be done before any other files are `require`d.
	nodecgApiContext.set(nodecg);
	options.set(opts);

	const log = new nodecg.Logger('healy');
	let authClient;
	try {
		authClient = await authToGoogle();
		googleAuthClient.set(authClient);
		log.info('Authenticated with Google');
	} catch (err) {
		// TODO: do something dramatic if this happens
		log.error('Authentication failed because of ', err);
	}

	if (authClient) {
		try {
			const importer = require('./lib/importer/project-import');
			require('./lib/cache/cache-server');

			// Forward events from the importer.
			importer.onAny((event, ...values) => {
				emitter.emit(event, ...values);
			});
		} catch (err) {
			log.error('Error initializing:\n', err);
		}
	}

	// Yeah, this is weird, but we have to intentionally delay this until we have the nodecg API context.
	module.exports.addToCache = require('./lib/cache/add-to-cache');
};

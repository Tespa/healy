'use strict';

let authClient;
module.exports = {
	get() {
		if (!authClient) {
			throw new Error('Tried to get google authClient, but authClient has not yet been set!');
		}

		return authClient;
	},
	set(ac) {
		authClient = ac;
	}
};

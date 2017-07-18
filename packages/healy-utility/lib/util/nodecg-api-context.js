'use strict';

let context;
module.exports = {
	get() {
		if (!context) {
			throw new Error('Tried to get the NodeCG API context, but it has not yet been set!');
		}

		return context;
	},
	set(ctx) {
		context = ctx;
	}
};

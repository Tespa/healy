'use strict';

// TODO: validate options
let options;
module.exports = {
	get() {
		if (!options) {
			throw new Error('Tried to get options, but they have not yet been set!');
		}

		return options;
	},
	set(newOptions) {
		options = newOptions;
	}
};

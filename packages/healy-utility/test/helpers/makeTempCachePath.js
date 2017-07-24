'use strict';

const tmp = require('tmp');
tmp.setGracefulCleanup();

module.exports = function (test) {
	const tmpobj = tmp.dirSync({unsafeCleanup: true});
	test.after('remove tmp dir', () => {
		tmpobj.removeCallback();
	});
	return tmpobj.name;
};

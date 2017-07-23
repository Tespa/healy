'use strict';

const tmp = require('tmp');

tmp.setGracefulCleanup();
const tmpobj = tmp.dirSync({unsafeCleanup: true});

module.exports = function (test) {
	test.after('remove tmp dir', () => {
		tmpobj.removeCallback();
	});
	return tmpobj.name;
};


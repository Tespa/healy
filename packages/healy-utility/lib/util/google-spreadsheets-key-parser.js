const url = require('url');

module.exports = parse;

function parse(str) {
	let isNew;
	let key;
	if (str.indexOf('http') === -1) {
		return {key: str};
	}

	const parsed = url.parse(str, true)
	if (parsed.query.key) {
		isNew = false;
		key = parsed.query.key;
	} else {
		const parts = parsed.pathname.split('/');
		const keyIdx = parts.indexOf('d') + 1;
		key = parts[keyIdx];
		isNew = true;
	}

	const result = {key};
	if (isNew) {
		result.isNewSheets = true;
	}
	return result;
}

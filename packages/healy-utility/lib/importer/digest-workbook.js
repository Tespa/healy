'use strict';

// Packages
const _snakeCase = require('lodash.snakecase');

// Ours
const importerOptions = require('../util/options').get();
const nodecg = require('../util/nodecg-api-context').get();

const log = new nodecg.Logger('healy');

module.exports = function (workbook) {
	const formattedData = {
		metadata: workbook.metadata
	};

	workbook.sheets.forEach(sheet => {
		if (!sheet.values[0]) {
			formattedData[_snakeCase(sheet.name)] = [];
			return;
		}

		// Normalize all column names to snake_case.
		const columnNames = sheet.values[0].map(columnName => {
			columnName = _snakeCase(columnName);

			// Lodash.snakecase inserts an underscore in the middle of the string "md5",
			// which we don't want, so we just remove it here. As of right now
			// there are no other strings where we need to make this correction, but that may change.
			if (columnName.endsWith('md_5')) {
				columnName = columnName.replace('md_5', 'md5');
			}

			return columnName;
		});

		const numColumns = columnNames.length;
		const rows = sheet.values.slice(1).filter(row => {
			if (row.length === 0) {
				return false;
			}

			if (row.length === 1 && row[0] === '+0') {
				return false;
			}

			return true;
		});

		formattedData[_snakeCase(sheet.name)] = rows.map((row, rowNum) => {
			const result = {};

			for (let c = 0; c < numColumns; c++) {
				// This is currently a hardcoded special case.
				// If a column name ends with "_meta", we always assume that it is JSON and
				// parse it as such.
				if (columnNames[c].endsWith('_meta')) {
					if (!row[c]) {
						result[columnNames[c]] = null;
						continue;
					}

					try {
						result[columnNames[c]] = JSON.parse(row[c]);
					} catch (err) {
						log.error(`Failed to parse JSON from row ${rowNum + 1}, column ${c} (${row[c]}):\n`,
							err.stack ? err.stack : err);
					}
					continue;
				}

				// Since most data in a Google Spreadsheet comes in as a string, we
				// must cast it to the right type based on the options provided.
				if (importerOptions.casts.integer.includes(columnNames[c])) {
					result[columnNames[c]] = parseInt(row[c], 10);
					if (isNaN(result[columnNames[c]])) {
						result[columnNames[c]] = 0;
					}
				} else if (importerOptions.casts.float.includes(columnNames[c])) {
					result[columnNames[c]] = parseFloat(row[c]);
					if (isNaN(result[columnNames[c]])) {
						result[columnNames[c]] = 0;
					}
				} else {
					result[columnNames[c]] = typeof row[c] === 'undefined' ? '' : row[c];
				}
			}

			return result;
		});
	});

	// Make it so that non-team games don't explode this code.
	formattedData.teams = formattedData.teams || [];

	// This is pretty inefficient and I could be saving cycles here if necessary.
	// For now, this gets the job done.
	const teamsById = {};
	formattedData.teams.forEach(team => {
		team.roster = [];
		teamsById[team.id] = team;
	});

	// Do two things at once:
	// 1) Remove players whom do not have a valid team id.
	// 2) Add players to their team's roster.
	formattedData.players = formattedData.players.filter(player => {
		if (teamsById[player.team_id]) {
			teamsById[player.team_id].roster.push(player);
			return true;
		}

		return false;
	});

	return formattedData;
};

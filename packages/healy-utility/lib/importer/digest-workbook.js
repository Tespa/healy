'use strict';

// Packages
const _snakeCase = require('lodash.snakecase');

// Ours
const importerOptions = require('../util/options').get();
const nodecg = require('../util/nodecg-api-context').get();

const log = new nodecg.Logger('healy');

module.exports = function (workbook) {
	const formattedData = {
		_metadata: workbook.metadata
	};

	workbook.sheets.forEach(sheet => {
		// Ignore "private" sheets (ones beginning with an underscore).
		if (sheet.name.startsWith('_')) {
			return;
		}

		// Ignore empty sheets.
		if (!sheet.values[0]) {
			formattedData[_snakeCase(sheet.name)] = [];
			return;
		}

		// Normalize all column names to snake_case.
		const columnNames = sheet.values[0].map(columnName => {
			// Ignore "private" columns (ones beginning with an underscore).
			if (columnName && columnName.startsWith('_')) {
				return columnName;
			}

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
				// Ignore columns with no title.
				if (columnNames[c] === '') {
					continue;
				}

				// Ignore columns which start with '_', which are private columns used internally by the sheet.
				if (columnNames[c] && columnNames[c].startsWith('_')) {
					continue;
				}

				// This is currently a hardcoded special case.
				// If a column name ends with "_meta", we always assume that it is JSON and
				// parse it as such.
				if (columnNames[c].endsWith('_meta')) {
					if (!row[c]) {
						result[columnNames[c]] = null;
						continue;
					}

					if (row[c] === 'NOT_FOUND') {
						result[columnNames[c]] = null;
						continue;
					}

					try {
						result[columnNames[c]] = JSON.parse(row[c]);
					} catch (err) {
						log.error(`Failed to parse JSON from row ${rowNum + 1}, column ${c}, in sheet "${sheet.name}" (${row[c]}):\n`,
							err.stack ? err.stack : err);
					}
					continue;
				}

				// Since most data in a Google Spreadsheet comes in as a string, we
				// must cast it to the right type based on the options provided.
				if (importerOptions.casts.integerNoCoercion &&
					importerOptions.casts.integerNoCoercion.includes(columnNames[c])) {
					result[columnNames[c]] = parseInt(row[c], 10);
				} else if (importerOptions.casts.floatNoCoercion &&
					importerOptions.casts.floatNoCoercion.includes(columnNames[c])) {
					result[columnNames[c]] = parseFloat(row[c]);
				} else if (importerOptions.casts.integer &&
					importerOptions.casts.integer.includes(columnNames[c])) {
					result[columnNames[c]] = parseInt(row[c], 10);
					if (isNaN(result[columnNames[c]])) {
						result[columnNames[c]] = 0;
					}
				} else if (importerOptions.casts.float &&
					importerOptions.casts.float.includes(columnNames[c])) {
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

	// Process teams and players.
	const {formattedTeams, formattedPlayers} = processTeamsAndPlayers(formattedData.teams, formattedData.players);
	formattedData.teams = formattedTeams;
	formattedData.players = formattedPlayers;

	if (formattedData.ticker) {
		// Process ticker data.
		const tickerRows = formattedData.ticker;
		formattedData.ticker = [];
		tickerRows.forEach(row => {
			let group = formattedData.ticker.find(group => group.id === row.group);
			if (!group) {
				group = {id: row.group, items: []};
				formattedData.ticker.push(group);
			}

			group.items.push(row);
		});
	}

	// Return the final set of formatted data.
	return formattedData;
};

/**
 * Translates team and player data from the Integration Sheet format into the Irvine Framework format.
 * @param inputTeams {Array}
 * @param inputPlayers {Array}
 * @returns {{formattedTeams: Array, formattedPlayers: Array}}
 */
function processTeamsAndPlayers(inputTeams, inputPlayers) {
	const outputTeams = inputTeams.slice(0);
	let outputPlayers = [];

	const teamsById = {};
	inputTeams.forEach(team => {
		team.entrantType = 'team';
		team.entrantIdPath = 'id';
		team.entrantLabelPath = 'name_short';
		team.roster = [];
		teamsById[team.id] = team;
	});

	// Do two things at once:
	// 1) Remove players whom do not have a valid team id.
	// 2) Add players to their team's roster.
	if (inputPlayers) {
		outputPlayers = inputPlayers.filter(player => {
			player.entrantType = 'player';
			player.entrantIdPath = 'user_id';
			player.entrantLabelPath = 'handle';
			if (teamsById[player.team_id]) {
				teamsById[player.team_id].roster.push(player);
				return true;
			}

			return false;
		});
	}

	return {
		formattedTeams: outputTeams,
		formattedPlayers: outputPlayers
	};
}

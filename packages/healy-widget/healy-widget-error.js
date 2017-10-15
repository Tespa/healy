class HealyWidgetError extends Polymer.MutableData(Polymer.Element) {
	static get is() {
		return 'healy-widget-error';
	}

	static get properties() {
		return {
			error: Object,
			category: String,
			source: String
		};
	}

	_calcMessage(error, category, source) {
		if (category === 'validationErrors') {
			return this._formatValidationError(error);
		} else if (category === 'imageErrors') {
			return this._formatImageError(error, source);
		}

		nodecg.log.error('Unexpected error type "%s" from source "%s" with data:', category, source, error);
	}

	_formatValidationError({id, columnName, sheetName, metaColumnName, validatorError}) {
		let str = `<pre>${sheetName}</pre> Sheet: `;
		let appendID = true;
		const formattedValue = validatorError.value === '' ? '(empty string)' : validatorError.value;

		if (validatorError.message === 'is the wrong type') {
			const type = Array.isArray(validatorError.value) ? 'array' : typeof validatorError.value;
			str += `Column <pre>${columnName}</pre> has value of <pre>${formattedValue}</pre>, ` +
				`which is a: <pre>${type}</pre>. Expected a: <pre>${validatorError.type}</pre>.`;
		} else if (validatorError.message === 'has additional properties') {
			str += `Row with ID <pre>${id}</pre> has these additional properties: <pre>${validatorError.value.replace(/^data\./g, '')}</pre>.`;
			appendID = false;
		} else if (validatorError.message === 'is required') {
			if (metaColumnName) {
				str += `Column <pre>${metaColumnName}.${columnName}</pre> is required.`;
			} else {
				str += `Column <pre>${columnName}</pre> is required.`;
			}
		} else {
			if (columnName && !metaColumnName) {
				str += `Column <pre>${columnName}</pre> `;
			}
			str += validatorError.message;
		}

		if (appendID && id !== 'Unknown') {
			str += ` (ID: <pre>${id}</pre>)`;
		}

		return str;
	}

	_formatImageError({fileName, error}, source) {
		let msg;
		const pre = source === 'googleDrive' ?
			`<a href="https://drive.google.com/open?id=${fileName}" target="_blank"><pre>${fileName}</pre></a>` :
			`<pre>${fileName}</pre>`;

		if (error.message.startsWith('Team logo image')) {
			msg = `Team logo image ${pre} is not an export from the Photoshop template.`;
		} else if (error.code === 404) {
			msg = `404 file not found: ${pre}`;
		} else {
			msg = `${pre} ${error.message}`;
		}

		return msg;
	}
}

customElements.define(HealyWidgetError.is, HealyWidgetError);

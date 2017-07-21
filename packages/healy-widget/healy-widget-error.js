class HealyWidgetError extends Polymer.MutableData(Polymer.Element) {
	static get is() {
		return 'healy-widget-error';
	}

	static get properties() {
		return {
			error: Object
		};
	}

	_calcMessage({type, data}) {
		if (type === 'validationError') {
			return this._formatValidationError(data);
		}

		nodecg.log.error('Unexpected error type "%s" with data:', type, data);
	}

	_formatValidationError({id, columnName, sheetName, metaColumnName, validatorError}) {
		let str = `<pre>${sheetName}</pre> Sheet: `;
		let appendID = true;
		const formattedValue = validatorError.value === '' ? '(empty string)' : validatorError.value;

		if (validatorError.message === 'is the wrong type') {
			str += `Column <pre>${columnName}</pre> has value of <pre>${formattedValue}</pre>, ` +
				`which is a: <pre>${typeof validatorError.value}</pre>. Expected a: <pre>${validatorError.type}</pre>.`;
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
			str += validatorError.message;
		}

		if (appendID) {
			str += ` (ID: <pre>${id}</pre>)`;
		}

		return str;
	}
}

customElements.define(HealyWidgetError.is, HealyWidgetError);

class HealyWidgetError extends Polymer.MutableData(Polymer.Element) {
	static get is() {
		return 'healy-widget-error';
	}

	static get properties() {
		return {
			error: Object
		};
	}

	_calcMessage({id, message, value, columnName, sheetName, type}) {
		let str = `<pre>${sheetName}</pre> Sheet: `;
		const formattedValue = value === '' ? '(empty string)' : value;

		if (message === 'is the wrong type') {
			str += `Column <pre>${columnName}</pre> has value of <pre>${formattedValue}</pre>, ` +
					`which is a: <pre>${typeof value}</pre>. Expected a: <pre>${type}</pre>.`;
		} else if (message === 'has additional properties') {
			return `Has these additional properties: <pre>${value.replace(/^data\./g, '')}</pre>.`;
		} else if (message === 'is required') {
			return `Column <pre>${columnName}</pre> is required.`;
		} else {
			str += message;
		}

		str += ` (Row ID: <pre>${id}</pre>)`;
		return str;
	}
}

customElements.define(HealyWidgetError.is, HealyWidgetError);

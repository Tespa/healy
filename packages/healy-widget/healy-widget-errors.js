class HealyWidgetErrors extends Polymer.Element {
	static get is() {
		return 'healy-widget-errors';
	}

	static get properties() {
		return {
			hasErrors: {
				type: Boolean,
				reflectToAttribute: true,
				computed: '_computeHasErrors(errors.*)'
			},
			categoryName: String,
			categoryLabel: String,
			errors: Array,
			collapseOpened: {
				type: Boolean,
				value: true
			},
			source: String
		};
	}

	toggleCollapse() {
		this.$.collapse.toggle();
	}

	_computeHasErrors() {
		return this.errors && this.errors.length > 0;
	}
}

customElements.define(HealyWidgetErrors.is, HealyWidgetErrors);

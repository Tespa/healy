class HealyWidgetStatus extends Polymer.MutableData(Polymer.Element) {
	static get is() {
		return 'healy-widget-status';
	}

	static get properties() {
		return {
			importPath: String, // https://github.com/Polymer/polymer-linter/issues/71
			metadata: Object,
			timeToNextPoll: String,
			timeSinceLastModified: String,
			timeSinceLastPoll: String
		};
	}

	ready() {
		super.ready();
		this._updateGoogleSheetImportStatus = this._updateGoogleSheetImportStatus.bind(this);
		this._updateGoogleSheetImportStatus();
	}

	formatSeconds(seconds) {
		const hms = {
			h: Math.floor(seconds / 3600),
			m: Math.floor(seconds % 3600 / 60),
			s: Math.floor(seconds % 3600 % 60)
		};

		let str = '';
		if (hms.h) {
			str += `${hms.h}h `;
		}

		str += `${hms.m}m ${(hms.s < 10 ? `0${hms.s}` : hms.s)}s`;
		return str;
	}

	manualUpdate() {
		nodecg.sendMessage('importer:immediatelyPollGoogleSheet');
	}

	formatDate(timestamp) {
		return new Date(timestamp).toLocaleString('en-US', {
			month: 'long',
			day: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	_updateGoogleSheetImportStatus() {
		requestAnimationFrame(this._updateGoogleSheetImportStatus);

		if (!this.metadata) {
			return;
		}

		if (this.metadata.modifiedTime) {
			this.timeSinceLastModified = this.formatSeconds((Date.now() - this.metadata.modifiedTime) / 1000);
		}

		if (this.metadata.lastPollTime) {
			const secondsSinceLastPoll = (Date.now() - this.metadata.lastPollTime) / 1000;
			const secondsToNextPoll = Math.max(60 - secondsSinceLastPoll + 1, 0); // The +1 is needed due to how the math here works.
			this.$['meter-fill'].style.transform = `scaleX(${Math.min(secondsSinceLastPoll / 60, 1)})`;
			this.timeToNextPoll = this.formatSeconds(secondsToNextPoll);
			this.timeSinceLastPoll = this.formatSeconds(secondsSinceLastPoll);
		}
	}

	_calcImportStatusHidden(metadata) {
		return !metadata || !metadata.source || metadata.source === 'none';
	}

	_calcSourceIconSrc(source, importerErrors) {
		if (importerErrors && importerErrors.length > 0) {
			return `${this.importPath}img/error.svg`;
		}

		switch (source) {
			case 'googleDrive':
				return `${this.importPath}img/google-icon.svg`;
			case 'zip':
				return `${this.importPath}img/zip-icon.svg`;
			default:
				return `${this.importPath}img/none-icon.svg`;
		}
	}

	_calcTopHtml(metadata) {
		switch (metadata.source) {
			case 'googleDrive':
				return `Google Sheet: <b style="color: #5BA664;" title="${metadata.title}">${metadata.title}</b>`;
			case 'zip':
				return `Uploaded ZIP: <b style="color: #5BA664;" title="${metadata.title}">${metadata.title}</b>`;
			default:
				return '<b style="#FF9C00">No Data Source</b>';
		}
	}

	_calcBottomText(metadata, importerErrors) {
		if (importerErrors && importerErrors.length > 0) {
			return `Current Status: ${importerErrors.length} Errors`;
		}

		switch (metadata.source) {
			case 'googleDrive':
			case 'zip':
				return 'Current Status: Imported';
			default:
				return 'Upload ZIP or link Google Sheet';
		}
	}

	_calcSelectedPage(metadata, importerErrors) {
		if (importerErrors && importerErrors.length > 0) {
			return 'errors';
		}

		return (metadata && metadata.source) ? metadata.source : 'none';
	}
}

customElements.define(HealyWidgetStatus.is, HealyWidgetStatus);

(function () {
	'use strict';

	class HealyWidget extends Polymer.MutableData(Polymer.Element) {
		static get is() {
			return 'healy-widget';
		}

		static get properties() {
			return {
				importing: {
					type: Boolean,
					value: false,
					reflectToAttribute: true
				},
				metadata: Object,
				zipUploadUrl: {
					type: String,
					value: `/${nodecg.bundleName}/import_project`
				},
				_reprocessArmed: {
					type: Boolean,
					value: false
				},
				_clearArmed: {
					type: Boolean,
					value: false
				}
			};
		}

		_onUploadRequest(event) {
			event.detail.formData.append('lastModified', event.detail.file.lastModified);
		}

		openActionsDialog() {
			return this.$.actionsDialog.open();
		}

		ready() {
			super.ready();

			Polymer.RenderStatus.beforeNextRender(this, () => {
				this.$.upload.$.addButton.raised = true;
				this.$.upload.$.addButton.innerText = 'Upload .ZIP';

				this.$.upload.addEventListener('file-reject', event => {
					this.$.toast.show(event.detail.file.name + ' error: ' + event.detail.error);
				});

				this.$.upload.addEventListener('upload-error', event => {
					this.$.toast.show(`Error importing "${event.detail.file.name}", check server logs for more info.`);
				});

				this.$.upload.addEventListener('upload-success', event => {
					this.$.toast.show(`Successfully imported "${event.detail.file.name}"!`);
				});
			});
		}

		take() {
			this.importing = true;
			nodecg.sendMessage('importer:loadGoogleSheet', this.$.urlInput.value, (errMsg, response) => {
				this.importing = false;

				if (errMsg) {
					switch (errMsg) {
						default:
							this.$.toast.show(`Error loading sheet: ${errMsg}`);
					}

					if (errMsg.startsWith('Invalid value for replicant')) {
						this.$.toast.show(`Error loading sheet! Sheet "${response.title}" is in an unexpected format.`);
					}

					console.info('Sheet load error printed below:');
					console.error(errMsg);
					return;
				}

				this.$.toast.show(`Successfully loaded sheet "${response.title}".`);
			});
		}

		_calcGoogleImportButtonDisabled(importing, urlInputValue) {
			return importing || !urlInputValue;
		}

		_calcReprocessCacheButtonText(_reprocessArmed) {
			return _reprocessArmed ? 'Click Again To Confirm' : 'Re-Process Image Cache';
		}

		_calcClearCacheButtonText(_clearArmed) {
			return _clearArmed ? 'Click Again To Confirm' : 'Clear Image Cache';
		}

		_handleReprocessCacheTap() {
			if (this._reprocessArmed) {
				nodecg.sendMessage('importer:reprocessImages');
				this.$.actionsDialog.close();
			} else {
				this._reprocessArmed = true;
			}
		}

		_handleClearCacheTap() {
			if (this._clearArmed) {
				nodecg.sendMessage('importer:clearCache');
				this.$.actionsDialog.close();
			} else {
				this._clearArmed = true;
			}
		}

		_handleActionsDialogClosed() {
			this._reprocessArmed = false;
			this._clearArmed = false;
		}

		_calcCoverHidden(metadata) {
			if (!metadata) {
				return true;
			}

			return !metadata.clearing && !metadata.reprocessing;
		}

		_calcCoverMessage(metadata) {
			if (!metadata) {
				return '';
			}

			if (metadata.clearing) {
				return 'Clearing image cache...';
			}

			if (metadata.reprocessing) {
				return 'Reprocessing image cache...';
			}

			return '';
		}
	}

	customElements.define(HealyWidget.is, HealyWidget);
})();

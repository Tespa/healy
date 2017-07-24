// Native
const path = require('path');

// Packages
const BB = require('bluebird');
const serializeError = require('serialize-error');
const streamBuffers = require('stream-buffers');
const xlsx = require('xlsx');
const yauzl = require('yauzl');

// Ours
const addToCache = require('../cache/add-to-cache');
const computeHash = require('../util/compute-hash');
const digestWorkbook = require('./digest-workbook');
const importerOptions = require('../util/options').get();
const nodecg = require('../util/nodecg-api-context').get();
const replicants = require('../util/replicants');

const log = new nodecg.Logger('healy:zip');

yauzl.openPromise = BB.promisify(yauzl.open);
module.exports = ingestZip;

async function ingestZip({zipPath, lastModified, originalName}) {
	const modifiedTime = parseInt(lastModified, 10);
	const imageErrors = [];
	const zipfile = await yauzl.openPromise(zipPath, {lazyEntries: true});
	let workbook;
	let project;

	return new Promise((resolve, reject) => {
		// Handle each entry in the zipfile.
		zipfile.on('entry', entry => {
			if (/\/$/.test(entry.fileName)) {
				// Directory file names end with '/'.
				// We do nothing with directories themselves, we only care about their contents.
				return zipfile.readEntry();
			}

			// File entry
			// TODO: hardening and error trapping
			zipfile.openReadStream(entry, (err, readStream) => {
				if (err) {
					// TODO: this specifically needs to be handled better.
					return reject(err);
				}

				if (entry.fileName.endsWith('.xlsx')) {
					if (workbook) {
						log.error(`Found more than one workbook in project .zip! Ignoring workbook "${entry.fileName}".`);
						return;
					}

					log.info('Digesting workbook:', entry.fileName);
					streamToBuffer(readStream).then(({buffer}) => {
						workbook = xlsx.read(buffer);
						project = digestWorkbook({
							metadata: {
								title: originalName,
								id: null,
								url: null,
								modifiedTime,
								lastPollTime: Date.now(),
								source: 'zip'
							},
							sheets: workbook.SheetNames.map(name => {
								return {
									name,

									// Counter-intuitively, `header: 1` means: just give me a raw array of arrays.
									values: xlsx.utils.sheet_to_json(workbook.Sheets[name], {header: 1})
								};
							})
						});

						zipfile.readEntry();
					}).catch(error => {
						// TODO: this probably needs special handling too?
						reject(error);
					});
				} else {
					cacheImageFromZip(entry, readStream).then(() => {
						zipfile.readEntry();
					}).catch(error => {
						imageErrors.push({
							fileName: entry.fileName,
							error: serializeError(error)
						});
						zipfile.readEntry();
					});
				}
			});
		});

		// Read the first entry, which will then invoke
		// a loop of read-process-read-process, etc.
		zipfile.readEntry();

		// Handle the end of the zip.
		zipfile.once('end', () => {
			zipfile.close();
			replicants.errors.value.imageErrors = imageErrors;
			resolve(project);
		});
	});
}

async function cacheImageFromZip(entry, readStream) {
	const parsedFileName = path.parse(entry.fileName);
	const dir = parsedFileName.dir;
	const bottomFolder = dir.split('/').pop();

	if (importerOptions.zipImageProcessingJobs) {
		let processor;
		Object.keys(importerOptions.zipImageProcessingJobs).some(jobName => {
			if (bottomFolder === jobName) {
				processor = importerOptions.zipImageProcessingJobs[jobName];
				return true;
			}

			return false;
		});

		if (processor) {
			const {buffer, hash} = await streamToBuffer(readStream);
			return addToCache(buffer, {fileName: entry.fileName, hash, processor});
		}
	}

	return new Promise((resolve, reject) => {
		addToCache.stream(readStream).on('finish', () => {
			resolve();
		}).on('error', error => {
			reject(error);
		});
	});
}

function streamToBuffer(readableStream) {
	const writableStreamBuffer = new streamBuffers.WritableStreamBuffer({
		initialSize: (100 * 1024), // Start at 100 kilobytes.
		incrementAmount: (100 * 1024) // Grow by 100 kilobytes each time buffer overflows.
	});

	return new Promise((resolve, reject) => {
		readableStream.pipe(writableStreamBuffer);

		let errored = false;
		readableStream.once('error', error => {
			errored = true;
			reject(error);
		});

		readableStream.on('end', () => {
			if (errored) {
				return;
			}

			writableStreamBuffer.end();
			const buffer = writableStreamBuffer.getContents();
			resolve({
				buffer,
				hash: computeHash(buffer)
			});
		});
	});
}

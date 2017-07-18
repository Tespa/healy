// Native
const path = require('path');

// Packages
const app = require('express')();
const BB = require('bluebird');
const EventEmitter = require('events');
const multer = require('multer');
const streamBuffers = require('stream-buffers');
const xlsx = require('xlsx');
const yauzl = require('yauzl');

// NodeCG
// Bit hacky, this is loading one of NodeCG's own lib files.
const authCheck = require(path.resolve('lib/util/index')).authCheck;

// Ours
const addToCache = require('../cache/add-to-cache');
const computeHash = require('../util/compute-hash');
const digestWorkbook = require('./digest-workbook');
const importerOptions = require('../util/options').get();
const nodecg = require('../util/nodecg-api-context').get();

const emitter = new EventEmitter();
const log = new nodecg.Logger('healy:zip');
const upload = multer({
	storage: multer.diskStorage({}),
	fileSize: 1000000 * 128 // 128 MB
});

yauzl.openPromise = BB.promisify(yauzl.open);
module.exports = emitter;

app.post(`/${nodecg.bundleName}/import_project`,
	// First, check if the user is authorized.
	authCheck,

	// Then, receive the uploaded file.
	upload.single('file'),

	// Finally, process the file and send a response.
	async (req, res) => {
		if (!req.file) {
			res.status(400).send('Bad Request');
			log.warn('Bad zip upload request; no file data was found. Ignoring.');
			return;
		}

		try {
			emitter.emit('importStarted');
			const modifiedTime = parseInt(req.body.lastModified, 10);
			const zipfile = await yauzl.openPromise(req.file.path, {lazyEntries: true});
			let workbook;
			let project;

			// Read the first entry, which will then invoke
			// a loop of read-process-read-process, etc.
			zipfile.readEntry();

			// Handle each entry in the zipfile.
			zipfile.on('entry', entry => {
				if (/\/$/.test(entry.fileName)) {
					// Directory file names end with '/'.
					// We do nothing with directories themselves, we only care about their contents.
					return zipfile.readEntry();
				}

				// File entry
				// TODO: hardening and error trapping
				zipfile.openReadStream(entry, async (err, readStream) => {
					if (err) {
						throw err;
					}

					if (entry.fileName.endsWith('.xlsx')) {
						if (workbook) {
							log.error(`Found more than one workbook in project .zip! Ignoring workbook "${entry.fileName}".`);
							return;
						}

						const writableStreamBuffer = new streamBuffers.WritableStreamBuffer({
							initialSize: (100 * 1024), // Start at 100 kilobytes.
							incrementAmount: (10 * 1024) // Grow by 10 kilobytes each time buffer overflows.
						});

						readStream.pipe(writableStreamBuffer);
						readStream.on('end', async () => {
							writableStreamBuffer.end();

							log.info('Digesting workbook:', entry.fileName);
							workbook = xlsx.read(writableStreamBuffer.getContents());
							project = digestWorkbook({
								metadata: {
									title: req.file.originalname,
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
						});
					} else {
						try {
							await cacheImageFromZip(entry, readStream);
						} catch (error) {
							log.error('Error caching image "%s" from zip:\n',
								entry.fileName, (error && error.stack) ? error.stack : error);
						}

						zipfile.readEntry();
					}
				});
			});

			zipfile.once('end', () => {
				zipfile.close();
				emitter.emit('projectImported', project);
				res.status(200).send('Success');
			});
		} catch (err) {
			res.status(500).send('Internal Server Error');
			log.warn('Error importing %s:\n', req.file.originalname, err.stack);
		}
	}
);

async function cacheImageFromZip(entry, readStream) {
	const parsedFileName = path.parse(entry.fileName);
	const dir = parsedFileName.dir;
	const bottomFolder = dir.split('/').pop();

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
		return processor({buffer, hash, fileName: entry.fileName});
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
		incrementAmount: (10 * 1024) // Grow by 10 kilobytes each time buffer overflows.
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

nodecg.mount(app);

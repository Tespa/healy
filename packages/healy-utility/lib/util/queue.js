// Packages
const PQueue = require('p-queue');

const queue = new PQueue({concurrency: 1});
module.exports = queue;

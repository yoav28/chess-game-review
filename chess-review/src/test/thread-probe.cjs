const workerThreads = require('node:worker_threads')
const NativeWorker = workerThreads.Worker
workerThreads.Worker = class extends NativeWorker {
  constructor(file, options) {
    super(file, options)
    if (options?.workerData === 'em-pthread') process.stdout.write('info string open-file-probe worker-created\n')
  }
}

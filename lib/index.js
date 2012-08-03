var childProcess = require('child_process'),
    events = require('events'),    
    os = require('os'),    
    util = require('util');


WorkerState = {
    STARTING: 'STARTING',
    READY:    'READY',
    BUSY:     'BUSY'
};
module.exports.WorkerState = WorkerState;

/**
 * Encapsulates a worker process. Manages state and notifying listeners of 
 * changes in state.
 */
function Worker(workerScript) {
    this.process = childProcess.fork(workerScript);
    this.pid = this.process.pid;    
    this.status = WorkerState.STARTING;

    this.process.once('message', this.onReady.bind(this));

    events.EventEmitter.call(this);
}
util.inherits(Worker, events.EventEmitter);

Worker.prototype.onReady = function (message) {
    if (this.status === WorkerState.STARTING) {
        console.log('Worker ' + this.pid + ' ready.');
        this.status = WorkerState.READY;
        this.emit('ready', this);
    }
};

Worker.prototype.onMessage = function (callback, message) {
    callback(message);

    this.status = WorkerState.READY;
    this.emit('ready', this);    
};

Worker.prototype.send = function (message, callback) {
    this.status = WorkerState.BUSY;
    this.emit('busy');

    this.process.once('message', this.onMessage.bind(this, callback));
    this.process.send(message);
};
module.exports.Worker = Worker;


function WorkQueue(workerScript, nWorkers) {
    this.workers = [];
    this.queue = [];

    var self = this;
    function fork() {    
        var worker = new Worker(workerScript);

        worker.on('ready', self._run.bind(self));

        worker.process.on('exit', function (code, signal) {
            if (code !== 0) { // Code will be non-zero if process dies suddenly
                console.warn('Worker process ' + worker.pid + ' died. Respawning...');
                for (var i = 0; i < self.workers.length; i++) {
                    if (self.workers[i].pid === worker.pid) {
                        self.workers.splice(i, 1); // Remove dead worker from pool.
                    }
                }            
                fork(); // FTW!
            }
        });

        self.workers.push(worker);
    } 

    nWorkers = nWorkers || os.cpus().length;
    console.log('Starting ' + nWorkers + ' workers..');
    for (var i = 0; i < nWorkers; i++) {
        fork();
    }
}

/**
 * Enqueue a task for a worker process to handle. A task can be any type of var,
 * as long your worker script knows what to do with it.
 */
WorkQueue.prototype.enqueue = function (task, callback) {
    this.queue.push({ task: task, callback: callback });
    process.nextTick(this._run.bind(this));
};

WorkQueue.prototype._run = function (worker) {    
    if (this.queue.length === 0) {
        return; // nothing to do
    } 

    if (!worker) {        
        // Find the first available worker. 
        for (var i = 0; i < this.workers.length; i++) {        
            if (this.workers[i].status === WorkerState.READY) {
                worker = this.workers[i];            
                break;
            }
        }
    }

    if (!worker) {        
        return; // there are no workers available to handle requests. Leave queue as is.
    }

    var queued = this.queue.shift(); 
    worker.send(queued.task, queued.callback);   
};
module.exports.WorkQueue = WorkQueue;

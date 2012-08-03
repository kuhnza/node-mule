Mule.js
=======

Mule is a work queue for CPU intensive tasks. You can use it to offload tasks
that would otherwise kill your fast, responsive event loop. It's a bit like
[Threads A GoGo](https://github.com/xk/node-threads-a-gogo/), except using 
processes not threads.

Mule works by using node's [child_process.fork()](http://nodejs.org/api/child_process.html#child_process_child_process_fork_modulepath_args_options) 
method to pre-fork a bunch of processes using a script you define. It sets up 
a task queue to which you can push blocking tasks onto and listen for the 
result. As worker processes become available they alert the work queue that 
they're ready to accept more work. Tasks are sent and results received using 
node's inbuilt IPC for forked node processes.

We currently use this in production at [Hubify](http://hubify.com) at reasonable 
scale so it should be fairly bulletproof. That being said, if you notice anything 
unusual (or how we can make it better) please raise a new issue. 

Installation
------------

```
npm install mule
```

Then to get up and running:

```javascript
var WorkQueue = require('mule').WorkQueue;

var workQueue = new WorkQueue(__dirname + '/worker.js');
workQueue.enqueue('some data for worker to process', function (result) {
    // do something with result
});
```

Contrived Example
-----------------

Imagine you have a node process which needs to stay responsive to web requests,
user input or whatever. However it has some heavy CPU intensive work to do 
calculating fibonacci numbers. Here's how mule can help unburden your poor 
server:

**parent.js**
```javascript
var WorkQueue = require('mule').WorkQueue;

var workQueue = new WorkQueue(__dirname + '/worker.js');

// Generate a series of fibonacci numbers using the work queue to avoid blocking.
var waiting = 100;
for (var i = 1; i <= 100; i++) {
	// Generate random number to calculate a fibonacci sequence on
	var n = Math.floor(Math.random() * 40) + 1;

	// Wrap in anonymous function so we still have access to i & n
	(function (i, n) {
		workQueue.enqueue(n, function (result) {
			console.log(i + ': fibo(' + n + ') = ' + result);

			if (--waiting === 0) {
				// All jobs are complete so we can safely exit
				console.log('\nDone.')
				process.exit(0);
			}
		});
	})(i, n);	
}

console.log('See, no blocking!');
```

**worker.js**
```javascript
/**
 * Calculate a Fibonacci number. Note that if you ran this in the main event 
 * loop it would block. 
 */ 
function fibo (n) {
	return n > 1 ? fibo(n - 1) + fibo(n - 2) : 1;
}

// This is where we accept tasks given to us from the parent process.
process.on('message', function (message) {
	// Do some CPU intensive calculations with the number passed.
	var result = fibo(message);

	// Send the result back to the parent process when done.
	process.send(result);
});

/* Send ready signal so parent knows we're ready to accept tasks. This should
 * always be the last line of your worker process script. */
process.send('READY');
```

The worker script is nothing special and can really be anything imaginable. Best
of all it's okay to write blocking code in the workers. It's what they're
there for. 

There are some important things to note however:
# Always include final line in the example worker above. Without it the parent 
process won't know that the worker has started successfully. Also ensure that it's
the very last thing to execute upon initialization so that you can confidently 
send tasks to it knowing that everything is ready and in place. If you have async
initialization code you should ensure that 'READY' is called after all async init 
code has completed.
# process.on('message'... must be present in order to receive jobs from the parent.
# process.send(result) must also be present as the final step of your processing
to send back the result and notify the parent process that the worker is ready for
more work.


Controlling the Number of Workers
---------------------------------

Defining the number of worker processes you desire is easy. Simply pass a positive 
integer as the second argument to WorkQueue like so:

```javascript
var nWorkers = 4,
    workQueue = new WorkQueue('/path/to/worker.js', nWorkers);
```

By default mule chooses the number of worker processes based on the number of CPU
cores available (via os.cpus().length). This is generally the most performant 
option, though depending on the task your mileage may vary.



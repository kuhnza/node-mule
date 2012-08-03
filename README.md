Mule.js
=======

Mule is a work queue for CPU intensive tasks. You can use it to offload tasks
that would otherwise kill your fast, responsive event loop. It's a bit like
threads a gogo, except using processes not threads.

Mule works by using node's child_process.fork() method to pre-fork a bunch of 
processes using a script you define. It sets up a task queue to which you can 
push blocking tasks onto and listen for the result. As worker processes become
available they alert the work queue that they're ready to accept more work. 
Tasks are sent and results received using node's inbuilt IPC for forked node
processes.

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

And here's the worker:

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


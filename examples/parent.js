var WorkQueue = require(__dirname + '/../lib/index').WorkQueue;

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
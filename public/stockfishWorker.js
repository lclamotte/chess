// Stockfish Web Worker wrapper
// This worker communicates with the main thread via postMessage

let stockfish = null;

// Handle messages from main thread
self.onmessage = function (e) {
    const { command } = e.data;

    if (command) {
        if (stockfish) {
            stockfish.postMessage(command);
        }
    }
};

// The stockfish.js file from the npm package runs in web worker mode
// and just needs UCI commands sent via postMessage
// We're loading it by having this file import-scripts it

try {
    // Import the stockfish module
    self.importScripts('/stockfish.js');

    // stockfish.js sets itself up as a worker that accepts UCI commands directly
    // So we just relay messages back and forth

    // For stockfish.js 17+, we just send commands directly to self
    // The engine will respond via the same channel

    // Tell the main thread we're ready
    self.postMessage({ type: 'ready' });

    // Override postMessage to intercept Stockfish outputs
    const originalPostMessage = self.postMessage.bind(self);

    // Stockfish outputs go through the default worker message channel
    // We need to wrap them in our format

} catch (err) {
    self.postMessage({ type: 'error', data: err.message });
}

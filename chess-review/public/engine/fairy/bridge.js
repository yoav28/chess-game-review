const pending = []
let engine
self.onmessage = event => {
  if (engine) engine.postMessage(String(event.data))
  else pending.push(String(event.data))
}
if (typeof SharedArrayBuffer === 'undefined') {
  self.postMessage('engineerror Three-check analysis requires WebAssembly threads and cross-origin isolation.')
} else {
  try {
    importScripts('stockfish.js')
    const root = new URL('.', self.location.href)
    Stockfish({ locateFile: name => new URL(name, root).href, mainScriptUrlOrBlob: new URL('stockfish.js', root).href })
      .then(instance => {
        engine = instance
        engine.addMessageListener(line => self.postMessage(line))
        for (const message of pending) engine.postMessage(message)
        pending.length = 0
      }).catch(error => self.postMessage(`engineerror ${error.message || 'The three-check engine could not start.'}`))
  } catch (error) { self.postMessage(`engineerror ${error.message || 'The three-check engine could not load.'}`) }
}

const WebSocket = require("ws");

const wss = new WebSocket.WebSocketServer({ port: 4000 }); // wss://nodeval-dev-server.bddy.repl.co:9000

wss.on('connection', (ws, req) => {
  let govalws = new Websocket("https://hacker.eval.replit.com/")
})
const { WebSocketServer } = require("ws");
const { api } = require("@replit/protocol");

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", async function connection(ws) {
  console.log("Connection established.");
  ws.on("error", console.error);

  ws.on("message", function message(data) {
    // decode the message
    let msg = api.Command.decode(data);
    if (!msg.ping) console.log(msg);

    if (msg.ping) {
      let _pong = new api.Command({ channel: 0, ref: msg.ref, pong: {} });
      ws.send(api.Command.encode(_pong).finish());
    }
  });

  let _cs = new api.Command();
  _cs.containerState = new api.ContainerState();
  _cs.containerState.state = api.ContainerState.State.READY;

  await ws.send(api.Command.encode(_cs).finish());

  let _welcome = new api.Command({
    channel: 0,
    toast: { text: "Welcome to Nodeval! © bddylol 2023" }
  });
  await ws.send(api.Command.encode(_welcome).finish());
});

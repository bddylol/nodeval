const { WebSocketServer } = require("ws");
const { api } = require("@replit/protocol");
const fs = require('node:fs/promises');
const path = require('node:path')

const wss = new WebSocketServer({ port: 4000 }); // wss://nodeval-dev-server.bddy.repl.co:9000

function sendToast(ws, text) {
	let toast = new api.Command({
		channel: 0,
		toast: { text }
	});

	ws.send(api.Command.encode(toast).finish());
}

function handleOTs(str, ots) {
	let cursorPos = 0;

	for (let ot of ots) {
		if (ot.skip) {
			if (cursorPos + ot.skip > str.length) {
				throw new Error("Illegal OT skip")
			}

			cursorPos += ot.skip
			continue;
		}

		if (ot.delete) {
			if (cursorPos + ot.delete > str.length) {
				return false;
			};

			let astr = str.split('')

			astr.splice(cursorPos, ot.delete)

			str = astr.join('')
			continue;
		}

		if (ot.insert) {
			let astr = str.split('')

			astr.splice(cursorPos, 0, ot.insert)

			cursorPos += ot.insert.length

			str = astr.join('');
			continue;
		}
	}
	return str
}

async function sendFiles(ws, msg) {
	let files = await fs.readdir(path.join(__dirname, "files", msg.readdir?.path || ""))

	files = await Promise.all(
		files.map(async file => ({
			path: file,
			...(
				(
					await fs.lstat(
						path.join(__dirname, "files", msg.readdir?.path || "", file)
					)
				).isDirectory() ? {
					type: api.File.Type.DIRECTORY
				} : {}
			)
		}))
	)

	let _fs = new api.Command({
		channel: msg.channel, ref: msg.ref, files: {
			files: files
		}
	});

	ws.send(api.Command.encode(_fs).finish())
}

wss.on("connection", async function connection(ws, req) {
	// console.log("Connection established.", req.url);
	ws.on("error", console.error);

	const channels = [null]

	ws.on("message", async function message(data) {
		// decode the message
		let msg = api.Command.decode(data);
		//if (!msg.ping) console.log(msg);

		if (msg.ping) {
			let _pong = new api.Command({ channel: 0, ref: msg.ref, pong: {} });
			ws.send(api.Command.encode(_pong).finish());
			// sendToast(ws, msg.ref);
		}
		else if (msg.openChan) {
			// channel opened
			let openedChannel = {
				service: msg.openChan.service,
				name: msg.openChan.name
			};
			// sendToast(ws, "Open channel: " + openedChannel.service)
			let _chanOpenRes = new api.Command({
				channel: 0,
				openChanRes: {
					id: channels.length
				},
				ref: msg.ref
			});
			channels.push(openedChannel)
			ws.send(api.Command.encode(_chanOpenRes).finish())
			// forgot how roster works brb
			if (openedChannel.service == "presence") {
				let _roster = new api.Command({
					"channel": channels.length - 1,
					"session": 1934,
					ref: msg.ref,
					"roster": {
						"user": [
							{
								"id": 1,
								"name": "amasad",
								"session": 42031
							},
							{
								"id": 2,
								"name": "amasad",
								"session": 420311
							},
							{
								"id": 3,
								"name": "amasad",
								"session": 4203111
							}
						],
						"files": [
							{
								"userId": 1,
								"session": 4023,
								"timestamp": {
									"seconds": "1678647723",
									"nanos": 843426598
								}
							}
						]
					}
				})

				ws.send(api.Command.encode(_roster).finish())
			}
			else if (openedChannel.service == "ot") {
				let fileName = openedChannel.name.split(':')
				fileName.shift();
				fileName = fileName.join(':')
				let fileContents;
				try {
					fileContents = await fs.readFile(`./files/${fileName}`, 'utf-8')
				} catch (err) {
					return;
				}
				let _file = new api.Command({
					channel: channels.length - 1,
					session: 1934,
					otstatus: {
						contents: fileContents,
						version: 1,
						linkedFile: {
							path: fileName
						}
					}
				})

				ws.send(api.Command.encode(_file).finish())
			}
			else if (openedChannel.service == "shell") {
				const _output = 0;
			}
		}
		else if (msg.readdir) {
			await sendFiles(ws, msg)
		}
		else if (msg.write) {
			const file = msg.write.path;

			fs.writeFile(path.join(__dirname, "files", file), " ")
			await sendFiles(ws, msg)
		}
		else if (msg.remove) {
			const file = msg.remove.path;

			fs.rm(path.join(__dirname, "files", file))

			await sendFiles(ws, msg)
		}
		else if (msg.move) {
			const fileN = msg.move.newPath;
			const fileO = msg.move.oldPath;

			fs.rename(path.join(__dirname, "files", fileO), path.join(__dirname, "files", fileN));

			await sendFiles(ws, msg)

		}
		else if (msg.ot) {
			// Get the file
			let file = channels[msg.channel].name.split(':')
			file.shift();
			file = file.join(':')

			let filecontents = await fs.readFile(path.join(__dirname, "files", file), 'utf-8')

			console.log(handleOTs(filecontents, Array.from(msg.ot)))
		}
		else if (msg.mkdir) {
			await fs.mkdir(path.join(__dirname, "files", msg.mkdir.path))

			await sendFiles(ws, msg)
		}
		else if (msg.input && channels.find((ch, i) => i === msg.channel && ch.service == "shell")) {
			const _a = new api.Command({
				channel: msg.channel,
				output: msg.input
			})
			ws.send(api.Command.encode(_a).finish())
			if (msg.input == "\n" || msg.input == "\r") {
				const _output = new api.Command({
					channel: msg.channel,
					output: "\r\nShell currently does not work.\r\n"
				})
	
				ws.send(api.Command.encode(_output).finish());
			}
		}
	});

	let _cs = new api.Command();
	_cs.containerState = new api.ContainerState();
	_cs.containerState.state = api.ContainerState.State.READY;

	ws.send(api.Command.encode(_cs).finish());

	sendToast(ws, "Welcome to Nodeval © bddylol & haroon 2023")

	_cs.containerState.state = api.ContainerState.State.COMPLETE;

	ws.send(api.Command.encode(_cs).finish());
});

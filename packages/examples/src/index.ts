import { Type } from "@sinclair/typebox"
import { Wsapix } from "wsapix"
import * as http from "http"
import Ajv from "ajv"

import * as chat from "./chat"

// tslint:disable-next-line: no-var-requires
const notepack = require("notepack.io")

export interface IChatClientContextState {
  user: any
  db: any
}

const asyncApiParams = {
  info: {
    version: "1.0.0",
    title: "Chat websocket API"
  }
}

const port = Number(process.env.PORT || 3000)
const server = new http.Server((req, res) => {
  if (req.url === "/wsapi") {
    res.setHeader("Content-Type", "application/json")
    res.end(wsapi.asyncapi(asyncApiParams))
  } else if (req.url === "/") {
    res.setHeader("Content-Type", "text/html")
    res.end(wsapi.htmlDocTemplate("/wsapi"))
  } else {
    res.writeHead(404)
    res.end()
  }
})

const ajv = new Ajv({ strict: false })

const wsapi = Wsapix.WS<IChatClientContextState>({ server }, {
  validator: ajv.validate.bind(ajv),
  parser: notepack.decode,
  serializer: notepack.encode
})

wsapi.use((client) => {
  // check auth
  if (!client.query) {
    client.send({ type: "error", message: "Wrong token!", code: 401 })
    client.terminate(4003)
  }
})

wsapi.serverMessage({ type: "error" }, {
  $id: "error",
  description: "Backend error message",
  payload: Type.Strict(Type.Object({
    type: Type.String({ const: "error" }),
    message: Type.String(),
    code: Type.Number()
  })),
})

wsapi.route(chat.channel)

wsapi.on("error", (ctx, error) => {
  ctx.send({ type: "error", message: error })
  console.log(error)
})

server.listen(port, () => {
  console.log(`Server listen port ${port}`)
})

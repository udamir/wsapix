import * as http from "http"
import Ajv from "ajv"
import { WSApi } from "wsapix"

import * as chat from "./chat/messages"
import { html } from "./doc"

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
    res.end(html("/wsapi"))
  } else {
    res.writeHead(404)
    res.end()
  }
})

const ajv = new Ajv({ strict: false })

const wsapi = new WSApi<IChatClientContextState>({ server }, {
  validator: ajv.validate.bind(ajv),
  serializer: notepack
})

wsapi.use((ctx) => {
  // check auth
  const [path, query] = (ctx.req?.url || "").split("?")

  if (!query || query !== "123") {
    ctx.send({ type: "error", message: "Wrong token!", code: 401 })
    ctx.ws.close(4003)
  }
})

wsapi.path("/chat", chat.messages)

wsapi.onError((ctx, error) => {
  ctx.channel = ctx.channel || "/"
  ctx.send({ type: "error", message: error })
  console.log(error)
})

server.listen(port, () => {
  console.log(`Server listen port ${port}`)
})

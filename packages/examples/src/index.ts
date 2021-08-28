import { Type } from "@sinclair/typebox"
import { App } from "uWebSockets.js"
import { Wsapix } from "wsapix"
import Ajv from "ajv"

import { chat } from "./chat"

const port = Number(process.env.PORT || "3000")
const server = App()

const ajv = new Ajv({ strict: false })

const wsx = Wsapix.uWS({ server }, {
  validator: (schema, data, error) => {
    const valid = ajv.validate(schema, data)
    if (!valid) {
      error(ajv.errors!.map(({ message }) => message).join(",\n"))
    }
    return valid
  }
})

wsx.route(chat)

wsx.serverMessage({ type: "error" }, {
  $id: "error",
  description: "Backend error message",
  payload: Type.Strict(Type.Object({
    type: Type.String({ const: "error" }),
    message: Type.String(),
    code: Type.Optional(Type.Number())
  })),
})

wsx.on("error", (ctx, error) => {
  ctx.send({ type: "error", message: error })
  console.log(error)
})

server.get("/", (res) => {
  res.writeHeader('Content-Type', 'text/html').end(wsx.htmlDocTemplate("/wsapix"))
})

server.get("/wsapix", (res) => {
  res.writeHeader('Content-Type', 'application/json').end(wsx.asyncapi({
    info: {
      version: "1.0.0",
      title: "Chat websocket API"
    }
  }))
})

server.listen(port, () => {
  console.log(`Server listen port ${port}`)
})

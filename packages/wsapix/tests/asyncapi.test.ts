import * as http from "http"
import WebSocket from "ws"
import Ajv from "ajv"

import { WsapixClient, Wsapix } from "../src"

const port = 3003
let wsx: Wsapix<WebSocket>
let server: http.Server

const initEnv = () => {
  server = new http.Server()
  const ajv = new Ajv({ strict: true })
  wsx = Wsapix.WS({ server }, {
    validator: (schema: any, data: any, error: (msg: string) => void) => {
      const valid = ajv.validate(schema, data)
      if (!valid) { error(ajv.errors!.map(({ message }) => message).join(", ")) }
      return valid
    }
  })
  server.listen(port)
}

const closeEnv = async () => {
  await wsx.close()
  await new Promise((resolve, reject) => {
    server.close((err) => err ? reject() : resolve(err))
  })
}

describe("Validation test", () => {
  beforeAll(initEnv)
  afterAll(closeEnv)

  let client1: WsapixClient
  let error: any
  const ws1 = new WebSocket(`ws://localhost:${port}`)

  test("Message from cliend should pass validation", (done) => {
    const msg1 = { type: "chat:message", text: "123" }
    wsx.clientMessage({ type: "chat:message" }, {
      $id: "chat:message",
      description: "User read all messages in chat",
      payload: {
        type: "object",
        properties: {
          type: { type: "string", const: "chat:message" },
          text: { type: "string" }
        },
        required: ["type", "text"],
        additionalProperties: false,
      },
    }, (client, data) => {
      client1 = client
      expect(data).toMatchObject(msg1)
      done()
    })

    ws1.onopen = () => {
      ws1.send(JSON.stringify(msg1))
    }
  })

  test("Message from ws1 should not pass validation", (done) => {
    const msg2 = { type: "chat:message", text1: "123" }
    error = {
      message: "must have required property 'text'",
      data: msg2,
      done
    }
    wsx.on("error", (client, message: string, data: any) => {
      expect(message).toBe(error.message)
      expect(data).toMatchObject(error.data)
      error.done()
    })

    ws1.send(JSON.stringify(msg2))
  })

  test("Undefined handler for client message should raise error", (done) => {
    const msg2 = { type: "user:typing", typing: true }
    wsx.clientMessage({ type: "user:typing" }, {
      $id: "user:typing",
      description: "User read all messages in chat",
      payload: {
        type: "object",
        properties: {
          type: { type: "string", const: "user:typing" },
          typing: { type: "boolena" }
        },
        required: ["type", "text"],
        additionalProperties: false,
      },
    })

    error = {
      message: "Handler not implemented",
      data: msg2,
      done,
    }

    ws1.send(JSON.stringify(msg2))
  })

  test("Undefined handler for client message should raise error", (done) => {
    const msg2 = { type: "user:waiting", duration: 60 }

    error = {
      message: "Message not found",
      data: msg2,
      done,
    }

    ws1.send(JSON.stringify(msg2))
  })

  test("Server message should be validated", (done) => {
    const msg3 = { type: "chat:clean", chatId: "123" }
    wsx.serverMessage(({ type }) => type === "chat:clean", {
      $id: "chat:clean",
      description: "Chat history cleaned",
      payload: {
        $id: "UserChatCleanHistory",
        type: "object",
        properties: {
          type: { type: "string", const: "chat:clean" },
          chatId: { type: "string" }
        },
        required: ["type", "chatId"]
      }
    })

    ws1.onmessage = (event) => {
      expect(event.data).toBe(JSON.stringify(msg3))
      done()
    }

    client1.send(msg3)
  })

  test("Unknown message should raise error", (done) => {
    const msg4 = { type: "chat:delete", chatId: "123" }

    client1.send(msg4, (err) => {
      expect(err).not.toBeUndefined()
      done()
    }).catch(() => {})
  })

  test("AsyncApi schema should genereted", () => {
    const info = { version: "1.0", title: "test" }

    const api = wsx.asyncapi({ info })
    const parsed = JSON.parse(api)
    expect(parsed.info).toMatchObject(info)
  })

  test("Documentation template should genereted", () => {
    const html = wsx.htmlDocTemplate("/test")
    expect(html).not.toBeUndefined()
  })

})

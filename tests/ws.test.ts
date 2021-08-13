import * as http from "http"
import WebSocket from "ws"

import { Wsapix, WsapixClient } from "../packages/core/src"

const port = 3000
let wsx: Wsapix
let server: http.Server

const initEnv = () => {
  server = new http.Server()
  wsx = Wsapix.WS({ server })

  server.listen(port)
}

const closeEnv = async (done: any) => {
  await wsx.close(() => {})
  server.close(done)
}

describe("Websocket transport test 1", () => {
  beforeAll(initEnv)
  afterAll(closeEnv)

  let ws1: WebSocket
  let client1: WsapixClient

  test(`ws1 client should connect to server`, (done) => {

    wsx.on("connect", (client: WsapixClient) => {
      client1 = client
      expect(wsx.clients.has(client)).toBe(true)
      expect(client.status).toBe("connected")
      done()
    })
    ws1 = new WebSocket(`ws://localhost:${port}`)
  })

  test("WS server should get message from ws1", (done) => {
    const msg = { type: "text", text: "test" }
    wsx.clientMessage({ type: "text" }, (client: WsapixClient, message: any) => {
      expect(message).toMatchObject(msg)
      expect(client).toBe(client1)
      done()
    })
    ws1.onopen = (() => {
      ws1.send(JSON.stringify({ type: "text", text: "test"}))
    })
  })

  test("ws1 client should get message from server", (done) => {
    const msg = { type: "text", text: "test 2" }
    ws1.onmessage = (event: WebSocket.MessageEvent) => {
      const message = JSON.parse(event.data as string)
      expect(message).toMatchObject(msg)
      done()
    }
    client1.send(msg, (err) => expect(err).toBeUndefined())
  })

  test("WS server should get disconnect event from ws1", (done) => {
    wsx.on("disconnect", (client: WsapixClient, code: number, data: any) => {
      expect(code).toBe(4001)
      expect(data).toBe("test")
      expect(client).toBe(client1)
      expect(client.status).toBe("disconnecting")
      done()
    })
    ws1.close(4001, "test")
  })

  test("WS server should have 0 clients", () => {
    expect(wsx.clients.size).toBe(0)    
  })
})

describe("Websocket transport test 2", () => {
  beforeAll(initEnv)
  afterAll(closeEnv)

  let ws2: WebSocket
  let client2: WsapixClient

  test(`ws2 client should connect to server to path with query and headers`, (done) => {
    wsx.on("connect", (client: WsapixClient) => {
      client2 = client
      expect(wsx.clients.has(client)).toBe(true)
      expect(client.path).toBe("/test")
      expect(client.query).toBe("param=1")
      expect(client.headers).toMatchObject({ "test-header": "1234" })
      expect(client.status).toBe("connected")
      done()
    })
    ws2 = new WebSocket(`ws://localhost:${port}/test?param=1`, { headers: { "test-header": "1234" } })
  })

  test(`WS server should handle wrong message payload`, (done) => {
    wsx.on("error", (client: WsapixClient, message: string, data: any) => {
      expect(message).toBe("Unexpected message payload")
      expect(data).toBe("Hello")
      expect(client).toBe(client2)
      done()
    })
    ws2.onopen = () => {
      ws2.send("Hello")
    }
  })

  test("ws2 server should connection termination from server", (done) => {
    ws2.onclose = (event: any) => {
      expect(event.code).toBe(4001)
      expect(event.reason).toBe("test")
      expect(ws2.readyState).toBe(WebSocket.CLOSED)
      done()
    }
    client2.terminate(4001, "test")
  })
})

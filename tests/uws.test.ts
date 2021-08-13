import WebSocket from "ws"
import { App, TemplatedApp, us_listen_socket_close } from "uWebSockets.js"

import { Wsapix, WsapixClient } from "../packages/core/src"

const port = 3001
let wsx: Wsapix
let server: TemplatedApp & { listener?: any }

const initEnv = () => {
  server = App()
  wsx = Wsapix.uWS({ server })

  server.listen(port, (listener) => {
    server.listener = listener
  })
}

const closeEnv = async (done: any) => {
  await wsx.close(()=>{})
  if (server.listener) {
    us_listen_socket_close(server.listener)
  }
  done()
}

describe("uWebsockets transport test 1", () => {
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

  test("uWS server should get message", (done) => {
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

  test("ws1 client should get message", (done) => {
    const msg = { type: "text", text: "test 2" }
    ws1.onmessage = (event: WebSocket.MessageEvent) => {
      const message = JSON.parse(event.data as string)
      expect(message).toMatchObject(msg)
      done()
    }
    client1.send(msg, (err) => expect(err).toBeUndefined())
  })

  test("uWS server should get disconnect", (done) => {
    wsx.on("disconnect", (client: WsapixClient, code: number, data: any) => {
      expect(code).toBe(4001)
      expect(data).toBe("test")
      expect(client).toBe(client1)
      expect(client.status).toBe("disconnecting")
      done()
    })
    ws1.close(4001, "test")
  })

  test("uWS server should have 0 clients", () => {
    expect(wsx.clients.size).toBe(0)    
  })
})

describe("uWebsockets transport test 2", () => {
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

  test("ws2 client should connection termination from server", (done) => {
    ws2.onclose = (event: any) => {
      expect(event.code).toBe(4001)
      expect(event.reason).toBe("test")
      expect(ws2.readyState).toBe(WebSocket.CLOSED)
      done()
    }
    client2.terminate(4001, "test")
  })
})

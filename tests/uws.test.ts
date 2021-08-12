import WebSocket from "ws"
import { App, TemplatedApp, us_listen_socket_close } from "uWebSockets.js"

import { Wsapix, WsapixClient } from "../packages/core/src"

const port = 3001
let wsx: Wsapix
let server: TemplatedApp & { listener?: any }

beforeAll(() => {
  server = App()
  wsx = Wsapix.uWS({ server })

  server.listen(port, (listener) => {
    server.listener = listener
  })
})

afterAll(async (done) => {
  await wsx.close()
  if (server.listener) {
    us_listen_socket_close(server.listener)
  }
  done()
})

describe("Server", () => {
  let ws: WebSocket
  let client1: WsapixClient

  test(`uWS client should connect to server`, (done) => {

    wsx.on("connect", (client: WsapixClient) => {
      client1 = client
      expect(wsx.clients.has(client)).toBe(true)
      expect(client.status).toBe("connected")
      done()
    })
    ws = new WebSocket(`ws://localhost:${port}`)
  })

  test("uWS server should get message", (done) => {
    const msg = { type: "text", text: "test" }
    wsx.clientMessage({ type: "text" }, (client: WsapixClient, message: any) => {
      expect(message).toMatchObject(msg)
      expect(client).toBe(client1)
      done()
    })
    ws.onopen = (() => {
      ws.send(JSON.stringify({ type: "text", text: "test"}))
    })
  })

  test("WS client should get message", (done) => {
    const msg = { type: "text", text: "test 2" }
    ws.onmessage = (event: WebSocket.MessageEvent) => {
      const message = JSON.parse(event.data as string)
      expect(message).toMatchObject(msg)
      done()
    }
    client1.send(msg)
  })

  test("uWS server should get disconnect", (done) => {
    wsx.on("disconnect", (client: WsapixClient, code: number, data: any) => {
      expect(code).toBe(4001)
      expect(data).toBe("test")
      expect(client).toBe(client1)
      expect(client.status).toBe("disconnecting")
      done()
    })
    ws.close(4001, "test")
  })

})

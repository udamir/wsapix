import * as http from "http"
import WebSocket from "ws"

import { Wsapix, WsapixClient } from "../packages/core/src"

const port = 3002
let wsx: Wsapix
let server: http.Server

const initEnv = () => {
  server = new http.Server()
  wsx = Wsapix.WS({ server })

  server.listen(port)
}

const closeEnv = async (done: any) => {
  await wsx.close()
  server.close(done)
}

describe("Channels test", () => {
  beforeAll(initEnv)
  afterAll(closeEnv)

  test("WS server should add route", (done) => {
    const msg1 = { type: "test", test: "test" }
    const route = wsx.route("/test")
    expect(wsx.channels.has("/test")).toBe(true)

    route.clientMessage({ type: "test" }, (client: WsapixClient, msg: any) => {
      expect(msg).toMatchObject(msg1)
      done()
    })
    const ws3 = new WebSocket(`ws://localhost:${port}/test`)
    ws3.onopen = () => {
      ws3.send(JSON.stringify(msg1))
    }
  })

  test("WS server should add route with notepack", (done) => {
    const msg1 = { type: "test", test: "test" }
    const notepack = require("notepack.io")

    const route = wsx.route({ path: "/msgpack", serializer: notepack })
    expect(wsx.channels.has("/msgpack")).toBe(true)

    route.clientMessage({ type: "test" }, (client: WsapixClient, msg: any) => {
      expect(msg).toMatchObject(msg1)
      done()
    })
    const ws3 = new WebSocket(`ws://localhost:${port}/msgpack`)
    ws3.onopen = () => {
      ws3.send(notepack.encode(msg1))
    }
  })
})

describe("Websocket transport test 3", () => {
  beforeAll(() => {
    server = new http.Server()
    wsx = Wsapix.WS({ server }, { path: "/" })

    server.listen(port)
  })
  afterAll(closeEnv)

  test("ws4 client should not connect to server", (done) => {
    const ws4 = new WebSocket(`ws://localhost:${port}/test`)
    ws4.onopen = () => {
      ws4.send(JSON.stringify({ type: "test" }))
    }
    ws4.onclose = ({ code }) => {
      expect(code).toBe(4000)
      done()
    }
  })

  test("Adding the same route should raise error", () => {
    const t = () => wsx.route("/")
    expect(t).toThrow(Error)
  })

  test("ws4 client should not connect to server", (done) => {
    wsx.use((client: WsapixClient) => {
      if (client.query === "test") {
        client.terminate(4003, "Unathorized")
      }
    })
    const ws5 = new WebSocket(`ws://localhost:${port}?test`)
    ws5.onopen = () => {
      // expect(ws4.readyState).toBe(WebSocket.CLOSED)
      ws5.send(JSON.stringify({ type: "test" }))
    }
    ws5.onclose = ({ code, reason }) => {
      expect(code).toBe(4003)
      expect(reason).toBe("Unathorized")
      done()
    }
  })
})

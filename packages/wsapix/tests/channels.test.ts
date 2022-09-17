import * as http from "http"
import WebSocket from "ws"

import { Wsapix } from "../src"

const port = 3002
let wsx: Wsapix<WebSocket>
let server: http.Server

const initEnv = () => {
  server = new http.Server()
  wsx = Wsapix.WS({ server }, { path: "/" })

  server.listen(port)
}

const closeEnv = async () => {
  await wsx.close()
  await new Promise((resolve, reject) => {
    server.close((err) => err ? reject() : resolve(err))
  })
}

describe("Channels test", () => {
  beforeAll(initEnv)
  afterAll(closeEnv)

  test("WS server should add route", (done) => {
    const msg1 = { type: "test", test: "test" }
    const id = "123"
    const route = wsx.route("/rooms/{id}/test")
    expect(wsx.channels.has("/rooms/{id}/test")).toBe(true)

    route.clientMessage({ type: "test" }, (client, msg: any) => {
      expect(client.pathParams).toMatchObject({ id })
      expect(client.queryParams).toMatchObject({ sort: "1", foo: "bar" })
      expect(msg).toMatchObject(msg1)
      done()
    })
    const ws3 = new WebSocket(`ws://localhost:${port}/rooms/${id}/test?sort=1&foo=bar`)
    ws3.onopen = () => {
      ws3.send(JSON.stringify(msg1))
    }
  })

  test("WS server should add route with notepack", (done) => {
    const msg1 = { type: "test", test: "test" }
    const notepack = require("notepack.io")

    const route = wsx.route({ path: "/msgpack", serializer: notepack.encode, parser: notepack.decode })
    expect(wsx.channels.has("/msgpack")).toBe(true)

    route.clientMessage({ type: "test" }, (client, msg: any) => {
      expect(msg).toMatchObject(msg1)
      done()
    })
    const ws3 = new WebSocket(`ws://localhost:${port}/msgpack`)
    ws3.onopen = () => {
      ws3.send(notepack.encode(msg1))
    }
  })

  test("ws4 client should not connect to server", (done) => {
    const ws4 = new WebSocket(`ws://localhost:${port}/test2`)
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
    wsx.use((client) => {
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

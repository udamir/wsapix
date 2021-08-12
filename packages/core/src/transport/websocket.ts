import { IncomingMessage } from 'http'
import WebSocket from 'ws'

import { Client, Transport } from "./transport"

const promiseCallback = (resolve: (value?: any) => void, reject: (err?: any) => void, cb?: (error?: Error) => void) => {
  return (error?: Error) => {
    cb && cb(error)
    if (error) { return reject (error) }
    return resolve()
  }
}

export class WebsocketClient<S> extends Client<S> {

  constructor (public ws: WebSocket, req: IncomingMessage) {
    super()
    const [ path, query ] = (req.url || ws.url || "").split("?")
    this.path = path
    this.query = query
    this.headers = req.headers
  }

  protected _send(data: any, cb?: (error?: Error) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.send(data, promiseCallback(resolve, reject, cb))
    })
  }

  protected _terminate(code?: number, reason?: any) {
    this.ws.close(code, reason)
  }
}

export class WebsocketTransport<S> extends Transport<S> {
  public wss: WebSocket.Server

  constructor(options?: WebSocket.ServerOptions ) {
    super()
    this.wss = new WebSocket.Server(options)
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      const client = new WebsocketClient<S>(ws, req)
      ws.on("close", (code?, data?) => {
        client.status = "disconnecting"
        this.handlers.disconnect(client, code, data)
        client.status = "disconnected"
      })
      ws.on("message", (data: any) => this.handlers.message(client, data))

      client.status = "connected"
      this.handlers.connection(client)
    }) 

    this.wss.on("close", this.handlers.close.bind(this))
    this.wss.on("error", this.handlers.error.bind(this))
  }

  public close(cb?: (error?: Error) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss.close(promiseCallback(resolve, reject, cb))
    })
  }
}

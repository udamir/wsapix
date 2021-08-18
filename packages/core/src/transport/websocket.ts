import { IncomingMessage } from 'http'
import WebSocket from 'ws'

import { Client, ClientStatus, Transport } from "./transport"

const promiseCallback = (resolve: (value?: any) => void, reject: (err?: any) => void, cb?: (error?: Error) => void) => {
  return (error?: Error) => {
    cb && cb(error)
    if (error) { return reject (error) }
    return resolve()
  }
}

export class WebsocketClient extends Client {

  constructor (public ws: WebSocket, req: IncomingMessage) {
    super()
    const [ path, query ] = (req.url || "").split("?")
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

export class WebsocketTransport extends Transport {
  public wss: WebSocket.Server

  constructor(options?: WebSocket.ServerOptions ) {
    super()
    this.wss = new WebSocket.Server(options)
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      const client = new WebsocketClient(ws, req)
      ws.on("close", (code?, data?) => {
        client.status = ClientStatus.disconnecting
        this.handlers.disconnect(client, code, data)
        client.status = ClientStatus.disconnected
      })
      ws.on("message", (data: any) => this.handlers.message(client, data))

      client.status = ClientStatus.connected
      this.handlers.connection(client)
    })

    this.wss.on("error", this.handlers.error.bind(this))
  }

  public close(cb?: (error?: Error) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss.close(promiseCallback(resolve, reject, cb))
    })
  }
}

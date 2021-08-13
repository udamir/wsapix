import type { WebSocket, TemplatedApp } from 'uWebSockets.js'
import { Client, Transport } from './transport'

export interface WebsocketOptions {
  maxPayloadLength?: number
  idleTimeout?: number
  compression?: number
  maxBackpressure?: number
}

export class uWebSocketClient<S> extends Client<S> {

  constructor(public ws: WebSocket) {
    super()
    this.path = ws.url
    this.headers = ws.headers
    this.query = ws.query
  }

  public _send(data: any, cb?: (error?: Error) => void): Promise<void> {
    this.ws.send(data, false, false);
    return Promise.resolve(cb && cb())
  }

  public _terminate(code?: number, data?: string) {
    this.ws.end(code, data)
  }
}

export class uWebsocketTransport<S> extends Transport<S> {
  public app: TemplatedApp
  public clients: WeakMap<WebSocket, uWebSocketClient<S>> = new WeakMap()

  constructor(options: WebsocketOptions & { server: TemplatedApp }) {
    super()

    const { server, ...wsOptions } = options
    this.app = server

    this.app.ws('/*', {
      ...wsOptions,

      upgrade: (res, req, context) => {
        // get all headers
        const headers: {[id: string]: string} = {};
        req.forEach((key, value) => headers[key] = value);

        const upgradeParams = {
          url: req.getUrl(),
          query: req.getQuery(),

          headers,
          connection: {
            remoteAddress: Buffer.from(res.getRemoteAddressAsText()).toString()
          }
        }
        /* This immediately calls open handler, you must not use res after this call */
        /* Spell these correctly */
        res.upgrade(
          upgradeParams,
          req.getHeader('sec-websocket-key'),
          req.getHeader('sec-websocket-protocol'),
          req.getHeader('sec-websocket-extensions'),
          context
        )
      },

      open: async (ws: WebSocket) => {
        const client = new uWebSocketClient<S>(ws)
        this.clients.set(ws, client)
        client.status = "connected"
        this.handlers.connection(client)
      },

      close: (ws: WebSocket, code: number, message: ArrayBuffer) => {
        const client = this.clients.get(ws)!

        client.status = "disconnecting"
        this.handlers.disconnect(client, code, Buffer.from(message.slice(0)).toString())
        client.status = "disconnected"
      
      },

      message: (ws: WebSocket, message: ArrayBuffer, isBinary: boolean) => {
        const client = this.clients.get(ws)!

        this.handlers.message(client, Buffer.from(message.slice(0)).toString())
      },
    })
  }

  public close(cb?: (error?: Error) => void): Promise<void> {
    return Promise.resolve(cb && cb())
  }
}

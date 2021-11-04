import { Client, ClientStatus, Transport } from '.'

const noop = () => { /**/ }

export interface IClientInjectParams {
  connectionDelay?: number
  headers?: { [key: string]: string | string[] | undefined }
}

export enum ClientSocketState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3
}

export interface IClientSocket {
  readyState: ClientSocketState

  onopen: (event: { type: "open" }) => void
  onerror: (event: { type: "error", message: string, error: any }) => void
  onclose: (event: { type: "close", code: number, reason: any}) => void
  onmessage: (event: { type: "message", data: any }) => void
  close: (code?: number, reason?: string) => void
  send: (data: any) => void
}

export class MockTransport extends Transport {
  public close(cb?: (error?: Error) => void): Promise<void> {
    return Promise.resolve(cb && cb())
  }

  public inject(url: string = "/", params: IClientInjectParams = {}) {
    const { headers, connectionDelay, ...handlers } = params

    const socket: IClientSocket = {
      readyState: ClientSocketState.OPEN,

      onopen: noop,
      onerror: noop,
      onclose: noop,
      onmessage: noop,

      send: (data: any) => {
        this.handlers.message(client, data)
      },

      close: (code: number = 0, reason: string = "") => {
        client.status = ClientStatus.disconnecting
        setTimeout(() => {
          this.handlers.disconnect(client, code, reason)
          client.status = ClientStatus.disconnected
        }, connectionDelay)
      }
    }
    const client = new MockClient(socket, url, headers, connectionDelay)

    setTimeout(() => socket.onopen({ type: "open" }), connectionDelay)

    client.status = ClientStatus.connected
    this.handlers.connection(client)
    return socket
  }
}

export class MockClient extends Client {

  constructor(public socket: IClientSocket, url: string, public headers = {}, private connectionDelay = 5) {
    super()
    const parsedUrl = new URL(url, "ws://localhost/")
    this.path = parsedUrl.pathname
    this.query = parsedUrl.search.slice(1)
  }

  protected _send(data: any, cb?: (error?: Error) => void): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.socket.onmessage({ type: "message", data })
        return resolve(cb && cb())
      }, this.connectionDelay)
    })
  }

  protected _terminate(code = 1006, reason?: any): void {
    this.socket.readyState = ClientSocketState.CLOSING
    setTimeout(() => {
      this.socket.readyState = ClientSocketState.CLOSED
      this.socket.onclose({ type: "close", code, reason })
    }, this.connectionDelay)
  }
}

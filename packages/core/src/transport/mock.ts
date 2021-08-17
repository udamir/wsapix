import { Client, ClientStatus, Transport } from '.'

export interface IClientHandlers {
  onopen?: () => void
  onerror?: (message: string, error: any) => void
  onclose?: (code: number, reason: string) => void
  onmessage?: (data: string | Buffer | ArrayBuffer | Buffer[]) => void
}

export interface IClientInjectParams extends IClientHandlers {
  path?: string
  query?: string
  headers?: { [key: string]: string | string[] | undefined }
}

enum WebSocketClientState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3
}

export interface IWebSocketClient {
  readyState: WebSocketClientState

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

  public inject(params: IClientInjectParams = {}) {
    const { path, query, headers, ...handlers } = params
    const socket: IWebSocketClient = {
      readyState: WebSocketClientState.OPEN,

      onopen: () => handlers.onopen && handlers.onopen(),
      onerror: (event) => handlers.onerror && handlers.onerror(event.message, event.error),
      onclose: (event) => handlers.onclose && handlers.onclose(event.code, event.reason),
      onmessage: (event) => handlers.onmessage && handlers.onmessage(event.data),

      send: (data: any) => this.handlers.message(client, data),
  
      close: (code: number = 0, reason: string = "") => {
        client.status = ClientStatus.disconnecting
        this.handlers.disconnect(client, code, reason)
        client.status = ClientStatus.disconnected
      }  
    }
    const client = new MockClient(socket, path, query, headers)

    socket.onopen({ type: "open" })
    client.status = ClientStatus.connected
    this.handlers.connection(client)
    return socket
  }
}

export class MockClient extends Client {

  constructor(public socket: IWebSocketClient, public path = "/", public query = "", public headers = {}) {
    super()
  }

  protected _send(data: any, cb?: (error?: Error) => void): Promise<void> {
    this.socket.onmessage({ type: "message", data })
    return Promise.resolve(cb && cb())
  }

  protected _terminate(code = 1006, reason?: any): void {
    this.socket.readyState = WebSocket.CLOSING
    this.socket.onclose({ type: "close", code, reason })
    this.socket.readyState = WebSocket.CLOSED
  }
}

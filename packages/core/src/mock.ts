import { EventEmitter } from 'events'
import WebSocket from 'ws'

import { IClientHandlers } from './types'

export class WebSocketClient extends EventEmitter {
  /** The connection is not yet open. */
  static CONNECTING: 0
  /** The connection is open and ready to communicate. */
  static OPEN: 1
  /** The connection is in the process of closing. */
  static CLOSING: 2
  /** The connection is closed. */
  static CLOSED: 3

  public binaryType: "nodebuffer" | "arraybuffer" | "fragments" = "nodebuffer"
  public bufferedAmount: number = 0
  public extensions: string = ""
  public protocol: string = ""

  /** The connection is not yet open. */
  public CONNECTING: 0 = 0
  /** The connection is open and ready to communicate. */
  public OPEN: 1 = 1
  /** The connection is in the process of closing. */
  public CLOSING: 2 = 2
  /** The connection is closed. */
  public CLOSED: 3 = 3

  /** The current state of the connection */
  public readyState:
      | typeof WebSocket.CONNECTING
      | typeof WebSocket.OPEN
      | typeof WebSocket.CLOSING
      | typeof WebSocket.CLOSED
  public url: string = ""

  public onopen!: (event: WebSocket.OpenEvent) => void
  public onerror!: (event: WebSocket.ErrorEvent) => void
  public onclose!: (event: WebSocket.CloseEvent) => void
  public onmessage!: (event: WebSocket.MessageEvent) => void

  constructor() {
    super()
    this.readyState = WebSocket.OPEN
  }

  public close!: (code?: number, reason?: string) => void
  public send!: (data: any) => void
}

export class MockSocket extends WebSocketClient {
  public client: WebSocketClient

  constructor(handlers: IClientHandlers) {
    super()
    this.client = new WebSocketClient()
    this.readyState = WebSocket.OPEN
    this.client.onopen = () => handlers.onopen && handlers.onopen()
    this.client.onerror = (event) => handlers.onerror && handlers.onerror(event.message, event.error)
    this.client.onclose = (event) => handlers.onclose && handlers.onclose(event.code, event.reason)
    this.client.onmessage = (event) => handlers.onmessage && handlers.onmessage(event.data)

    this.client.send = (data: any) => {
      this.emit("message", data)
    }

    this.client.close = (code?: number, reason?: string) => {
      this.client.readyState = WebSocketClient.CLOSING
      this.readyState = WebSocketClient.CLOSING
      this.emit("close", code, reason)
      this.client.readyState = WebSocketClient.CLOSED
      this.readyState = WebSocketClient.CLOSED
    }

    this.send = (data: any) => {
      this.client.onmessage({ type: "message", data, target: this })
    }

    this.close = (code: number = 0, reason: string = "") => {
      this.client.readyState = WebSocketClient.CLOSING
      this.readyState = WebSocketClient.CLOSING
      this.client.onclose({ type: "close", target: this, code, reason, wasClean: true })
      this.client.readyState = WebSocketClient.CLOSED
      this.readyState = WebSocketClient.CLOSED
    }

    this.client.onopen({ target: this, type: "open" })
  }

  public ping(data?: any): void {
    super.emit("ping", data)
  }

  public pong(data?: any): void {
    super.emit("pong", data)
  }

  public terminate(): void {
    super.emit("close")
  }

  public addEventListener(method: string, listener: (event?: any) => void): void {
    super.addListener(method, listener)
  }

  public removeEventListener(method: string, listener: () => void): void {
    super.removeListener(method, listener)
  }
}

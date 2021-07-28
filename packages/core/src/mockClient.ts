import { EventEmitter } from 'events'
import WebSocket from 'ws'

export class MockWebSocketClient extends EventEmitter {
  public eventLog: Map<string,any[]> = new Map()
  public waitEvents: any = null

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

  public close(code?: number, data?: string): void {
    this.readyState = WebSocket.CLOSED
    super.emit("close", code, data)
  }
  public ping(data?: any): void {
    super.emit("ping", data)
  }
  public pong(data?: any): void {
    super.emit("pong", data)
  }

  public clearLog() {
    this.eventLog.clear()
    this.waitEvents = null
  }

  public send(data: any): void {
    const message = JSON.parse(data.toString())

    const events = this.eventLog.get(message.type)
    this.eventLog.set(message.type, [ ...events || [], message ])

    if (this.waitEvents && this.waitEvents.count === this.eventLog.size) {
      this.waitEvents.done()
    }
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

export type ClientStatus = "connecting" | "connected" | "disconnecting" | "disconnected"

export abstract class Client<S = any> {
  public state!: S
  public path?: string
  public query?: string
  public headers: { [key: string]: string | string[] | undefined } = {}

  private _msgQueue: any[] = []
  private _status: ClientStatus  = "connecting"

  get status(): ClientStatus {
    return this._status
  }

  set status(status: ClientStatus) {
    this._status = status
    if (status === "connected") {
      this._msgQueue.forEach((data) => this._send(data))
      this._msgQueue = []
    }
  }

  public send(data: any, cb?: (error?: Error) => void) {
    if (this.status === "connecting") {
      this._msgQueue.push(data)
    } else {
      this._send(data, cb)
    }
  }

  public terminate(code?: number, data?: any) {
    this.status = "disconnecting"
    this._terminate(code, data)
  }

  protected abstract _send(data: any, cb?: (error?: Error) => void): Promise<void>
  protected abstract _terminate(code?: number, data?: any): void
}

export abstract class Transport<S = any> {
  protected handlers = {
    connection: (client: Client<S>) => {},
    disconnect: (client: Client<S>, code?: number, data?: any) => {},
    message: (client: Client<S>, data: any) => {},
    error: (error: Error) => {},
    close: () => {}
  }

  public onConnection(cb: (client: Client<S>) => void): void {
    this.handlers.connection = cb
  }

  public onMessage(cb: (client: Client<S>, data: any) => void) {
    this.handlers.message = cb
  }

  public onDisconnect(cb: (client: Client<S>, code?: number, data?: any) => void) {
    this.handlers.disconnect = cb
  }

  public onError(cb: (error: Error) => void): void {
    this.handlers.error = cb
  }

  public onClose(cb: () => void): void {
    this.handlers.close = cb
  }
  public abstract close(cb?: (error?: Error) => void): Promise<void>
}

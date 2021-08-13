export type ClientStatus = "connecting" | "connected" | "disconnecting" | "disconnected"

// tslint:disable-next-line: no-empty
const noop = () => {}

export abstract class Client<S = any> {
  public state!: S
  public path?: string
  public query?: string
  public headers: { [key: string]: string | string[] | undefined } = {}

  public status: ClientStatus  = "connecting"

  public send(data: any, cb?: (error?: Error) => void) {
    return this._send(data, cb)
  }

  public terminate(code?: number, data?: any): void {
    this.status = "disconnecting"
    this._terminate(code, data)
  }

  protected abstract _send(data: any, cb?: (error?: Error) => void): Promise<void>
  protected abstract _terminate(code?: number, data?: any): void
}

export abstract class Transport<S = any> {
  protected handlers: any = {
    connection: noop,
    disconnect: noop,
    message: noop,
    error: noop,
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

  public abstract close(cb?: (error?: Error) => void): Promise<void>
}

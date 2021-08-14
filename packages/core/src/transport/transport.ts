export enum ClientStatus {
  connecting = 0,
  connected = 1,
  disconnecting = 2,
  disconnected = 3
}

// tslint:disable-next-line: no-empty
const noop = () => {}

export abstract class Client {
  public path?: string
  public query?: string
  public headers: { [key: string]: string | string[] | undefined } = {}

  public status: ClientStatus = ClientStatus.connecting

  public send(data: any, cb?: (error?: Error) => void) {
    return this._send(data, cb)
  }

  public terminate(code?: number, data?: any): void {
    this.status = ClientStatus.disconnecting
    this._terminate(code, data)
  }

  protected abstract _send(data: any, cb?: (error?: Error) => void): Promise<void>
  protected abstract _terminate(code?: number, data?: any): void
}

export abstract class Transport {
  protected handlers: any = {
    connection: noop,
    disconnect: noop,
    message: noop,
    error: noop,
  }

  public onConnection(cb: (client: Client) => void): void {
    this.handlers.connection = cb
  }

  public onMessage(cb: (client: Client, data: any) => void) {
    this.handlers.message = cb
  }

  public onDisconnect(cb: (client: Client, code?: number, data?: any) => void) {
    this.handlers.disconnect = cb
  }

  public onError(cb: (error: Error) => void): void {
    this.handlers.error = cb
  }

  public abstract close(cb?: (error?: Error) => void): Promise<void>
}

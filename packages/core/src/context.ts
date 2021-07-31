import { IncomingMessage } from 'http'
import WebSocket from 'ws'

import { WSChannel } from "./channel"

export class ClientContext<S> {
  public state: S = {} as S
  constructor(public ws: WebSocket, public req: IncomingMessage, public channel?: WSChannel) {
  }

  public send(data: any, cb?: (err?: Error) => void) {
    if (!this.channel) {
      throw new Error("Cannot send message: channel not defined")
    }

    if (this.channel.validator) {
      const message = this.channel.findServerMessage(data)

      if (!message) {
        const error = new Error("Cannot send message: Message schema not found")
        if (cb) { return cb(error) } else { throw error }
      }

      if (message.schema && !this.validatePayload(message.schema.payload, data, (msg) => cb && cb(new Error(msg)))) {
        if (!cb) { throw new Error("Cannot send message: Payload validation error") }
      }
    }

    // encode message
    const payload = this.channel.serializer.encode(data)
    this.ws.send(payload, cb)
  }

  public validatePayload = (schema: any, payload: any, error?: (msg: string) => void): boolean => {
    if (this.channel?.validator) {
      return this.channel.validator(schema, payload, error)
    }
    return true
  }

}
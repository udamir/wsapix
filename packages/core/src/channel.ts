import { EventEmitter } from 'events'
import { IncomingMessage } from 'http'
import WebSocket from 'ws'

import {
  WsapixMessage, ISerializer, MessageHandler, MessageKind,
  MessageMatcher, ChannelOptions, MessageValidator, WsapixMiddleware
} from './types'
import { MessageSchema } from './asyncapi'
import { Client } from './client'

// tslint:disable-next-line: no-empty
export const noop = () => {}

export class WsapixChannel<S = any> extends EventEmitter {
  public middlewares: WsapixMiddleware<S>[] = []
  public clients: Set<Client<S>> = new Set()
  public messages: WsapixMessage[] = []
  public path: string
  public _serializer: ISerializer | undefined
  public validator: MessageValidator | undefined

  public get serializer(): ISerializer {
    return this._serializer || {
      encode: JSON.stringify,
      decode: JSON.parse
    }
  }

  constructor(path?: string | ChannelOptions, options?: ChannelOptions) {
    super()
    if (typeof path === "object") {
      options = path
      path = path.path
    }
    this.path = options?.path || "/"
    this.validator = options?.validator
    this.messages = options?.messages || []
    this._serializer = options?.serializer

    this.on("message", this.handleMessage.bind(this))
  }

  public use(middleware: WsapixMiddleware<S>) {
    this.middlewares.push(middleware)
  }

  public async addClient(ws: WebSocket, req: IncomingMessage): Promise<Client<S> | undefined> {
    const client = new Client(ws, req, this)

    // execute midllwares
    for (const middleware of this.middlewares) {
      try {
        await middleware(client)
      } catch (error) {
        this.emit("error", client, "Middleware error", error)
      }
      if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
        return
      }
    }

    this.clients.add(client)
    return client
  }

  public deleteClient(client: Client<S>) {
    this.clients.delete(client)
    this.emit("close", client)
  }

  public serverMessage (matcher: MessageMatcher, schema?: MessageSchema) {
    this.messages.push({ kind: MessageKind.server, matcher, schema })
  }

  public clientMessage (matcher: MessageMatcher, schema?: MessageSchema | MessageHandler, handler?: MessageHandler) {

    if (typeof schema === "function") {
      handler = schema
      schema = undefined
    }

    this.messages.push({ kind: MessageKind.client, matcher, handler, schema })
  }

  public findClientMessage(data: { [key: string]: any }) {
    return this.findMessage(MessageKind.client, data)
  }

  public findServerMessage(data: { [key: string]: any }) {
    return this.findMessage(MessageKind.client, data)
  }

  public findMessage(type: MessageKind, data: { [key: string]: any }) {
    const messages = this.messages || []
    return messages.find((msg) => {
      if (msg.kind !== type) {
        return false
      }
      let fields = Object.keys(msg.matcher).length

      for (const key of Object.keys(msg.matcher)) {
        if (typeof msg.matcher === "function") {
          fields -= msg.matcher(data) ? 1 : 0
        } else {
          fields -= data[key] === msg.matcher[key] ? 1 : 0
        }
      }
      return fields === 0
    })
  }

  private handleMessage(client: Client<S>, data: any) {
    // decode message
    let event
    try {
      event = this.serializer.decode(data)
    } catch (error) {
      return this.emit("error", client, "Unexpected message payload", data)
    }

    const message = this.findClientMessage(event)

    if (!message) {
      return this.emit("error", client, "Message not found", event)
    }

    const { handler, schema } = message

    if (!handler) {
      return this.emit("error", client, `Handler for '${this.path}' not implemented`, event)
    }

    if (schema && !client.validatePayload(schema.payload, event, (msg: string) => this.emit("error", client, msg))) {
      return
    }

    handler(client, event)
  }
}

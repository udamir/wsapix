import { EventEmitter } from 'events'

import {
  WsapixMessage, WsapixClient, ISerializer, MessageHandler, MessageKind,
  MessageMatcher, ChannelOptions, MessageValidator, WsapixMiddleware, 
} from './types'
import { MessageSchema } from './asyncapi'
import { Client } from './transport'

// tslint:disable-next-line: no-empty
export const noop = () => {}

interface WsapixChannelEvents<S> {
  on(event: "connect", listener: (client: WsapixClient<S>) => void): void
  on(event: "disconnect", listener: (client: WsapixClient<S>, code?: number, data?: any) => void): void
  on(event: "error", listener: (client: WsapixClient<S>, message: string, data?: any) => void): void
}

export class WsapixChannel<S = any> extends EventEmitter implements WsapixChannelEvents<S> {
  private middlewares: WsapixMiddleware<S>[] = []
  public clients: Set<Client<S>> = new Set()
  public messages: WsapixMessage[] = []
  public path: string
  public validator?: MessageValidator

  public _serializer?: ISerializer

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
    this.path = path || "/"
    this.validator = options?.validator
    this.messages = options?.messages || []
    this._serializer = options?.serializer
  }

  public use(middleware: WsapixMiddleware<S>) {
    this.middlewares.push(middleware)
  }

  protected async onConnect(client: WsapixClient<S>) {
    // execute midllwares
    for (const middleware of this.middlewares) {
      try {
        await middleware(client)
      } catch (error) {
        this.emit("error", client, "Middleware error", error)
      }
      if (client.status === "disconnecting" || client.status === "disconnected") {
        return
      }
    }

    const _send = client.send.bind(client)

    client.send = (data: any, cb?: (error?: Error) => void) => {
      if (this.validator) {
        const message = this.findServerMessage(data)
  
        if (!message) {
          const error = new Error("Cannot send message: Message schema not found")
          if (cb) { return cb(error) } else { throw error }
        }
  
        if (message.schema && !this.validatePayload(message.schema.payload, data, (msg) => cb && cb(new Error(msg)))) {
          if (!cb) { throw new Error("Cannot send message: Payload validation error") }
        }
      }
  
      // encode message
      const payload = this.serializer.encode(data)
      _send(payload, cb)
    }

    this.clients.add(client)
    client.channel = this
    this.emit("connect", client)
  }

  protected onMessage(client: WsapixClient<S>, data: any) {
    // decode message
    let event
    try {
      event = this.serializer.decode(data)
    } catch (error) {
      this.emit("error", client, "Unexpected message payload", data)
      return 
    }

    const message = this.findClientMessage(event)

    if (!message) {
      this.emit("error", client, "Message not found", event)
      return 
    }

    const { handler, schema } = message

    if (!handler) {
      this.emit("error", client, `Handler for '${this.path}' not implemented`, event)
      return 
    }

    if (schema && !this.validatePayload(schema.payload, event, (msg: string) => this.emit("error", client, msg))) {
      return
    }

    handler(client, event)
  }

  protected onDisconnect(client: WsapixClient<S>, code?: number, data?: any) {
    this.clients.delete(client)
    this.emit("disconnect", client, code, data)
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

  protected inherit(channel: WsapixChannel<S>) {
    // set default channel parameters
    this._serializer = this._serializer || channel.serializer
    this.validator = this.validator || channel.validator

    // add middlwares and messages
    if (channel.path === "*") {
      this.middlewares = [ ...channel.middlewares, ...this.middlewares ]
      this.messages.push(...channel.messages)
    }

    // forward events
    this.on("error", (client: Client<S>, data: any) => channel.emit("error", client, data))
    this.on("close", (client: Client<S>) => channel.emit("close", client))
  }

  private findMessage(type: MessageKind, data: { [key: string]: any }) {
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

  protected validatePayload = (schema: any, payload: any, error?: (msg: string) => void): boolean => {
    if (this.validator) {
      return this.validator(schema, payload, error)
    }
    return true
  }
}

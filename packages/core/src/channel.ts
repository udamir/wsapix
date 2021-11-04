import { EventEmitter } from 'events'
import { promisify } from 'util'

import {
  WsapixMessage, WsapixClient, MessageHandler, MessageKind, DataParser,
  MessageMatcher, ChannelOptions, MessageValidator, WsapixMiddleware,
} from './types'
import type { MessageSchema } from './asyncapi'
import { ClientStatus } from './transport'

/**
 * Handler for event hook
 * @param client - client context
 * @param data - message payload
 * @param done - callback function on complete with update payload
 * @returns promise with updated payload
 */
type MessageHook = (client: WsapixClient, data: any, done: (err?: Error, value?: any) => void) => Promise<any>

/**
 * Hooks are registered with the addHook method and allow you to listen to specific message events lifecycle.
 * `onMessage` - event on client messages
 * `preParse` - event before client message parsing
 * `preValidation` - event before client message validation
 * `preHandler` - event before client message handler execution
 * `preSerialization` - event before send message serialization
 * `preSend` - event before send message to client
 */
type HookType = "onMessage" | "preParse" | "preHandler" | "preValidation" | "preSerialization" | "preSend"

export class WsapixChannel<S = any> extends EventEmitter {
  private middlewares: WsapixMiddleware<S>[] = []
  private hooks: Map<HookType, MessageHook[]> = new Map()

  /**
   * connected clients
   */
  public clients: Set<WsapixClient<S>> = new Set()
  /**
   * Registered messages
   */
  public messages: WsapixMessage[] = []
  /**
   * Channel path
   */
  public path: string
  /**
   * Channel validator
   */
  public validator?: MessageValidator

  private _parser?: "json" | null | DataParser
  private _serializer?: "json" | null | DataParser

  /**
   * Handle client connection
   * @param event - `connect`
   * @param listener - Handler
   */
  public on(event: "connect", listener: (client: WsapixClient<S>) => void): any

  /**
   * Handle client diconnection
   * @param event - `disconnect`
   * @param listener - Handler
   */
  public on(event: "disconnect", listener: (client: WsapixClient<S>, code?: number, data?: any) => void): any

  /**
   * Handler for error
   * @param event - `error`
   * @param listener - Handler
   */
  public on(event: "error", listener: (client: WsapixClient<S>, message: string, data?: any) => void): any
  public on(event: string | symbol, listener: (...args: any[]) => void): any {
    return super.on(event, listener)
  }

  /**
   * Channel parser
   */
  public get parser(): DataParser {
    return this._parser === "json" ? JSON.parse : this._parser || ((data: any) => data)
  }

  /**
   * Channel serializer
   */
  public get serializer(): DataParser {
    return this._serializer === "json" ? JSON.stringify : this._serializer || ((data: any) => data)
  }

  /**
   * Channel constructor
   * @param path - channel path
   * @param options - channel options
   */
  constructor(path?: string | ChannelOptions<S>, options?: ChannelOptions<S>) {
    super()
    if (typeof path === "object") {
      options = path
      path = path.path
    }
    this.path = path || "/"
    this.validator = options?.validator
    this.messages = options?.messages || []
    this._parser = options?.parser || "json"
    this._serializer = options?.serializer || "json"
  }

  /**
   * Register connection hook
   * @param middleware - connection hook
   */
  public use(middleware: WsapixMiddleware<S>) {
    this.middlewares.push(middleware)
  }

  /**
   * Register message hook
   * @param type - type of hook
   *
   * @param hook - hook handler
   */
  public addHook(type: HookType, hook: MessageHook) {
    const hooks = this.hooks.get(type)
    if (!hooks) {
      this.hooks.set(type, [ hook ])
    } else {
      this.hooks.set(type, [ ...hooks, hook ])
    }
  }

  private async runHook (type: HookType, client: WsapixClient<S>, data: any) {
    for (const hook of this.hooks.get(type) || []) {
      const asyncHook = promisify(hook)
      data = await asyncHook(client, data)
    }
    return data
  }

  protected async onConnect(client: WsapixClient<S>) {
    const _send = client.send.bind(client)

    client.send = async <T = any>(data: T, cb?: (error?: Error) => void) => {
      try {
        // execute hooks
        if (this.validator !== undefined) {
          // preValidation hook
          data = await this.runHook("preValidation", client, data)

          const message = this.findServerMessage(data)

          if (!message) {
            const error = new Error("Cannot send message: Message schema not found")
            cb && cb(error)
            return Promise.reject(error)
          }

          let errorMessage = ""
          if (message.schema && !this.validatePayload(message.schema.payload, data, (msg) => {
            errorMessage = msg
            cb && cb(new Error(msg))
          })) {
            return Promise.reject(new Error("Cannot send message - payload validation error:\n" + errorMessage))
          }
        }

        // preSerialization hook
        data = await this.runHook("preSerialization", client, data)
        // encode message
        data = this.serializer(data)

        // preSend hook
        data = await this.runHook("preSerialization", client, data)
        return _send(data, cb)
      } catch (error: any) {
        cb && cb(error)
        return Promise.reject(error)
      }
    }

    // execute midllwares
    for (const middleware of this.middlewares) {
      try {
        await middleware(client)
      } catch (error) {
        throw error
      }
      if (client.status === ClientStatus.disconnecting || client.status === ClientStatus.disconnected) {
        return
      }
    }

    this.clients.add(client)
    client.channel = this
    this.emit("connect", client)
  }

  protected async onMessage(client: WsapixClient<S>, data: any) {
    try {
      // onMessage hook
      data = await this.runHook("onMessage", client, data)

      // preParse hook
      data = await this.runHook("preParse", client, data)
      try {
        data = this.parser(data)
      } catch (error) {
        this.emit("error", client, "Unexpected message payload", data)
        return
      }

      const message = this.findClientMessage(data)

      if (!message) {
        this.emit("error", client, "Message not found", data)
        return
      }

      const { handler, schema } = message

      if (!handler) {
        this.emit("error", client, `Handler not implemented`, data)
        return
      }

      if (schema && this.validator !== undefined) {
        data = await this.runHook("preValidation", client, data)
        if (!this.validatePayload(schema.payload, data, (msg: string) => {
          this.emit("error", client, msg, data)
        })) { return }
      }

      data = await this.runHook("preHandler", client, data)
      handler(client, data)
    } catch (error) {
      this.emit("error", client, "Unhandled error", data)
    }
  }

  protected onDisconnect(client: WsapixClient<S>, code?: number, data?: any) {
    this.clients.delete(client)
    this.emit("disconnect", client, code, data)
  }

  public serverMessage (matcher: MessageMatcher, schema?: MessageSchema) {
    this.messages.push({ kind: MessageKind.server, matcher, schema })
  }

  public clientMessage<T = any>(
    matcher: MessageMatcher,
    schema?: MessageSchema | MessageHandler<S, T>,
    handler?: MessageHandler<S, T>) {

    if (typeof schema === "function") {
      handler = schema
      schema = undefined
    }

    this.messages.push({ kind: MessageKind.client, matcher, handler, schema })
  }

  /**
   * Find client message by payload
   * @param data - payload
   * @returns Message or undefined
   */
  public findClientMessage(data: { [key: string]: any }) {
    return this.findMessage(MessageKind.client, data)
  }

  /**
   * Find server message by payload
   * @param data - message payload
   * @returns Message or undefined
   */
  public findServerMessage(data: { [key: string]: any }): WsapixMessage<S, any> | undefined {
    return this.findMessage(MessageKind.server, data)
  }

  protected inherit(channel: WsapixChannel<S>) {
    // set default channel parameters
    this._parser = this._parser || channel.parser
    this._serializer = this._serializer || channel.serializer
    this.validator = this.validator || channel.validator

    // add middlwares and messages
    if (channel.path === "*") {
      this.middlewares = [ ...channel.middlewares, ...this.middlewares ]
      this.messages.push(...channel.messages)
    }

    // forward events
    this.on("error", (client: WsapixClient<S>, data: any) => channel.emit("error", client, data))
    this.on("disconnect", (client: WsapixClient<S>) => channel.emit("disconnect", client))
  }

  private findMessage(type: MessageKind, data: { [key: string]: any }) {
    return this.messages.find((msg) => {
      if (msg.kind !== type) {
        return false
      }

      if (typeof msg.matcher === "function") {
        return msg.matcher(data)
      } else {
        let fields = Object.keys(msg.matcher).length
        for (const key of Object.keys(msg.matcher)) {
          fields -= data[key] === msg.matcher[key] ? 1 : 0
        }
        return fields === 0
      }
    })
  }

  protected validatePayload = (schema: any, payload: any, error?: (msg: string) => void): boolean => {
    if (this.validator) {
      return this.validator(schema, payload, (msg) => {
        error!(msg)
      })
    }
    return true
  }
}

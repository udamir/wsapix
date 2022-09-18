import { EventEmitter } from 'events'
import { ClientStatus } from 'rttl'
import { promisify } from 'util'

import {
  WsapixMessage, MessageHandler, MessageKind, DataParser, WsapixClient,
  MessageMatcher, ChannelOptions, MessageValidator, WsapixMiddleware, ClientRequestSchema,
} from './types'
import type { MessageSchema } from './asyncapi'

/**
 * Handler for event hook
 * @param client - client context
 * @param data - message payload
 * @param done - callback function on complete with update payload
 * @returns promise with updated payload
 */
type MessageHook<T, S> =
  (client: WsapixClient<T, S>, data: Buffer, done: (err?: Error, value?: any) => void) => Promise<any>

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

export class WsapixChannel<T = any, S = any> extends EventEmitter {
  private middlewares: WsapixMiddleware<T, S>[] = []
  private hooks: Map<HookType, MessageHook<T, S>[]> = new Map()

  /**
   * connected clients
   */
  public clients: Set<WsapixClient<T, S>> = new Set()
  /**
   * Registered messages
   */
  public messages: WsapixMessage<T, S, any>[] = []
  /**
   * Channel path
   */
  public path: string

  public schema?: ClientRequestSchema

  /**
   * Channel path params
   */
  private _pathArr: string[]
  private _pathTestExp: RegExp
  private _pathWithParams: boolean

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
  public on(event: "connect", listener: (client: WsapixClient<T, S>) => void): any

  /**
   * Handle client diconnection
   * @param event - `disconnect`
   * @param listener - Handler
   */
  public on(event: "disconnect", listener: (client: WsapixClient<T, S>, code?: number, data?: any) => void): any

  /**
   * Handler for error
   * @param event - `error`
   * @param listener - Handler
   */
  public on(event: "error", listener: (client: WsapixClient<T, S>, message: string, data?: any) => void): any
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
   * @type T - Transport socket interface
   * @typw S - Client state interface
   * @param path - channel path
   * @param options - channel options
   */
  constructor(path?: string | ChannelOptions<T, S>, options?: ChannelOptions<T, S>) {
    super()
    if (typeof path === "object") {
      options = path
      path = path.path
    }
    this.path = path || "/"
    this._pathArr = this.path.replace(/^\/+|\/+$/g, "").split("/")
    this._pathTestExp = new RegExp("\/" + this._pathArr.map((i) => i[0] === "{" && i.slice(-1) === "}" ? "[A-Za-z0-9_.\-]+" : i).join("\/") + "$", "gi")
    this._pathWithParams = new RegExp("\{(.*?)\}").test(this.path)
    this.validator = options?.validator
    this.schema = options?.schema || {}
    this.messages = options?.messages || []
    this._parser = options?.parser || "json"
    this._serializer = options?.serializer || "json"
  }

  /**
   * Register connection hook
   * @param middleware - connection hook
   */
  public use(middleware: WsapixMiddleware<T, S>) {
    this.middlewares.push(middleware)
  }

  /**
   * Register message hook
   * @param type - type of hook
   *
   * @param hook - hook handler
   */
  public addHook(type: HookType, hook: MessageHook<T, S>) {
    const hooks = this.hooks.get(type)
    if (!hooks) {
      this.hooks.set(type, [hook])
    } else {
      this.hooks.set(type, [...hooks, hook])
    }
  }

  public matchPath(path: string) {
    return this._pathTestExp.test(path)
  }

  private async runHook(type: HookType, client: WsapixClient<T, S>, data: any) {
    for (const hook of this.hooks.get(type) || []) {
      const asyncHook = promisify(hook)
      data = await asyncHook(client, data)
    }
    return data
  }

  protected async onConnect(client: WsapixClient<T, S>) {
    const _send = client.send.bind(client)

    if (this._pathWithParams) {
      // TODO: Add path params validation
      const pathParams: Record<string, string> = {}
      const pathArr = client.path?.replace(/^\/+|\/+$/g, "").split("/") || []

      pathArr.forEach((key, i) => {
        const p = this._pathArr[i]
        if (p[0] === "{" && p.slice(-1) === "}") {
          pathParams[p.slice(1, -1)] = key
        }
      })

      client.pathParams = pathParams
    }

    if (client.query) {
      // TODO: Add query params validation
      client.queryParams = Object.fromEntries(
        client.query.split("&").filter((p) => !!p).map((p) => {
          const [k, v] = p.split("=")
          return [k, decodeURI(v)]
        })
      )
    }

    client.send = async (data: Record<string, any>, cb?: (error?: Error) => void) => {
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
        data = await this.runHook("preSend", client, data)
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

  protected async onMessage(client: WsapixClient<T, S>, buffer: Buffer, isBinary: boolean) {
    let data: any = isBinary ? buffer : buffer.toString()
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

  protected onDisconnect(client: WsapixClient<T, S>, code?: number, data?: any) {
    this.clients.delete(client)
    this.emit("disconnect", client, code, data)
  }

  public serverMessage(matcher: MessageMatcher, schema?: MessageSchema) {
    this.messages.push({ kind: MessageKind.server, matcher, schema })
  }

  public clientMessage<D = any>(
    matcher: MessageMatcher,
    schema?: MessageSchema | MessageHandler<T, S, D>,
    handler?: MessageHandler<T, S, D>) {

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
  public findClientMessage(data: Record<string, any>) {
    return this.findMessage(MessageKind.client, data)
  }

  /**
   * Find server message by payload
   * @param data - message payload
   * @returns Message or undefined
   */
  public findServerMessage(data: Record<string, any>): WsapixMessage<T, S, any> | undefined {
    return this.findMessage(MessageKind.server, data)
  }

  protected inherit(channel: WsapixChannel<T, S>) {
    // set default channel parameters
    this._parser = this._parser || channel.parser
    this._serializer = this._serializer || channel.serializer
    this.validator = this.validator || channel.validator

    // add middlwares and messages
    if (channel.path === "*") {
      this.middlewares = [...channel.middlewares, ...this.middlewares]
      this.messages.push(...channel.messages)
    }

    // forward events
    this.on("error", (client: WsapixClient<T, S>, data: any) => channel.emit("error", client, data))
    this.on("disconnect", (client: WsapixClient<T, S>) => channel.emit("disconnect", client))
  }

  private findMessage(type: MessageKind, data: Record<string, any>): WsapixMessage<T, S, any> | undefined {
    return this.messages.find((msg) => {
      if (msg.kind !== type) {
        return false
      }

      if (typeof msg.matcher === "function") {
        return msg.matcher(data)
      }
      else if (typeof msg.matcher === "string") {
        return data[msg.matcher] !== undefined && msg.schema?.payload?.[msg.matcher] === data[msg.matcher]
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

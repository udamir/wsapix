import { IncomingMessage } from 'http'
import WebSocket from 'ws'

import { Message } from './asyncapi/types'
import { MockSocket } from './client'
import { IWSAsyncApiParams, WSAsyncApi } from './asyncapi'
import {
  ApiMessage, WSApiMiddleware, WSApiOptions, ClientContext, MessageKind, noop, IClientInjectParams,
  isClientMessage, isServerMessage, getMatchField, getMessageHandler
} from './types'

export class WSApi<S> {
  public wss: WebSocket.Server
  public channels: Map<string, ApiMessage[]> = new Map()
  public middlewares: WSApiMiddleware<S>[] = []
  public options: WSApiOptions

  public get serializer() {
    return this.options.serializer || {
      encode: JSON.stringify,
      decode: JSON.parse
    }
  }

  private _onError: (ctx: ClientContext<S>, message: string, data?: any) => void = noop
  private _onClose?: (ctx: ClientContext<S>) => void = noop

  constructor (options: WebSocket.ServerOptions, apiOptions?: WSApiOptions ) {
    this.wss = new WebSocket.Server(options)
    this.options = apiOptions || {}
    this.wss.on("connection", this.onConnected.bind(this))
  }

  private async onConnected(ws: WebSocket, req: IncomingMessage) {
    // check if channel exist
    const channel = this.findChannel(req.url || "/")

    // create context
    const ctx = this.createContext(ws, req, channel)

    if (!channel) {
      this._onError(ctx, "Channel path not found!", req.url)
      return ws.close(4000)
    }

    // execute midllwares
    for (const middleware of this.middlewares) {
      try {
        await middleware(ctx)
      } catch (error) {
        this._onError(ctx, "Middleware error", error)
      }
      if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
        return
      }
    }

    ws.on('message', async (data: string) => this.handleChannelMessage(ctx, data))
    ws.on('close', () => this._onClose && this._onClose(ctx))
  }

  private handleChannelMessage(ctx: ClientContext<S>, data: any) {
    // decode message
    let event
    try {
      event = ctx.serializer.decode(data)
    } catch (error) {
      return this._onError(ctx, "Unexpected message payload")
    }

    const message = this.findMessage(ctx.channel, MessageKind.client, event)

    if (!message) {
      return this._onError(ctx, "Message not found")
    }

    const handler = getMessageHandler(message)

    if (!handler) {
      return this._onError(ctx, "Not implemented")
    }

    if (!this.validatePayload(message.payload, event, (msg: string) => this._onError(ctx, msg))) {
      return
    }

    handler(ctx, event)
  }

  public async inject(params: IClientInjectParams) {
    const { url, headers, ...handlers } = params
    const socket = new MockSocket(handlers)
    const req = { url, headers } as IncomingMessage
    await this.onConnected(socket, req)
    return socket.client
  }

  public asyncapi(params: IWSAsyncApiParams): string {
    const asyncapi = new WSAsyncApi(params)
    for (const [ path, messages ] of this.channels) {
      // parse path params
      const pathParams = {}

      // split pubsub messages
      const pubMessages: Message[] = []
      const subMessages: Message[] = []

      for (const msg of messages) {
        if (isServerMessage(msg)) {
          subMessages.push(msg)
        } else {
          pubMessages.push(msg)
        }
      }

      // add channel
      asyncapi.addChannel(path, pubMessages, subMessages, pathParams)
    }

    return asyncapi.generate()
  }

  public channelMessages(name: string) {
    const messages = this.channels.get(name)
    if (!messages) { return [] }
    return messages.filter(isClientMessage)
  }

  public channelEvents(name: string) {
    const messages = this.channels.get(name)
    if (!messages) { return [] }
    return messages.filter(isServerMessage)
  }

  public findMessage(channel: string, messageType: MessageKind, data: { [key: string]: any }) {
    const messages = this.channels.get(channel) || []
    return messages.find((msg) => {
      if (isServerMessage(msg) && messageType !== MessageKind.server) {
        return false
      }
      const field = getMatchField(msg)
      for (const key of Object.keys(field)) {
        if (data[key] !== field[key]) {
          return false
        }
      }
      return true
    })
  }

  public findChannel(url: string): string {
    const [path] = url.split("?")

    for (const channel of this.channels.keys()) {
      const exp = new RegExp("\/" + channel
        .replace(/^\/+|\/+$/g, "")
        .split("/")
        .map((item) => item[0] === "{" && item.slice(-1) === "}" ? "[A-Za-z0-9_.\-]+" : item)
        .join("\/") + "$")

        if (exp.test(path)) {
          return channel
        }
    }

    return this.channels.has("*") ? "*" : ""
  }

  public validatePayload = (schema: any, payload: any, error?: (msg: string) => void): boolean => {
    if (this.options.validator) {
      return this.options.validator(schema, payload, error)
    }
    return true
  }

  private createContext (ws: WebSocket, req: IncomingMessage, channel: string): ClientContext<S> {
    const ctx = {
      ws,
      req,
      channel,
      serializer: this.serializer,
      state: {} as S
    } as any

    ctx.send = (data: any, cb?: (err?: Error) => void) => {
      if (this.options.validator) {
        const message = this.findMessage(ctx.channel, MessageKind.server, data)

        if (!message) {
          const error = new Error("Cannot send message: Message schema not found")
          if (cb) { return cb(error) } else { throw error }
        }

        if (!this.validatePayload(message.payload, data, (msg) => cb && cb(new Error(msg)))) {
          if (!cb) { throw new Error("Cannot send message: Payload validation error") }
        }
      }

      // encode message
      const payload = ctx.serializer.encode(data)
      ws.send(payload, cb)
    }

    return ctx
  }

  public use(middleware: WSApiMiddleware<S>) {
    this.middlewares.push(middleware)
  }

  public path(path: string, messages: ApiMessage[]) {
    this.channels.set(path, messages)
  }

  public onError(handler: (ctx: ClientContext<S>, error: string, data?: any) => void) {
    this._onError = handler
  }

  public onClose(handler: (ctx: ClientContext<S>) => void) {
    this._onClose = handler
  }

  public close() {
    this.wss.off("connection", this.onConnected.bind(this))
  }
}

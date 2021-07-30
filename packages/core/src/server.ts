import { IncomingMessage } from 'http'
import WebSocket from 'ws'

import { Message } from './asyncapi/types'
import { MockSocket } from './client'
import { WSChannel, ChannelOptions } from './channel'
import { ClientContext } from './context'
import { IWSAsyncApiParams, WSAsyncApi } from './asyncapi'
import {
  WSApiMiddleware, WSApiOptions, noop,
  IClientInjectParams, isServerMessage, getMessageHandler, 
} from './types'

export type WSApiPlugin<S> = (wsapi: WSApi<S>) => Promise<void> | void

export class WSApi<S> {
  public wss: WebSocket.Server
  public channels: Map<string, WSChannel> = new Map()
  public middlewares: WSApiMiddleware<S>[] = []
  public options: WSApiOptions

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
    if (!ctx.channel) {
      throw new Error(`Cannot handle client message: channel expected`)
    }

    // decode message
    let event
    try {
      event = ctx.channel.serializer.decode(data)
    } catch (error) {
      return this._onError(ctx, "Unexpected message payload", data)
    }

    const message = ctx.channel.findClientMessage(event)

    if (!message) {
      return this._onError(ctx, "Message not found", event)
    }

    const handler = getMessageHandler(message)

    if (!handler) {
      return this._onError(ctx, `Handler for '${ctx.channel.path}' not implemented`, event)
    }

    if (!ctx.validatePayload(message.payload, event, (msg: string) => this._onError(ctx, msg))) {
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
    for (const [ path, channel ] of this.channels) {
      // parse path params
      const pathParams = {}

      // split pubsub messages
      const pubMessages: Message[] = []
      const subMessages: Message[] = []

      for (const msg of channel.messages) {
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

  public findChannel(url: string): WSChannel | undefined {
    const [path] = url.split("?")

    for (const [channelPath, channel] of this.channels) {
      const exp = new RegExp("\/" + channelPath
        .replace(/^\/+|\/+$/g, "")
        .split("/")
        .map((item) => item[0] === "{" && item.slice(-1) === "}" ? "[A-Za-z0-9_.\-]+" : item)
        .join("\/") + "$")

        if (exp.test(path)) {
          return channel
        }
    }

    return this.channels.get("*")
  }

  private createContext (ws: WebSocket, req: IncomingMessage, channel?: WSChannel): ClientContext<S> {
    return new ClientContext(ws, req, channel)
  }

  public use(middleware: WSApiMiddleware<S>) {
    this.middlewares.push(middleware)
  }

  public route(options: ChannelOptions | WSChannel): WSChannel {
    const channel = options instanceof WSChannel ? options : new WSChannel(options)
    const path = channel.path
    if (this.channels.has(path)) {
      throw new Error(`Path '${path}' already exist!`)
    }
    channel._serializer = channel._serializer || this.options.serializer
    channel.validator = channel.validator || this.options.validator
    this.channels.set(path, channel)
    return channel
  }

  public register(plugin: WSApiPlugin<S>) {
    return plugin(this)
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

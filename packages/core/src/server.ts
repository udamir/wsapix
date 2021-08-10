import { IncomingMessage } from 'http'
import WebSocket from 'ws'

import { ChannelOptions, IClientInjectParams, MessageKind } from './types'
import { IWSAsyncApiParams, WSAsyncApi } from './asyncapi'
import { Message } from './asyncapi/types'
import { WsapixChannel } from './channel'
import { MockSocket } from './mock'
import { html } from './template'
import { Client } from './client'

export type WsapixPlugin<S> = (wsapi: Wsapix<S>) => Promise<void> | void

export class Wsapix<S> extends WsapixChannel<S> {
  public wss: WebSocket.Server
  public channels: Map<string, WsapixChannel<S>> = new Map()

  constructor (options: WebSocket.ServerOptions, defaultOptions?: ChannelOptions ) {
    super(defaultOptions?.path || "*", defaultOptions)
    this.wss = new WebSocket.Server(options)
    this.wss.on("connection", this.onConnected.bind(this))
  }

  private async onConnected(ws: WebSocket, req: IncomingMessage) {
    // check if channel exist
    const channel = this.findChannel(req.url || "/") || (this.path === req.url || this.path === "*") ? this : null

    if (!channel) {
      return ws.close(4000)
    }

    // create context
    const client = await channel.addClient(ws, req)

    if (!client) { return }

    ws.on('message', async (data: string) => channel.emit("message", client, data))
    ws.on('close', () => channel.deleteClient(client))
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
        if (!msg.schema) { continue }
        if (msg.kind === MessageKind.server) {
          subMessages.push(msg.schema)
        } else {
          pubMessages.push(msg.schema)
        }
      }

      // add channel
      asyncapi.addChannel(path, pubMessages, subMessages, pathParams)
    }

    return asyncapi.generate()
  }

  public htmlDocTemplate(asyncApiPath: string, title?: string) {
    return html(asyncApiPath, title)
  }

  public findChannel(url: string): WsapixChannel<S> | undefined {
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

  public route(path: string | WsapixChannel<S> | ChannelOptions, options?: ChannelOptions): WsapixChannel<S> {
    // create channel
    const channel = path instanceof WsapixChannel ? path : new WsapixChannel<S>(path, options)
    const channelPath = channel.path
    if (channelPath === this.path || this.channels.has(channelPath)) {
      throw new Error(`Path '${channelPath}' already exist!`)
    }

    // set default channel parameters
    channel._serializer = channel._serializer || this.serializer
    channel.validator = channel.validator || this.validator
    channel.messages.push(...this.messages)

    // forward events
    channel.on("error", (client: Client<S>, data: any) => this.emit("error", client, data))
    channel.on("close", (client: Client<S>) => this.emit("close", client))

    this.channels.set(channelPath, channel)
    return channel
  }

  public register(plugin: WsapixPlugin<S>) {
    return plugin(this)
  }

  public close() {
    this.wss.off("connection", this.onConnected.bind(this))
    this.wss.close()
  }
}

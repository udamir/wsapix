import type { TemplatedApp } from 'uWebSockets.js'
import type { ServerOptions } from 'ws'

import { Transport, WebsocketTransport, WebsocketOptions, uWebsocketTransport } from './transport'
import { ChannelOptions, MessageKind, WsapixClient } from './types'
import { IAsyncApiBuilderParams, AsyncApiBuilder, Message } from './asyncapi'
import { WsapixChannel } from './channel'
import { html } from './template'

export type WsapixPlugin<S> = (wsapi: Wsapix<S>) => Promise<void> | void

export class Wsapix<S = any> extends WsapixChannel<S> {
  public channels: Map<string, WsapixChannel<S>> = new Map()

  static WS<S = any>(options: ServerOptions, defaultOptions?: ChannelOptions) {
    const transport = new WebsocketTransport<S>(options)
    return new Wsapix<S>(transport, defaultOptions)
  }

  static uWS<S = any>(options: { server: TemplatedApp } & WebsocketOptions, defaultOptions?: ChannelOptions) {
    const transport = new uWebsocketTransport<S>(options)
    return new Wsapix<S>(transport, defaultOptions)
  }

  constructor (public transport:  Transport<S>, defaultOptions?: ChannelOptions ) {
    super(defaultOptions?.path || "*", defaultOptions)

    this.transport.onConnection(this.onConnected.bind(this))
    this.transport.onMessage(this.onMessage.bind(this))
    this.transport.onDisconnect(this.onDisconnect.bind(this))
    this.transport.onError((error: Error) => this.emit("error", error?.message || ""))
  }

  protected async onConnected(client: WsapixClient<S>) {
    // check if channel exist
    const channel = this.findChannel(client.path)

    if (!channel) {
      return client.terminate(4000)
    }

    // handle client connection to channel
    super.onConnect.call(channel, client)
  }

  protected onMessage(client: WsapixClient<S>, data: any) {
    if (!client.channel) { return }

    super.onMessage.call(client.channel, client, data)
  }

  protected onDisconnect(client: WsapixClient<S>, code?: number, data?: any) {
    if (!client.channel) { return }

    super.onDisconnect.call(client.channel, client, code, data)
  }

  public asyncapi(params: IAsyncApiBuilderParams): string {
    const asyncapi = new AsyncApiBuilder(params)
    const channels = [ this, ...this.channels.values() ]
    for (const channel of channels) {
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
      asyncapi.addChannel(channel.path, pubMessages, subMessages, pathParams)
    }

    return asyncapi.generate()
  }

  public htmlDocTemplate(asyncApiPath: string, title?: string) {
    return html(asyncApiPath, title)
  }

  public findChannel(url: string = "/"): WsapixChannel<S> | undefined {
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

    return (this.path === url || this.path === "*") ? this : this.channels.get("*")
  }

  public route(path: string | WsapixChannel<S> | ChannelOptions, options?: ChannelOptions): WsapixChannel<S> {
    // create channel
    const channel = path instanceof WsapixChannel ? path : new WsapixChannel<S>(path, options)
    const channelPath = channel.path
    if (channelPath === this.path || this.channels.has(channelPath)) {
      throw new Error(`Path '${channelPath}' already exist!`)
    }

    this.inherit.call(channel, this)

    this.channels.set(channelPath, channel)
    return channel
  }

  public register(plugin: WsapixPlugin<S>) {
    return plugin(this)
  }

  public close(cb?: (error?: Error) => void) {
    return this.transport.close(cb)
  }
}

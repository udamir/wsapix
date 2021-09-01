import type { TemplatedApp } from 'uWebSockets.js'
import type { ServerOptions } from 'ws'

import { Transport, WebsocketTransport, WebsocketOptions, uWebsocketTransport } from './transport'
import { IAsyncApiBuilderParams, AsyncApiBuilder, Message } from './asyncapi'
import { ChannelOptions, MessageKind, WsapixClient } from './types'
import { WsapixChannel } from './channel'
import { html } from './template'

/**
 * Wsapix extention
 * @param wsapix - wsapix instance
 */
export type WsapixPlugin<S> = (wsapi: Wsapix<S>) => Promise<void> | void

export class Wsapix<S = any> extends WsapixChannel<S> {
  /**
   * Map of registered routes
   */
  public channels: Map<string, WsapixChannel<S>> = new Map()

  /**
   * Create Wsapix instance on Http server
   * @param options - Http server options
   * @param defaultOptions - channel options
   * @returns Wsapix instance
   */
  static WS<S = any>(options: ServerOptions, defaultOptions?: ChannelOptions<S>) {
    const transport = new WebsocketTransport(options)
    return new Wsapix<S>(transport, defaultOptions)
  }

  /**
   * Create Wsapix instance on uWebSockets server
   * @param options - uWebsocket server and options
   * @param defaultOptions - channel options
   * @returns Wsapix instance
   */
  static uWS<S = any>(options: { server: TemplatedApp } & WebsocketOptions, defaultOptions?: ChannelOptions<S>) {
    const transport = new uWebsocketTransport(options)
    return new Wsapix<S>(transport, defaultOptions)
  }

  /**
   * Wsapix constructor
   * @param transport - wsapix transport
   * @param defaultOptions - channel options
   */
  constructor (public transport: Transport, defaultOptions?: ChannelOptions<S>) {
    super(defaultOptions?.path || "*", defaultOptions)
    this.setTransport(transport)
  }

  /**
   * Update wsapix transport
   * @param transport - wsapix transport
   */
  public setTransport(transport: Transport) {
    this.transport = transport
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

  protected async onMessage(client: WsapixClient<S>, data: any) {
    if (!client.channel) { return }

    return super.onMessage.call(client.channel, client, data)
  }

  protected onDisconnect(client: WsapixClient<S>, code?: number, data?: any) {
    if (!client.channel) { return }

    super.onDisconnect.call(client.channel, client, code, data)
  }

  /**
   * Generate AsyncApi specification in json format
   * @param params - AsyncApi specification parts (info, servers, defaultContentType, tags, externalDocs)
   * @returns AsyncApi documentation json
   */
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

  /**
   * @public
   * Generate HTML template for AsyncApi documentation
   * @param asyncApiPath - url for AsyncApi json file
   * @param title - Page title
   * @returns - HTML page
   */
  public htmlDocTemplate(asyncApiPath: string, title?: string) {
    return html(asyncApiPath, title)
  }

  /**
   * Find channel by url
   * @param url
   * @returns channel or undefined
   */
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

  /**
   * Register route channel
   * @param path - route path or channel
   *
   * @example
   * Create new route
   * ```ts
   * const chat = wsx.route("/chat", { parser, serializer })
   * ```
   *
   * Register existing channel instance
   * ```ts
   * const chat = new WsapixChannel("/chat", { parser, serializer })
   * wsx.route(chat)
   * ```
   * Route path supports parameters:
   * @example
   * `/rooms/{id}`
   *
   * @param options - channel options
   * @returns Channel instance
   */
  public route(path: string | WsapixChannel<S> | ChannelOptions<S>, options?: ChannelOptions<S>): WsapixChannel<S> {
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

  /**
   * Plug extension
   * @param plugin - Wsapix extention
   * @returns void
   */
  public register(plugin: WsapixPlugin<S>) {
    return plugin(this)
  }

  /**
   * Gracefull shutdown
   * @param cb - Callback funxtion
   * @returns promise
   */
  public close(cb?: (error?: Error) => void) {
    return this.transport.close(cb)
  }
}

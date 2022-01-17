import { Transport, WebsocketTransport, uWebsocketOptions, uWebsocketTransport, IClientInjectParams } from 'rttl'
import type { TemplatedApp, WebSocket as uWebSocket } from 'uWebSockets.js'
import { ServerOptions, WebSocket } from 'ws'

import { IAsyncApiBuilderParams, AsyncApiBuilder, Message } from './asyncapi'
import { WsapixClient, ChannelOptions, MessageKind } from './types'
import { WsapixChannel } from './channel'
import { html } from './template'

/**
 * Wsapix extention
 * @param wsapix - wsapix instance
 */
export type WsapixPlugin<T = any, S = any> = (wsapi: Wsapix<T, S>) => Promise<void> | void

export class Wsapix<T = any, S = any> extends WsapixChannel<T, S> {
  /**
   * Map of registered routes
   */
  public channels: Map<string, WsapixChannel<T, S>> = new Map()

  /**
   * Create Wsapix instance on Http server
   * @type Q - Client state interface
   * @param options - Http server options
   * @param defaultOptions - channel options
   * @returns Wsapix instance
   */
  static WS<Q>(options: ServerOptions, defaultOptions?: ChannelOptions<WebSocket, Q>) {
    const transport = new WebsocketTransport(options)
    return new Wsapix<WebSocket, Q>(transport, defaultOptions)
  }

  /**
   * Create Wsapix instance on uWebSockets server
   * @type Q - Client state interface
   * @param options - uWebsocket server and options
   * @param defaultOptions - channel options
   * @returns Wsapix instance
   */
  static uWS<Q>(options: { server: TemplatedApp } & uWebsocketOptions, defaultOptions?: ChannelOptions<uWebSocket, Q>) {
    const transport = new uWebsocketTransport(options)
    return new Wsapix<uWebSocket, Q>(transport, defaultOptions)
  }

  /**
   * Wsapix constructor
   * @type T - Transport socket interface
   * @type S - Client state interface
   * @param transport - wsapix transport
   * @param defaultOptions - channel options
   */
  constructor (public transport: Transport<T>, defaultOptions?: ChannelOptions<T, S>) {
    super(defaultOptions?.path || "*", defaultOptions)
    this.setTransport(transport)
  }

  /**
   * Update wsapix transport
   * @param transport - wsapix transport
   */
  public setTransport(transport: Transport<T>) {
    this.transport = transport
    this.transport.onConnection((client) => this.onConnected(client as WsapixClient<T, S>))
    this.transport.onMessage((client, data, isBinary) => this.onMessage(client as WsapixClient<T, S>, data, isBinary))
    this.transport.onDisconnect((client, code, data) => this.onDisconnect(client as WsapixClient<T, S>, code, data))
    this.transport.onError((error: Error) => this.emit("error", error?.message || ""))
  }

  protected async onConnected(client: WsapixClient<T, S>) {
    // check if channel exist
    const channel = this.findChannel(client.path)

    if (!channel) {
      return client.terminate(4000)
    }

    // handle client connection to channel
    super.onConnect.call(channel, client)
  }

  protected async onMessage(client: WsapixClient<T, S>, data: Buffer, isBinary: boolean) {
    if (!client.channel) { return }

    return super.onMessage.call(client.channel, client, data, isBinary)
  }

  protected onDisconnect(client: WsapixClient<T, S>, code?: number, data?: any) {
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
  public findChannel(url: string = "/"): WsapixChannel<T, S> | undefined {
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
  public route(path: string | WsapixChannel<T, S> | ChannelOptions<T, S>, options?: ChannelOptions<T, S>): WsapixChannel<T, S> {
    // create channel
    const channel = path instanceof WsapixChannel ? path : new WsapixChannel<T, S>(path, options)
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
  public register(plugin: WsapixPlugin<T, S>) {
    return plugin(this)
  }

  /**
   * Inject mock client
   * @param url - connection url
   * @param params.connectionDelay - connection deleay (optional)
   * @param params.headers - connection headers (optional)
   * @returns MockSocket
   */
  public inject(url?: string, params?: IClientInjectParams) {
    return this.transport.inject(url, params)
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

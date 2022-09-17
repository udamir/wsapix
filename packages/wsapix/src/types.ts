import { Client } from 'rttl'

import { MessageSchema } from './asyncapi'
import { WsapixChannel } from './channel'

/**
 * Function for message payload validation
 * @param schema - Message JsonSchema
 * @param data - Message payload
 * @param error - Callback function to get error message
 * @returns Validation result
 */
export type MessageValidator = (schema: any, data: any, error: (msg: string) => void) => boolean

/**
 * Parser/Serializer function
 * @param data - Serialized/Parsed data
 * @returns Parser/Serialized data
 */
export type DataParser = (data: any) => any

/**
 * WsapixChannel constructor options
 */
export interface ChannelOptions<T, S> {
  /**
   * Channel route
   */
  path?: string

  /**
   * Client request schema
   */
  schema?: ClientRequestSchema

  /**
   * List of WsapixMessages for this channel
   */
  messages?: WsapixMessage<T, S, any>[]

  /**
   * Channel parser
   * @default "json" (JSON.parse)
   */
  parser?: "json" | null | DataParser

  /**
   * Channel serializer
   * @default "json" (JSON.stringify)
   */
  serializer?: "json" | null | DataParser

  /**
   * Message payload validator function
   */
  validator?: MessageValidator
}

/**
 * Message source
 */
export enum MessageKind {
  client = 0,
  server = 1
}

/**
 * Handler function for client messages
 * @param client - client context
 * @param data - message payload
 */
export type MessageHandler<T, S, D> = (client: WsapixClient<T, S>, data: D) => void

/**
 * Payload matcher - object or function - to find relevant message in channel
 *
 * @example
 * Object payload matcher check values of all key values in payload:
 * ```ts
 * wsx.clientMessage({ type: "text" }, handler)
 * ```
 *
 * Function payload matcher returns if payload match channel message:
 * ```ts
 * wsx.clientMessage((data: any) => data.type === "text", handler)
 * ```
 */
export type MessageMatcher = { [key: string]: string } | ((data: any) => boolean) | string

/**
 *
 */
export interface WsapixMessage<T, S, D> {
  /**
   * Message kind - server or client
   */
  kind: MessageKind

  /**
   * Message payload matcher
   */
  matcher: MessageMatcher

  /**
   * Message handler
   */
  handler?: MessageHandler<T, S, D>

  /**
   * Message payload JsonSchema
   */
  schema?: MessageSchema
}

export interface ClientRequestSchema {
  query?: Record<string, unknown>
  params?: Record<string, unknown>
  headers?: Record<string, unknown>
}

export type WsapixClient<T = any, S = any> = Client<T> & {
  /**
   * Link to client channel
   */
  channel: WsapixChannel<T, S>

  /**
   * Client request path params
   */
  pathParams?: { [key: string]: string }

  /**
   * Client request query params
   */
  queryParams?: { [key: string]: string }

  /**
   * Client state
   */
  state: S
}

/**
 * Middleware - client connection hook
 *
 * @example
 * Client authentication by query or headers
 */

export { Transport } from "rttl"

export type WsapixMiddleware<T, S> = (client: WsapixClient<T, S>) => void | Promise<void>

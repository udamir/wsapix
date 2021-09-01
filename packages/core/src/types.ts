import { MessageSchema } from './asyncapi'
import { WsapixChannel } from './channel'
import { Client } from './transport'

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
export interface ChannelOptions<S> {
  /**
   * Channel route
   */
  path?: string

  /**
   * List of WsapixMessages for this channel
   */
  messages?: WsapixMessage<S>[]

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
export type MessageHandler<S, T = any> = (client: WsapixClient<S>, data: T) => void

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
export type MessageMatcher = { [key: string]: string } | ((data: any) => boolean)

/**
 *
 */
export interface WsapixMessage<S = any, T = any> {
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
  handler?: MessageHandler<S, T>

  /**
   * Message payload JsonSchema
   */
  schema?: MessageSchema
}

export type WsapixClient<S = any> = Client & {
  /**
   * Link to client channel
   */
  channel?: WsapixChannel<S>

  /**
   * Client state
   */
  state?: S
}

/**
 * Middleware - client connection hook
 *
 * @example
 * Client authentication by query or headers
 */
export type WsapixMiddleware<T> = (client: WsapixClient<T>) => void | Promise<void>

import { IncomingHttpHeaders } from 'http'

import { MessageSchema } from './asyncapi'
import { WsapixChannel } from './channel'
import { Client } from './transport'

export type MessageValidator = (schema: any, data: any, error?: (msg: string) => void) => boolean

export type DataParser = (data: any) => any

export interface ChannelOptions {
  path?: string
  messages?: WsapixMessage[]
  parser?: "json" | null | DataParser
  serializer?: "json" | null | DataParser
  validator?: MessageValidator
}

export enum MessageKind {
  client = 0,
  server = 1
}
export type MessageHandler<S = any, T = any> = (ctx: WsapixClient<S>, data: T) => void
export type MessageMatcher = { [key: string]: string } | ((data: any) => boolean)

export interface WsapixMessage {
  kind: MessageKind
  matcher: MessageMatcher
  handler?: MessageHandler
  schema?: MessageSchema
}

export type WsapixClient<S = any> = Client & { 
  channel?: WsapixChannel<S>
  state?: S
}

export type WsapixMiddleware<T> = (ctx: WsapixClient<T>) => void | Promise<void>

export interface IClientHandlers {
  onopen?: () => void
  onerror?: (message: string, error: any) => void
  onclose?: (code: number, reason: string) => void
  onmessage?: (data: string | Buffer | ArrayBuffer | Buffer[]) => void
}

export interface IClientInjectParams extends IClientHandlers{
  url?: string
  headers?: IncomingHttpHeaders
}

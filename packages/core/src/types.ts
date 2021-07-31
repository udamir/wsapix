import { IncomingHttpHeaders } from 'http'

import { MessageSchema } from './asyncapi'
import { ClientContext } from './context'

export type WSMsgValidator = (schema: any, data: any, error?: (msg: string) => void) => boolean

export interface ISerializer {
  encode: (data: any) => any
  decode: (data: any) => any
}

export interface WSApiOptions {
  serializer?: ISerializer
  validator?: WSMsgValidator
}

export enum WSMsgKind {
  client = 0,
  server = 1
}
export type WSMsgHandler<S = any, T = any> = (ctx: ClientContext<S>, data: T) => void
export type WSMsgMatcher = { [key: string]: string } | ((data: any) => boolean)

export interface WSMessage {
  kind: WSMsgKind
  matcher: WSMsgMatcher
  handler?: WSMsgHandler
  schema?: MessageSchema
}

export type WSApiMiddleware<T> = (ctx: ClientContext<T>) => void | Promise<void>

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

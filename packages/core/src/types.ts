import { IncomingHttpHeaders } from 'http'

import { MessageSchema } from './asyncapi'
import { ClientContext } from './context'

// tslint:disable-next-line: no-empty
export const noop = () => {}

export type WSApiValidator = (schema: any, data: any, error?: (msg: string) => void) => boolean

export interface IWSSerializer {
  encode: (data: any) => any
  decode: (data: any) => any
}

export interface WSApiOptions {
  serializer?: IWSSerializer
  validator?: WSApiValidator
}

export enum MessageKind {
  client = 0,
  server = 1
}
export type MessageHandler<S = any, T = any> = (ctx: ClientContext<S>, data: T) => void
export type MessageMatcher = { [key: string]: string } | ((data: any) => boolean)

export interface ApiMessageParams {
  kind: MessageKind
  matcher: MessageMatcher
  handler?: MessageHandler
}

const $meta = Symbol("meta")
export interface ApiMessage extends MessageSchema {
  [$meta]: ApiMessageParams
}

export const clientMessage = (matcher: MessageMatcher, message?: MessageSchema | MessageHandler,
  handler?: MessageHandler): ApiMessage => {
  if (typeof message === "function") {
    handler = message
    message = undefined
  }

  return {
    [$meta]: {
      kind: MessageKind.client,
      matcher,
      handler
    },
    ...message,
  }
}

export const serverMessage = (matcher: MessageMatcher, message?: MessageSchema): ApiMessage => ({
  [$meta]: {
    kind: MessageKind.server,
    matcher
  },
  ...message,
})

export const isClientMessage = (msg: ApiMessage): boolean => msg[$meta].kind === MessageKind.client
export const isServerMessage = (msg: ApiMessage): boolean => msg[$meta].kind === MessageKind.server
export const getMessageMatcher = (msg: ApiMessage): MessageMatcher => msg[$meta].matcher
export const getMessageHandler = (msg: ApiMessage): MessageHandler | undefined => msg[$meta].handler

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

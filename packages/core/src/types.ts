import { IncomingHttpHeaders, IncomingMessage } from 'http'
import WebSocket from 'ws'

import { MessageSchema } from './asyncapi'

// tslint:disable-next-line: no-empty
export const noop = () => {}

export type WSApiValidator = (schema: any, data: any, error?: (msg: string) => void) => boolean

export interface IWSSerializer {
  encode: (data: any) => WebSocket.Data
  decode: (data: WebSocket.Data) => any
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
export type MessageMatchField = { [key: string]: string }

export interface ApiMessageParams {
  kind: MessageKind
  matchField: MessageMatchField
  handler?: MessageHandler
}

const $meta = Symbol("meta")
export interface ApiMessage extends MessageSchema {
  [$meta]: ApiMessageParams
}

export const apiMessage = (message: MessageSchema, params: ApiMessageParams): ApiMessage => ({
  [$meta]: params,
  ...message,
})

export const clientMessage = (matchField: MessageMatchField, message: MessageSchema,
  handler: MessageHandler): ApiMessage => ({
  [$meta]: {
    kind: MessageKind.client,
    matchField,
    handler
  },
  ...message,
})

export const serverMessage = (matchField: MessageMatchField, message: MessageSchema): ApiMessage => ({
  [$meta]: {
    kind: MessageKind.server,
    matchField
  },
  ...message,
})

export const isClientMessage = (msg: ApiMessage): boolean => msg[$meta].kind === MessageKind.client
export const isServerMessage = (msg: ApiMessage): boolean => msg[$meta].kind === MessageKind.server
export const getMatchField = (msg: ApiMessage): MessageMatchField => msg[$meta].matchField
export const getMessageHandler = (msg: ApiMessage): MessageHandler | undefined => msg[$meta].handler

export interface ClientContext<T> {
  ws: WebSocket
  req: IncomingMessage
  state: T
  channel: string
  serializer: IWSSerializer
  send: (data: any, cb?: (err?: Error) => void) => void
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

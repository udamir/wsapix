import { IncomingMessage } from 'http'
import WebSocket from 'ws'

import { WSMessage } from './asyncapi'

// tslint:disable-next-line: no-empty
export const noop = () => {}

export enum MessageKind {
  client = 0,
  server = 1
}

export type WSApiValidator = (schema: any, data: any, error?: (msg: string) => void) => boolean

export interface IWSSerializer {
  encode: (data: any) => WebSocket.Data
  decode: (data: WebSocket.Data) => any
}

export interface WSApiOptions {
  serializer?: IWSSerializer
  validator?: WSApiValidator
}

export const $meta = Symbol("meta")

export type ApiMessageHandler<S = any, T = any> = (ctx: ClientContext<S>, data: T) => void

export interface ApiMessageParams {
  kind: MessageKind
  matchField: {
    [key: string]: string
  }
  handler?: ApiMessageHandler
}

export interface ApiMessage extends WSMessage {
  [$meta]: ApiMessageParams
}

export const apiMessage = (message: WSMessage, params: ApiMessageParams): ApiMessage => ({
  [$meta]: params,
  ...message,
})

export interface ClientContext<T> {
  ws: WebSocket
  req: IncomingMessage
  state: T
  channel: string
  serializer: IWSSerializer
  send: (data: any, cb?: (err?: Error) => void) => void
}

export type WSApiMiddleware<T> = (ctx: ClientContext<T>) => void | Promise<void>

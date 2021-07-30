import { MessageSchema } from './asyncapi'
import {
  ApiMessage,
  clientMessage,
  getMessageMatcher,
  isClientMessage,
  IWSSerializer,
  MessageHandler,
  MessageKind,
  MessageMatcher,
  serverMessage,
  WSApiOptions,
  WSApiValidator
} from './types'

export interface ChannelOptions extends WSApiOptions {
  path?: string
  messages?: ApiMessage[]
}

export class WSChannel {
  public messages: ApiMessage[] = []
  public path: string
  public _serializer: IWSSerializer | undefined
  public validator: WSApiValidator | undefined

  public get serializer(): IWSSerializer {
    return this._serializer || {
      encode: JSON.stringify,
      decode: JSON.parse
    }
  }

  constructor(params?: ChannelOptions) {
    this.path = params?.path || ""
    this.validator = params?.validator
    this.messages = params?.messages || []
    this._serializer = params?.serializer
  }

  public serverMessage (matcher: MessageMatcher, message?: MessageSchema) {
    this.messages.push(serverMessage(matcher, message))
  }

  public clientMessage (matcher: MessageMatcher, message?: MessageSchema | MessageHandler, handler?: MessageHandler) {
    this.messages.push(clientMessage(matcher, message, handler))
  }

  public findClientMessage(data: { [key: string]: any }) {
    return this.findMessage(MessageKind.client, data)
  }

  public findServerMessage(data: { [key: string]: any }) {
    return this.findMessage(MessageKind.client, data)
  }

  public findMessage(type: MessageKind, data: { [key: string]: any }) {
    const messages = this.messages || []
    return messages.find((msg) => {
      if (!isClientMessage(msg) && type === MessageKind.client) {
        return false
      }
      const matcher = getMessageMatcher(msg)
      let fields = Object.keys(matcher).length

      for (const key of Object.keys(matcher)) {
        if (typeof matcher === "function") {
          fields -= matcher(data) ? 1 : 0
        } else {
          fields -= data[key] === matcher[key] ? 1 : 0
        }
      }
      return fields === 0
    })
  }
}

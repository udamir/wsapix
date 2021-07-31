import { WSMessage, ISerializer, WSMsgHandler, WSMsgKind,  WSMsgMatcher, WSApiOptions, WSMsgValidator } from './types'
import { MessageSchema } from './asyncapi'

export interface ChannelOptions extends WSApiOptions {
  path?: string
  messages?: WSMessage[]
}

export class WSChannel {
  public messages: WSMessage[] = []
  public path: string
  public _serializer: ISerializer | undefined
  public validator: WSMsgValidator | undefined

  public get serializer(): ISerializer {
    return this._serializer || {
      encode: JSON.stringify,
      decode: JSON.parse
    }
  }

  constructor(path?: string | ChannelOptions, options?: ChannelOptions) {
    if (typeof path === "object") {
      options = path
      path = path.path
    }
    this.path = options?.path || "/"
    this.validator = options?.validator
    this.messages = options?.messages || []
    this._serializer = options?.serializer
  }

  public serverMessage (matcher: WSMsgMatcher, schema?: MessageSchema) {
    this.messages.push({ kind: WSMsgKind.server, matcher, schema })
  }

  public clientMessage (matcher: WSMsgMatcher, schema?: MessageSchema | WSMsgHandler, handler?: WSMsgHandler) {

    if (typeof schema === "function") {
      handler = schema
      schema = undefined
    }

    this.messages.push({ kind: WSMsgKind.client, matcher, handler, schema })
  }

  public findClientMessage(data: { [key: string]: any }) {
    return this.findMessage(WSMsgKind.client, data)
  }

  public findServerMessage(data: { [key: string]: any }) {
    return this.findMessage(WSMsgKind.client, data)
  }

  public findMessage(type: WSMsgKind, data: { [key: string]: any }) {
    const messages = this.messages || []
    return messages.find((msg) => {
      if (msg.kind !== type) {
        return false
      }
      let fields = Object.keys(msg.matcher).length

      for (const key of Object.keys(msg.matcher)) {
        if (typeof msg.matcher === "function") {
          fields -= msg.matcher(data) ? 1 : 0
        } else {
          fields -= data[key] === msg.matcher[key] ? 1 : 0
        }
      }
      return fields === 0
    })
  }
}

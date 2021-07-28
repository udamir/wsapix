import { Channel, ExternalDocs, Info, JsonSchema, Message, Ref, Server, Tag } from "./types"

export interface IWSAsyncApiParams {
  info: Info
  servers?: { [name: string]: Server }
  defaultContentType?: string
  tags?: Array<Tag>
  externalDocs?: ExternalDocs
}

export type WSMessage = Message & { $id?: string }

export class WSAsyncApi {
  public channels: Map<string, Channel> = new Map()
  public messages: Map<string, Message> = new Map()
  public schemas: Map<string, JsonSchema> = new Map()

  constructor(public params: IWSAsyncApiParams) {
  }

  public generate() {

    const map2obj = <T>(map: Map<string, T>) => {
      const result: any = {}
      map.forEach((value, key) => result[key] = value)
      return result
    }

    return JSON.stringify({
      asyncapi: "2.0.0",
      ... this.params,
      channels: map2obj(this.channels),
      components: {
        messages: map2obj(this.messages),
        schemas: map2obj(this.schemas)
      }
    })
  }

  public addChannel(name: string, pubMessages: WSMessage[], subMessages: WSMessage[], params?: any ) {
    this.channels.set(name, {
      ... pubMessages.length ? { publish: {
        description: "Send messages to the server",
        operationId: "sendMessage",
        message: {
          ...pubMessages.length > 1 ? {
            oneOf: pubMessages.map((msg) => this.addMessageRef(msg))
          } : this.addMessageRef(pubMessages[0])
        }
      }} : {},
      ... subMessages.length ? { subscribe: {
        description: "Messages that you receive from the server",
        operationId: "onMessage",
        message: {
          ...subMessages.length > 1 ? {
            oneOf: subMessages.map((msg) => this.addMessageRef(msg))
          } : this.addMessageRef(subMessages[0])
        }
      }} : {},
    })
  }

  private addMessageRef (msg: WSMessage): Message | Ref {
    const { $id, ...data } = msg
    if ($id) {
      const payload = this.addSchemaRef(msg.payload)
      this.messages.set($id, { ...data, payload })
    }
    return $id ? { $ref: `#/components/messages/${$id}` } : data
  }

  private addSchemaRef = (schema: JsonSchema): Message | Ref => {
    const { $id, ...data } = schema
    if ($id) {
      if (data.type === "object") {
        Object.keys(schema.properties).forEach((key: string) => {
          data.properties[key] = this.addSchemaRef(schema.properties[key])
        })
      } else if (schema.type === "array") {
        data.items = this.addSchemaRef(schema.items)
      }
      this.schemas.set($id, data)
    }
    return $id ? { $ref: `#/components/schemas/${$id}` } : data
  }
}

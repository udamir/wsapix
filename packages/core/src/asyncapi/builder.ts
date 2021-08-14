import { Channel, ExternalDocs, Info, JsonSchema, Message, Ref, Server, Tag } from "./types"

export interface IAsyncApiBuilderParams {
  info: Info
  servers?: { [name: string]: Server }
  defaultContentType?: string
  tags?: Array<Tag>
  externalDocs?: ExternalDocs
}

export type MessageSchema = Message & { $id?: string }

export class AsyncApiBuilder {
  public channels: Map<string, Channel> = new Map()
  public messages: Map<string, Message> = new Map()
  public schemas: Map<string, JsonSchema> = new Map()

  constructor(public params: IAsyncApiBuilderParams) {
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

  public addChannel(name: string, pubMessages: MessageSchema[], subMessages: MessageSchema[], params?: any ) {
    this.channels.set(name, {
      ... pubMessages.length ? { publish: {
        description: "Send messages to the server",
        message: {
          ...pubMessages.length > 1 ? {
            oneOf: pubMessages.map((msg) => this.addMessageRef(msg))
          } : this.addMessageRef(pubMessages[0])
        }
      }} : {},
      ... subMessages.length ? { subscribe: {
        description: "Messages that you receive from the server",
        message: {
          ...subMessages.length > 1 ? {
            oneOf: subMessages.map((msg) => this.addMessageRef(msg))
          } : this.addMessageRef(subMessages[0])
        }
      }} : {},
    })
  }

  private addMessageRef (msg: MessageSchema): Message | Ref {
    const { $id, ...data } = msg
    const payload = this.addSchemaRef(msg.payload)
    const message = { ...data, payload }
    if ($id) {
      this.messages.set($id, message)
    }
    return $id ? { $ref: `#/components/messages/${$id}` } : message
  }

  private addSchemaRef = (schema: JsonSchema): Message | Ref => {
    const { $id, ...data } = schema
    if (data.type === "object") {
      Object.keys(schema.properties).forEach((key: string) => {
        data.properties = {
          ...data.properties,
          [key]: this.addSchemaRef(schema.properties[key])
        }
      })
    } else if (schema.type === "array") {
      data.items = this.addSchemaRef(schema.items)
    }
    if ($id) {
      this.schemas.set($id, data)
      return { $ref: `#/components/schemas/${$id}` }
    }
    return data
  }
}

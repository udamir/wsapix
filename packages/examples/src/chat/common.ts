import { ApiMessage, apiMessage, ApiMessageHandler, MessageKind, Message } from "wsapix"

export const сlientMessage = (type: string, data: Message, handler: ApiMessageHandler): ApiMessage =>
  apiMessage({ $id: type, ...data }, { kind: MessageKind.client, matchField: { type }, handler })

export const serverMessage = (type: string, data: Message): ApiMessage =>
  apiMessage({ $id: type, ...data }, { kind: MessageKind.server, matchField: { type } })

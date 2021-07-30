import { MessageSchema } from './asyncapi'
import {
  ApiMessage,
  clientMessage,
  MessageHandler,
  MessageMatchField,
  serverMessage
} from './types'

export class WSChannel {
  constructor(public messages: ApiMessage[] = []) {

  }

  public serverMessage (matchField: MessageMatchField, message: MessageSchema) {
    this.messages.push(serverMessage(matchField, message))
  }

  public clientMessage (matchField: MessageMatchField, message: MessageSchema, handler: MessageHandler) {
    this.messages.push(clientMessage(matchField, message, handler))
  }
}
import { ChatReadMessageType, ChatTypingMessageType } from "./schemas"
import { MessageHandler } from "wsapix"
import { IChatClientContextState } from ".."

type ChatEventController<T> = MessageHandler<IChatClientContextState, T>

export const sendTypingStatus: ChatEventController<ChatTypingMessageType> = (client, data) => {
  console.log(client, data)
}

export const sendReadStatus: ChatEventController<ChatReadMessageType> = (client, data) => {
  console.log(client, data)
}

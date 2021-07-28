import { ChatReadMessageType, ChatTypingMessageType } from "./schemas"
import { ApiMessageHandler } from "wsapix"
import { IChatClientContextState } from ".."

type ChatEventController<T> = ApiMessageHandler<IChatClientContextState, T>

export const sendTypingStatus: ChatEventController<ChatTypingMessageType> = (ctx, data) => {
  console.log(ctx, data)
}

export const sendReadStatus: ChatEventController<ChatReadMessageType> = (ctx, data) => {
  console.log(ctx, data)
}

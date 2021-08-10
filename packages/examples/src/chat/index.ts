import { userChatSchema, chatReadMessageSchema, chatTypingMessageSchema, chatMessageSchema } from './schemas'
import { sendReadStatus, sendTypingStatus } from './controllers'
import { WsapixChannel } from "wsapix"

export const channel = new WsapixChannel({ path: "/chat" })

channel.clientMessage({ type: "chat:read"}, {
  $id: "chat:read",
  description: "User read all messages in chat",
  payload: chatReadMessageSchema,
}, sendReadStatus)


channel.clientMessage({ type: "chat:typing" }, {
  $id: "chat:typing",
  description: "User start/stop typing in chat",
  payload: chatTypingMessageSchema
}, sendTypingStatus)

channel.serverMessage({ type: "chat:add" }, {
  $id: "chat:add",
  description: "New chat added",
  payload: {
    $id: "UserChatAdd",
    type: "object",
    properties: {
      type: {
        type: "string",
        const: "chat:add"
      },
      chat: userChatSchema
    }
  },
})

channel.serverMessage({ type: "chat:delete" }, {
  $id: "chat:delete",
  description: "Chat deleted",
  payload: {
    $id: "UserChatDelete",
    type: "object",
    properties: {
      type: {
        type: "string",
        const: "chat:delete"
      },
      chatId: {
        type: "string"
      }
    }
  }
})

channel.serverMessage({ type: "chat:clean" }, {
  description: "Chat history cleaned",
  payload: {
    $id: "UserChatCleanHistory",
    type: "object",
    properties: {
      type: {
        type: "string",
        const: "chat:clean"
      },
      chatId: {
        type: "string"
      }
    }
  }
}),

channel.serverMessage({ type: "message:add" }, {
  $id: "message:add",
  description: "Chat message added",
  payload: {
    $id: "ChatMessageAdd",
    type: "object",
    properties: {
      type: {
        type: "string",
        const: "message:add"
      },
      chatId: {
        type: "string"
      },
      message: chatMessageSchema
    }
  }
})


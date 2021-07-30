import { userChatSchema, chatReadMessageSchema, chatTypingMessageSchema, chatMessageSchema } from './schemas'
import { sendReadStatus, sendTypingStatus } from './controllers'
import { WSChannel } from "wsapix"

export const channel = new WSChannel({ path: "/" })

channel.clientMessage({ type: "chat:read"}, {
  description: "User read all messages in chat",
  payload: chatReadMessageSchema,
}, sendReadStatus)


channel.clientMessage({ type: "chat:typing" }, {
  description: "User start/stop typing in chat",
  payload: chatTypingMessageSchema
}, sendTypingStatus)

channel.serverMessage({ type: "error" }, {
  description: "Backend error message",
  payload: {
    $id: "Error",
    type: "object",
    properties: {
      type: {
        type: "string",
        const: "error"
      },
      message: {
        type: "string",
      },
      code: {
        type: "number"
      }
    },
    required: ["type", "message"]
  },
})

channel.serverMessage({ type: "chat:add" }, {
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


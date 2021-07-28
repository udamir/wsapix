import { userChatSchema, chatReadMessageSchema, chatTypingMessageSchema, chatMessageSchema } from './schemas'
import { sendReadStatus, sendTypingStatus } from './controllers'
import { сlientMessage, serverMessage } from './common'
import { ApiMessage } from "wsapix"

export const messages: ApiMessage[] = [
  сlientMessage("chat:read", {
    description: "User read all messages in chat",
    payload: chatReadMessageSchema,
  }, sendReadStatus),


  сlientMessage("chat:typing", {
    description: "User start/stop typing in chat",
    payload: chatTypingMessageSchema
  }, sendTypingStatus),

  serverMessage("error", {
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
  }),

  serverMessage("chat:add", {
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
  }),

  serverMessage("chat:delete", {
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
  }),

  serverMessage("chat:clean", {
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

  serverMessage("message:add", {
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
]

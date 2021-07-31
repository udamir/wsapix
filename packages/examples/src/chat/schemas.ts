import { JsonSchema } from "wsapix"

export const chatReadMessageSchema: JsonSchema = {
  $id: "ChatReadMessage",
  type: "object",
  properties: {
    type: {
      type: "string",
      const: "chat:read"
    },
    chatId: {
      type: "string"
    }
  },
  required: ["type", "chatId"]
}

export interface ChatReadMessageType {
  type: "chat:read"
  chatId: string
}

export const chatTypingMessageSchema: JsonSchema = {
  $id: "ChatTypingMessage",
  type: "object",
  properties: {
    type: {
      type: "string",
      const: "chat:typing"
    },
    chatId: {
      type: "string"
    },
    typing: {
      type: "boolean"
    }
  },
  required: ["type", "chatId", "typing"]
}

export interface ChatTypingMessageType {
  type: "chat:typing"
  chatId: string
  typing: boolean
}

export const userChatSchema: JsonSchema = {
  $id: "Chat",
  type: "object",
  properties: {
    chatId: {
      type: "string"
    },
    name: {
      type: "string"
    }
  },
  required: ["chatId", "name"]
}

export const chatMessageSchema: JsonSchema = {
  $id: "ChatMessage",
  type: "object",
  properties: {
    messageId: {
      type: "string"
    },
    text: {
      type: "string"
    }
  },
  required: ["messageId", "text"]
}

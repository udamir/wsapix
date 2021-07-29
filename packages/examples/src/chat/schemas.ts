export const chatReadMessageSchema = {
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
  }
}

export interface ChatReadMessageType {
  type: "chat:read"
  chatId: string
}

export const chatTypingMessageSchema = {
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
  }
}

export interface ChatTypingMessageType {
  type: "chat:typing"
  chatId: string
  typing: boolean
}

export const userChatSchema = {
  $id: "Chat",
  type: "object",
  properties: {
    chatId: {
      type: "string"
    },
    name: {
      type: "string"
    }
  }
}

export const chatMessageSchema =  {
  $id: "ChatMessage",
  type: "object",
  properties: {
    messageId: {
      type: "string"
    },
    text: {
      type: "string"
    }
  }
}

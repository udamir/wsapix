import { WebSocket } from "uWebSockets.js"
import { WsapixChannel } from "wsapix"
import { Type, Static } from "@sinclair/typebox"

export interface IClientState {
  userId: string
  name: string
}

export const chat = new WsapixChannel<WebSocket, IClientState>({ path: "/chat" })

chat.use((client) => {
  // check auth
  if (!client.query) {
    client.send({ type: "error", message: "Wrong token!", code: 401 })
    return client.terminate(4003)
  }
  client.state = { userId: Date.now().toString(36), name: client.query }
})

/* Client messages */

// message from client
export const userMessageSchema = {
  $id: "user:message",
  description: "New user message",
  payload: Type.Strict(Type.Object({
    type: Type.String({ const: "user:message", description: "Message type" }),
    text: Type.String({ description: "Message text" })
  }, { $id: "user:message" }))
}

export type UserMessageSchema = Static<typeof userMessageSchema.payload>

chat.clientMessage<UserMessageSchema>({ type: "user:message"}, userMessageSchema, (client, data) => {
  chat.clients.forEach((c) => {
    if (c === client) { return } 
    c.send({
      type: "chat:message",
      userId: client.state.userId,
      text: data.text
    })
  })
})

/* Server messages */

// New chat message

export const chatMessageSchema = {
  $id: "chat:message",
  description: "New message in chat",
  payload: Type.Strict(Type.Object({
    type: Type.String({ const: "chat:message", description: "Message type" }),
    userId: Type.String({ description: "User Id" }),
    text: Type.String({ description: "Message text" })
  }, { $id: "chat:message" }))
}

chat.serverMessage({ type: "chat:message" }, chatMessageSchema)

// User connect message

export const userConnectedSchema = {
  $id: "user:connected",
  description: "User online status update",
  payload: Type.Strict(Type.Object({
    type: Type.String({ const: "user:connected", description: "Message type" }),
    userId: Type.String({ description: "User id" }),
    name: Type.String({ description: "User name" }),
  }, { $id: "user:connected" }))
}

chat.serverMessage({ type: "user:connected" }, userConnectedSchema)

chat.on("connect", (client) => {
  chat.clients.forEach((c) => {
    if (c === client) { return }
    c.send({ type: "user:connected", ...client.state })
    client.send({ type: "user:connected", ...c.state })
  })
})

// User disconnect message

export const userDisconnectedSchema = {
  $id: "user:disconnected",
  description: "User online status update",
  payload: Type.Strict(Type.Object({
    type: Type.String({ const: "user:disconnected", description: "Message type" }),
    userId: Type.String({ description: "User Id" }),
    name: Type.String({ description: "User name" }),
  }, { $id: "user:disconnected" }))
}

chat.serverMessage({ type: "user:disconnected" }, userDisconnectedSchema)

chat.on("disconnect", (client) => {
  chat.clients.forEach((c) => {
    if (c === client) { return } 
    c.send({ type: "user:disconnected", ...client.state })
  })
})

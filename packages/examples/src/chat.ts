import { WsapixChannel, WsapixClient } from "wsapix"
import { Type, Static } from "@sinclair/typebox"

export const channel = new WsapixChannel({ path: "/chat" })

/* Client messages */

// Client message

export const msUserMessage = Type.Strict(Type.Object({
  type: Type.String({ const: "user:message", description: "Message type" }),
  userId: Type.String({ description: "User Id" }),
  text: Type.String({ description: "Message text" })
}, { $id: "user:message" }))

export type UserMessageSchema = Static<typeof msUserMessage>

channel.clientMessage({ type: "user:message"}, {
  $id: "user:message",
  description: "New user message",
  payload: msUserMessage,
}, (client: WsapixClient, data: UserMessageSchema) => {
  // TODO
})

/* Server messages */

// New chat message

channel.serverMessage({ type: "message:add" }, {
  $id: "message:add",
  description: "New message in chat",
  payload: msUserMessage
})

// User connect message

export const msUserConnected = Type.Strict(Type.Object({
  type: Type.String({ const: "user:connected", description: "Message type" }),
  userId: Type.String({ description: "User id" }),
  name: Type.String({ description: "User name" }),
}, { $id: "user:connected" }))

channel.serverMessage({ type: "user:connected" }, {
  $id: "user:connected",
  description: "User online status update",
  payload: msUserConnected,
})

// User disconnect message

export const msUserDisconnected = Type.Strict(Type.Object({
  type: Type.String({ const: "user:disconnected", description: "Message type" }),
  userId: Type.String({ description: "User Id" }),
}, { $id: "user:disconnected" }))

channel.serverMessage({ type: "user:disconnected" }, {
  $id: "user:disconnected",
  description: "User online status update",
  payload: msUserDisconnected,
})




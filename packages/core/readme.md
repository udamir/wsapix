# Wsapix

Next generation Websocket framework for nodejs

## Summary
Wsapix provides to you:
- Channel/message based build websocket API approach
- Middlewares support
- Custom schema serialization support
- Message paylaod validation
- Fake websocket client injection support
- AsyncAPI specification generation
- Typescript syntax support out of the box

# Quick start

## Installation

```
npm install --save wsapix
```

## Create websocket server

```ts
import * as http from "http"
import Ajv from "ajv"
import { WSApiOptions, WSApi, WSChannel } from "wsapix"

// define client context state
interface IClientState {
  userId: string
}

const wssOptions: WebSocket.ServerOptions = { 
  server: new http.Server()
}

const ajv = new Ajv({ strict: false })
const notepack = requre("notepack.io")

const wsApiOptions: WSApiOptions = {
  validator: ajv.validate.bind(ajv), // validation engine
  serializer: notepack // custom serializer
}

const wsapi = new WSApi<IClientState>(wssParams, wsApiOptions)

// connection hook middleware
wsapi.use((ctx) => {
  // add authentication
  // ctx.state.userId = ...
})

// define channel route
const v1 = new WSChannel({ 
  path: "/v1" // channel route
  // serializer: { encode, decode } - channel serializer
  // validator: (schema, data, error) => boolean - channel validator
  // messages: [ ... ] - channel messages
})

// define message matcher - fields filter or filter function
const chatMessageMatcher = { type: "chat:message" } 
// const chatMessageMatcher = (data) => data.type === "chat:message"

// define message schema (for validation and documentation)
const chatMessageSchema = { 
  $id: "chat:message", // id for $ref
  description: "Message from user",
  payload: {
    // Json schema
    type: {
      type: "string",
      const: "chat:message"
    },
    chatId: {
      type: "string"
    },
    text: {
      type: "string"
    }
  },
}

// define channel client message
v1.clientMessage(chatMessageMatcher, chatMessageSchema, (ctx, data) => {
  // message handler
})

const errorSchema = {
  $id: "error", // id for $ref
  description: "Error message", 
  payload: {
    // Json schema
    type: {
      type: "string",
      const: "error"
    },
    message: {
      type: "string"
    }
  }
}

// define channel server message (for validation and documentation)
v1.serverMessage({ type: "error" }, errorSchema)

// add channel to server
wsapi.route(v1)

wsapi.onError((ctx, error) => {
  // handle errors, inc request validation errors
  ctx.channel = ctx.channel || wsapi.channels.get("v1")
  ctx.send({ type: "error", message: error })
})

// generate AsyncApi schema
const asyncApi = wsapi.asyncapi({
  info: {
    version: "1.0.0",
    title: "Chat websocket API"
  }
})
```

## Testing

Wsapix comes with built-in support for fake Websocket client injection:

```ts
const ws = await wsapi.inject({ url: "/v1?token=12345" })

// handle server messages
ws.onmessage = ({ data }) => {
  // decode message from server
  const message = notepack.decode(data)
  
  // handle server message
  if (message.type === "error") {
    // ...
  }
}

// encode and send message to injected client
ws.send(notepack.encode({ type: "chat:message", chatId, text: "Hello" }))

// close connection
ws.close()
```

# License
MIT
# Wsapix

Next generation Websocket framework for nodejs

## Summary
Wsapix provides to you:
- Schema based build websocket API approach
- Middlewares support
- Custom schema serialization support
- Message paylaoad validation
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

// add path (channel)
const v1 = new WSChannel()

// message from client
const chatMessageSchema = { 
    $id: "chat:message",
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

v1.clientMessage({ type: "chat:message" }, chatMessageSchema, (ctx, data) => {
  // message handler
})

const userUpdateSchema = {
  $id: "user:update",
  description: "User update",
  payload: {
    // Json schema
    type: {
      type: "string",
      const: "user:update"
    },
    userId: {
      type: "string"
    },
    update: {
      // ...
    }
  }
}

// message from server
v1.serverMessage({ type: "user:update" }, userUpdateSchema)

wsapi.path("/v1", v1.messages)

wsapi.onError((ctx, error) => {
  // handle errors, inc request validation errors
  ctx.channel = ctx.channel || "/"
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

ws.onmessage = ({ data }) => {
  // handle client messages
}

// send message to injected client
ws.send("hello")

// close connection
ws.close()
```

# License
MIT
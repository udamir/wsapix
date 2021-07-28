# Wsapix

Next generation Websocket framework for nodejs

## Summary
Wsapix provides to you:
- Schema based build websocket API approach
- Middlewares support
- Custom schema serialization support
- Message paylaoad validation
- AsyncAPI specification generation
- Typescript syntax support out of the box

# Quick start

## Installation

```
npm install --save wsapix
```

```ts
import * as http from "http"
import Ajv from "ajv"
import { WSApiOptions, WSApi, apiMessage, MessageKind } from "wsapix"

// define client context state
interface IClientState {
  userId: string
}

const wssOptions: WebSocket.ServerOptions = { 
  server: new http.Server()
}

const ajv = new Ajv({ strict: false })

const wsApiOptions: WSApiOptions = {
  validator: ajv.validate, // validation engine
  serializer: notepack // custom serializer
}

const wsapi = new WSApi<IClientState>(wssParams, wsApiOptions)

// connection hook middleware
wsapi.use((ctx, next) => {
  // add authentication
  // ctx.state.userId = ...
})

// add path (channel)
wsapi.path("/v1", [
  // message from client
  apiMessage({ 
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
  }, { 
    kind: MessageKind.client, 
    matchField: { type: "chat:message" }, 
    handler: (ctx, data) => {
      // message handler
    }
  })

  // message from server
  apiMessage({
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
  }, {
    kind: MessageKind.server, 
    matchField: { type: "user:update" }, 
  })
])

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
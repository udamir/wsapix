# Wsapix
<img alt="npm" src="https://img.shields.io/npm/v/wsapix"> <img alt="npm type definitions" src="https://img.shields.io/npm/types/wsapix"> <img alt="NPM" src="https://img.shields.io/npm/l/wsapix">

Next generation Websocket framework for nodejs

## Summary
Wsapix provides to you:
- Channel/message approach for websocket API 
- uWebsockets.js engine support 
- Middlewares and hooks support
- Custom schema parser/serializer support
- Message paylaod validation
- AsyncAPI specification generation
- Mock server with websocket client injection
- Typescript syntax support out of the box

# Quick start

## Installation

```
npm install --save wsapix
```

## Create websocket server over http(s) or uWebSockets

```ts
import * as http from "http"
import { Wsapix } from "wsapix"

const server = new http.Server()
const wsx = Wsapix.WS({ server })

// uWebSockets.js supported
// import uWebSockets from "uWebsockets.js"
//
// const server = uWebSockets.App()
// const wsx = Wsapix.uWS({ server })

interface IChatMessage {
  type: "chat:message"
  text: string
}

// handle messages from client with payload { type: "chat:message", ... }
wsx.clientMessage({ type: "chat:message" }, (client: Client, data: IChatMessage) => {
  // data - deserialized by JSON.Parse
  
  // JSON.stringify user for send payload 
  client.send({ type: "echo", text: data.text })
})

server.listen(port, () => {
  console.log(`Server listen port ${port}`)
})

```

## Add auth middleware
```ts

// define client context state
interface IClientState {
  userId: string
}

const wsx = Wsapix.WS<IClientState>({ server })

// connection hook middleware
wsx.use((client: WsapixClient) => {
  // check auth
  const user = authUser(client.query)

  // store user id in state 
  client.state.userId = data.userId
})
```

## Add custom parser/serializer
Default message payload parser/serializer is JSON parse/stringify. 
Wsapix support custom parser/serializer:

```ts
const notepack = require("notepack.io")

const wsx = Wsapix.WS({ server }, { 
  serializer: notepack.encode, 
  parser: notepack.decode
})
```
Parser/Serializer can be removed in any channel:
```ts
wsx.route("/raw", { parser: null, serializer: null })

```

## Add payload validation

```ts
import * as http from "http"
import Ajv from "ajv"
import { Wsapix } from "wsapix"

const ajv = new Ajv({ strict: false })

const wsx = Wsapix.WS({ server }, { 
  validator: (schema, data, error) => {
    const valid = ajv.validate(schema)
    if (!valid && ajv.errors) { 
      error && error(ajv.errors.map(({ message }) => message).join(", ")) 
    }
    return valid
  }
})

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
    text: {
      type: "string"
    }
  },
}

interface IChatMessage {
  type: "chat:message"
  text: string
}

wsx.clientMessage({ type: "chat:message" }, chatMessageSchema, (client: Client, data: IChatMessage) => {
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
wsx.serverMessage({ type: "error" }, errorSchema)

wsx.onError((client, error) => {
  // handle errors, incuding request validation errors
  client.send({ type: "error", message: error })
})
```

## Add channels
```ts
const v1 = wsx.route("/v1")

v1.use(/* ... */)
v1.clientMessage(/* ... */)
v1.serverMessage(/* ... */)
```

## Add plugin
```ts

const plugin = (wsx: Wsapix) => {
  const v2 = wsx.route("/v2")

  v2.clientMessage(/* ... */)
  v2.serverMessage(/* ... */)  
}

wsx.register(plugin)

```

## Generate AsyncApi schema

```ts
const asyncApi = wsx.asyncapi({
  info: {
    version: "1.0.0",
    title: "Chat websocket API"
  }
})
```

## Generate html documentation

```ts
const html = wsx.htmlDocTemplate("/asyncapi", "Chat websocket API")
```

## Testing

Wsapix comes with built-in Mock Transport and Fake WebSocket client injection:

```ts
const mws = new MockTransport()

// replace existing wsapix transport
wsx.setTransport(mws)

// or create wsapix server with mock transport
// const wsx = new Wsapix(mws)

const ws1 = mws.inject("/v1?token=12345")

// handle server messages
ws1.onmessage = ({ data }) => {
  // decode message from server
  const message = notepack.decode(data)
  
  // handle server message
  if (message.type === "error") {
    // ...
  }
}

// encode and send message to injected client
ws1.send(notepack.encode({ type: "chat:message", chatId, text: "Hello" }))

// close connection
ws1.close()
```

# License
MIT

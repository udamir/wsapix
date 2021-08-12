# Wsapix
<img alt="npm" src="https://img.shields.io/npm/v/wsapix"> <img alt="npm type definitions" src="https://img.shields.io/npm/types/wsapix"> <img alt="NPM" src="https://img.shields.io/npm/l/wsapix">

Next generation Websocket framework for nodejs

## Summary
Wsapix provides to you:
- Channel/message approach for websocket API 
- uWebsockets.js engine support 
- Middlewares support
- Custom schema serialization support
- Message paylaod validation
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

// handle messages { type: "chat:message", ... }
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
wsx.use((client: Client) => {
  // check auth
  const user = authUser(client.req?.url)

  // store user id in state 
  client.state.userId = data.userId
})
```

## Add custom serialization
Default message payload serialization is JSON stringnify/parse. Wsapix support custom serialization:

```ts
const notepack = require("notepack.io")

const wsx = Wsapix.WS({ server }, { serializer: notepack })
```

## Add payload validation

```ts
import * as http from "http"
import Ajv from "ajv"
import { Wsapix } from "wsapix"


const ajv = new Ajv({ strict: false })

const wsx = Wsapix.WS({ server }, { validator: ajv.validate.bind(ajv) })

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
# License
MIT

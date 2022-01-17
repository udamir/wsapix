# Wsapix 0.5.0

1. Transport moved to separate package [rttl](https://github.com/udamir/rttl)
2. PeerDependencies updated to next magor version
  - "github:uNetworking/uWebSockets.js#v20.6.0",
  - "ws": "^8.4.2"
3. Transport socket type parameter added to Wsapix, WsapixChannel, WsapixClient
```ts
const wsx = new Wsapix<WebSocket, IClientState>({ server })
```
4. MockClient injection added to wsapix
```ts
const ws = wsx.inject(url, params)
```

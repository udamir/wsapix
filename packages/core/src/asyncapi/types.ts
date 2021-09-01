export interface AsyncApiSchema {
  asyncapi: "2.0.0" | "2.1.0"
  id?: string
  info: Info
  servers?: { [name: string]: Server }
  defaultContentType?: string
  channels: { [name: string]: Channel | Ref }
  components?: Components
  tags?: Array<Tag>
  externalDocs?: ExternalDocs
}

export interface Info {
  title: string
  version: string
  description?: string
  termsOfService?: string
  contact?: InfoContact
  license?: InfoLicense
}

export interface InfoContact {
  name?: string
  url?: string
  email?: string
}

export interface InfoLicense {
  name: string
  url?: string
}

export interface Server {
  url: string
  description?: string
  protocol: string
  protocolVersion?: string
  variables?: { [name: string]: ServerVariable }
  security?: Array<{ [name: string]: string[] }>
  bindings?: { [name in ProtocolEnum]: any }
}

export interface ServerVariable {
  enum?: Array<string>
  default?: string
  description?: string
  examples?: Array<string>
}

export enum ProtocolEnum { http, ws, amqp, amqp1, mqtt, mqtt5, kafka, nats, jms, sns, sqs, stomp, redis, mercure }

export interface Channel {
  parameters?: Map<string, Parameter | Ref>
  description?: string
  publish?: ChannelPubSub
  subscribe?: ChannelPubSub
  deprecated?: boolean
  bindings?: { [name in ProtocolEnum]: any }
}

export interface Parameter {
  description?: string
  schema?: JsonSchema
  location?: string
}
export interface ChannelPubSub {
  traits?: Array<OperationTrait | Ref>
  summary?: string
  description?: string
  tags?: Array<Tag>
  externalDocs?: ExternalDocs
  operationId?: string
  bindings?: { [key in ProtocolEnum]: any }
  message?: Message | Ref | OneOfMessages
}

export interface OperationTrait {
  ref: string
  summary?: string
  description?: string
  tags?: Array<Tag>
  externalDocs?: ExternalDocs
  operationId?: string
  bindings?: { [key in ProtocolEnum]: any }
}

export interface Tag {
  name: string
  description?: string
  externalDocs?: ExternalDocs
}

export interface ExternalDocs {
  description?: string
  url: string
}

export interface Ref {
  $ref: string
}

export interface OneOfMessages {
  oneOf: Array<Message | Ref>
}

export interface Message {
  schemaFormat?: string
  contentType?: string
  headers?: JsonSchema | Ref | object
  payload?: JsonSchema | Ref | any
  correlationId?: CorrelationId | Ref
  tags?: Array<Tag>
  summary?: string
  name?: string
  title?: string
  description?: string
  externalDocs?: ExternalDocs
  deprecated?: boolean
  examples?: Array<Example>
  bindings?: { [key in ProtocolEnum]: any }
  traits?: Array<MessageTrait | Ref>
}

export interface MessageTrait {
  schemaFormat?: string
  contentType?: string
  headers?: JsonSchema | Ref | object
  correlationId?: CorrelationId | Ref
  tags?: Array<Tag>
  summary?: string
  name?: string
  title?: string
  description?: string
  externalDocs?: ExternalDocs
  deprecated?: boolean
  examples?: Array<Example>
  bindings?: { [key in ProtocolEnum]: any }
}

export interface Example {
  [name: string]: object | string | number | Array<unknown> | boolean | null | number
}

export interface CorrelationId {
  description?: string
  location: string
}

export interface Components {
  schemas?: { [key: string]: JsonSchema }
  messages?: { [key: string]: Message }
  securitySchemes?: { [key: string]: SecuritySchema }
  parameters?: { [key: string]: Parameter }
  correlationIds?: { [key: string]: CorrelationId }
  operationTraits?: { [key: string]: OperationTrait }
  messageTraits?: { [key: string]: MessageTrait }
  serverBindings?: any
  channelBindings?: any
  operationBindings?: any
  messageBindings?: any
}

export interface SecuritySchema {
  type: UserPasswordType
  description?: string
  in: ApiKeyIn
  scheme: BearerHttpSecurityScheme
  bearerFormat?: string
  name: string
  flows: { [key in Oauth2FlowType]: Oauth2Flow }
  openIdConnectUrl: string
}

export enum UserPasswordType {
  USER_PASSWORD = "userPassword",
  API_KEY = "apiKey",
  X509 = "X509",
  SYMMETRIC_ENCRYPTION = "symmetricEncryption",
  ASYMMETRIC_ENCRYPTION = "asymmetricEncryption",
  HTTP = "http",
  HTTP_API_KEY = "httpApiKey",
  OAUTH2 = "oauth2",
  OPEN_ID_CONNECT = "openIdConnect",
}

export enum ApiKeyIn {
  USER = "user",
  PASSWORD = "password",
  HEADER = "header",
  QUERY = "query",
  COOKIE = "cookie",
}

export enum BearerHttpSecurityScheme {
  BEARER = "bearer",
}

export enum Oauth2FlowType {
  implicit,
  password,
  clientCredentials,
  authorizationCode
}

export interface Oauth2Flow {
  authorizationUrl: string
  tokenUrl?: string
  refreshUrl?: string
  scopes: { [name: string]: string }
}

export interface ExternalDocs {
  description?: string
  url: string
}

export type JsonSchema = JsonSchemaBase | JsonSchemaNumber | JsonSchemaString
  | JsonSchemaGeneric | JsonSchemaObject | JsonSchemaArray | JsonSchemaObject | JsonSchemaMix

type JsonSchemaMix = JsonSchemaBase & JsonSchemaNumber & JsonSchemaString
  & JsonSchemaGeneric & JsonSchemaObject & JsonSchemaArray & JsonSchemaObject & {
  type: ("string" | "number" | "object" | "array" | "boolean" | "null")[]
}

interface JsonSchemaBase {
  $ref?: string
  id?: string
  title?: string
  description?: string
  'default'?: any
  'enum'?: any[]
  type?: "string" | "number" | "object" | "array" | "boolean" | "null"
  [ key: string ]: any
}

interface JsonSchemaNumber extends JsonSchemaBase {
  type: "number"
  multipleOf?: number
  maximum?: number
  exclusiveMaximum?: boolean
  minimum?: number
  exclusiveMinimum?: boolean
}

interface JsonSchemaString extends JsonSchemaBase {
  type: "string"
  maxLength?: number
  minLength?: number
  pattern?: string
}

interface JsonSchemaArray extends JsonSchemaBase {
  type: "array"
  additionalItems?: boolean | JsonSchema
  items?: JsonSchema | JsonSchema[]
  maxItems?: number
  minItems?: number
  uniqueItems?: boolean
}

interface JsonSchemaObject extends JsonSchemaBase {
  type: "object"
  maxProperties?: number
  minProperties?: number
  required?: string[]
  additionalProperties?: boolean | JsonSchema
  definitions?: {[key: string]: JsonSchema}
  properties?: {[property: string]: JsonSchema}
  patternProperties?: {[pattern: string]: JsonSchema}
  dependencies?: {[key: string]: JsonSchema | string[]}
}

interface JsonSchemaGeneric extends JsonSchemaBase {
  allOf?: JsonSchema[]
  anyOf?: JsonSchema[]
  oneOf?: JsonSchema[]
  not?: JsonSchema
}

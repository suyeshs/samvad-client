// Simplified Cloudflare Workers types for voice-only Multilingual Finance Advisor app
// Focuses on WebSockets, Durable Objects, Fetch/Request/Response, Streams, Env bindings, and essential utilities

// Basic utilities
type BufferSource = ArrayBufferView | ArrayBuffer;

// Event handling
interface EventInit {
  bubbles?: boolean;
  cancelable?: boolean;
  composed?: boolean;
}

declare class Event {
  constructor(type: string, init?: EventInit);
  readonly type: string;
  readonly bubbles: boolean;
  readonly cancelable: boolean;
  readonly composed: boolean;
  preventDefault(): void;
  stopPropagation(): void;
  stopImmediatePropagation(): void;
}

type EventListener = (event: Event) => void;

declare class EventTarget {
  addEventListener(type: string, listener: EventListener, options?: boolean | { capture?: boolean; once?: boolean; passive?: boolean }): void;
  removeEventListener(type: string, listener: EventListener, options?: boolean | { capture?: boolean }): void;
  dispatchEvent(event: Event): boolean;
}

// Streams API (simplified for audio chunks)
interface ReadableStream<R = any> {
  readonly locked: boolean;
  cancel(reason?: any): Promise<void>;
  getReader(): ReadableStreamDefaultReader<R>;
  pipeTo(destination: WritableStream<R>, options?: { preventClose?: boolean; preventAbort?: boolean; preventCancel?: boolean }): Promise<void>;
}

declare class ReadableStream<R = any> {
  constructor(underlyingSource?: { start?: (controller: ReadableStreamDefaultController<R>) => void; pull?: (controller: ReadableStreamDefaultController<R>) => void | Promise<void>; cancel?: (reason: any) => void | Promise<void> });
}

interface ReadableStreamDefaultReader<R = any> {
  readonly closed: Promise<void>;
  cancel(reason?: any): Promise<void>;
  read(): Promise<{ done: boolean; value: R }>;
  releaseLock(): void;
}

interface WritableStream<W = any> {
  readonly locked: boolean;
  abort(reason?: any): Promise<void>;
  close(): Promise<void>;
  getWriter(): WritableStreamDefaultWriter<W>;
}

declare class WritableStream<W = any> {
  constructor(underlyingSink?: { start?: (controller: WritableStreamDefaultController) => void | Promise<void>; write?: (chunk: W, controller: WritableStreamDefaultController) => void | Promise<void>; close?: () => void | Promise<void>; abort?: (reason: any) => void | Promise<void> });
}

interface WritableStreamDefaultWriter<W = any> {
  readonly closed: Promise<void>;
  readonly ready: Promise<void>;
  abort(reason?: any): Promise<void>;
  close(): Promise<void>;
  write(chunk?: W): Promise<void>;
  releaseLock(): void;
}

// WebSocket types
interface WebSocketEventMap {
  close: CloseEvent;
  message: MessageEvent;
  open: Event;
  error: ErrorEvent;
}

declare class WebSocket extends EventTarget<WebSocketEventMap> {
  accept(): void;
  send(message: ArrayBuffer | ArrayBufferView | string): void;
  close(code?: number, reason?: string): void;
  readonly readyState: number;
  readonly url: string | null;
  readonly protocol: string | null;
  readonly extensions: string | null;
}

declare const WebSocketPair: new () => { 0: WebSocket; 1: WebSocket };

// Fetch/Request/Response (simplified)
interface Headers {
  constructor(init?: [string, string][] | Record<string, string>);
  get(name: string): string | null;
  set(name: string, value: string): void;
  append(name: string, value: string): void;
  delete(name: string): void;
  has(name: string): boolean;
  entries(): IterableIterator<[string, string]>;
}

interface Body {
  readonly body: ReadableStream<Uint8Array> | null;
  readonly bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T>(): Promise<T>;
  blob(): Promise<Blob>;
}

interface Response extends Body {
  clone(): Response;
  status: number;
  statusText: string;
  headers: Headers;
  ok: boolean;
  redirected: boolean;
  url: string;
  webSocket: WebSocket | null;
  cf?: any;
}

interface Request extends Body {
  clone(): Request;
  method: string;
  url: string;
  headers: Headers;
  redirect: string;
  signal: AbortSignal;
  cf?: any;
}

declare function fetch(input: Request | string, init?: RequestInit): Promise<Response>;

interface RequestInit {
  method?: string;
  headers?: Headers | Record<string, string> | [string, string][];
  body?: ReadableStream | string | ArrayBuffer | ArrayBufferView | Blob | null;
  redirect?: string;
  cf?: any;
  signal?: AbortSignal | null;
}

// ExecutionContext
interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

// Durable Objects
interface DurableObjectState {
  waitUntil(promise: Promise<any>): void;
  readonly id: DurableObjectId;
  readonly storage: DurableObjectStorage;
  acceptWebSocket(ws: WebSocket, tags?: string[]): void;
  getWebSockets(tag?: string): WebSocket[];
  abort(reason?: string): void;
}

interface DurableObjectStorage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  transaction<T>(closure: (txn: DurableObjectTransaction) => Promise<T>): Promise<T>;
}

interface DurableObjectTransaction {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  rollback(): void;
}

interface DurableObjectId {
  toString(): string;
  equals(other: DurableObjectId): boolean;
  readonly name?: string;
}

interface DurableObjectNamespace {
  newUniqueId(): DurableObjectId;
  idFromName(name: string): DurableObjectId;
  idFromString(id: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

interface DurableObjectStub extends Fetcher {
  readonly id: DurableObjectId;
  readonly name?: string;
}

// Fetcher for DO stubs
interface Fetcher {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}

// Env interface with relevant bindings
interface Env {
  // D1 Database
  FINANCE_DB: D1Database;
  
  // Vectorize Index
  FINANCE_RAG_INDEX: VectorizeIndex;
  
  // Workers AI
  AI: any;
  
  // Static Assets
  ASSETS: Fetcher;
  
  // Environment Variables
  SARVAM_API_KEY: string;
}

// Simplified D1 for database
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run<T>(): Promise<D1Result<T>>;
  all<T>(): Promise<D1Result<T>>;
}

type D1Result<T> = { results: T[]; meta: any };

// Simplified Vectorize for RAG
interface VectorizeIndex {
  describe(): Promise<VectorizeIndexInfo>;
  query(vector: number[], options?: VectorizeQueryOptions): Promise<VectorizeMatches>;
  insert(vectors: VectorizeVector[]): Promise<VectorizeAsyncMutation>;
  upsert(vectors: VectorizeVector[]): Promise<VectorizeAsyncMutation>;
  deleteByIds(ids: string[]): Promise<VectorizeAsyncMutation>;
  getByIds(ids: string[]): Promise<VectorizeVector[]>;
}

interface VectorizeIndexInfo {
  vectorCount: number;
  dimensions: number;
  processedUpToDatetime: number;
  processedUpToMutation: number;
}

interface VectorizeQueryOptions {
  topK?: number;
  namespace?: string;
  returnValues?: boolean;
  returnMetadata?: boolean | "all" | "indexed" | "none";
  filter?: any;
}

interface VectorizeVector {
  id: string;
  values: number[];
  namespace?: string;
  metadata?: Record<string, any>;
}

interface VectorizeMatches {
  matches: VectorizeMatch[];
  count: number;
}

interface VectorizeMatch extends VectorizeVector {
  score: number;
}

interface VectorizeAsyncMutation {
  mutationId: string;
}

// Simplified AI binding
interface Ai {
  run(model: string, inputs: any, options?: any): Promise<any>;
}

// Workflow/Entrypoint simplified (if needed, but seems not core yet)
declare abstract class WorkerEntrypoint {
  fetch?(request: Request): Promise<Response>;
}

// Add a module declaration for 'cloudflare:ai' for type compatibility
// This allows importing Ai from 'cloudflare:ai' in Worker code

declare module 'cloudflare:ai' {
  export type Ai = {
    run(model: string, inputs: any, options?: any): Promise<any>;
  };
}
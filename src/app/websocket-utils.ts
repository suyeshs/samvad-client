export interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
}

export interface WebSocketConfig {
  url: string;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  maxMessageQueueSize?: number;
  enableHeartbeat?: boolean;
  throttleInterval?: number;
}

export interface WebSocketCallbacks {
  onOpen?: () => void;
  onClose?: (code: number, reason: string) => void;
  onError?: (error: Event) => void;
  onMessage?: (data: WebSocketMessage) => void;
  onReconnect?: (attempt: number) => void;
  onReconnectFailed?: () => void;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private callbacks: WebSocketCallbacks;
  private reconnectAttempts = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private throttleTimer: NodeJS.Timeout | null = null;
  private isIntentionalClose = false;
  private messageQueue: WebSocketMessage[] = [];
  private isDestroyed = false;
  private lastMessageTime = 0;
  private pendingMessages: WebSocketMessage[] = [];

  constructor(config: WebSocketConfig, callbacks: WebSocketCallbacks = {}) {
    this.config = {
      maxReconnectAttempts: 5,
      reconnectDelay: 1000,
      heartbeatInterval: 30000,
      heartbeatTimeout: 5000,
      maxMessageQueueSize: 100,
      enableHeartbeat: true,
      throttleInterval: 100,
      ...config,
    };
    this.callbacks = callbacks;
  }

  connect(): void {
    if (this.isDestroyed) {
      console.warn('[WebSocket] Manager is destroyed, cannot connect');
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Already connected');
      return;
    }

    try {
      console.log('[WebSocket] Connecting to:', this.config.url);
      this.ws = new WebSocket(this.config.url);
      this.setupEventHandlers();
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      this.handleReconnect();
    }
  }

  disconnect(): void {
    console.log('[WebSocket] Intentional disconnect');
    this.isIntentionalClose = true;
    this.cleanup();
    this.ws?.close(1000, 'Intentional disconnect');
  }

  destroy(): void {
    console.log('[WebSocket] Destroying manager');
    this.isDestroyed = true;
    this.cleanup();
    this.ws?.close(1000, 'Manager destroyed');
    this.ws = null;
    this.messageQueue.length = 0;
    this.pendingMessages.length = 0;
  }

  send(message: WebSocketMessage): boolean {
    if (this.isDestroyed) {
      console.warn('[WebSocket] Manager is destroyed, cannot send');
      return false;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      return this.sendImmediate(message);
    } else {
      return this.queueMessage(message);
    }
  }

  sendBatch(messages: WebSocketMessage[]): number {
    if (this.isDestroyed) return 0;

    let sentCount = 0;
    for (const message of messages) {
      if (this.send(message)) {
        sentCount++;
      }
    }
    return sentCount;
  }

  getState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getQueueSize(): number {
    return this.messageQueue.length;
  }

  clearQueue(): void {
    this.messageQueue.length = 0;
    console.log('[WebSocket] Message queue cleared');
  }

  private sendImmediate(message: WebSocketMessage): boolean {
    try {
      this.ws!.send(JSON.stringify(message));
      this.lastMessageTime = Date.now();
      return true;
    } catch (error) {
      console.error('[WebSocket] Send error:', error);
      return false;
    }
  }

  private queueMessage(message: WebSocketMessage): boolean {
    // Prevent memory leaks by limiting queue size
    if (this.messageQueue.length >= this.config.maxMessageQueueSize) {
      console.warn('[WebSocket] Message queue full, dropping oldest message');
      this.messageQueue.shift(); // Remove oldest message
    }
    
    this.messageQueue.push(message);
    console.log('[WebSocket] Message queued, queue size:', this.messageQueue.length);
    return false;
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('[WebSocket] Connected');
      this.reconnectAttempts = 0;
      this.isIntentionalClose = false;
      this.lastMessageTime = Date.now();
      
      if (this.config.enableHeartbeat) {
        this.startHeartbeat();
      }
      
      this.flushMessageQueue();
      this.callbacks.onOpen?.();
    };

    this.ws.onclose = (event) => {
      console.log('[WebSocket] Closed:', event.code, event.reason);
      this.cleanup();
      
      if (!this.isIntentionalClose && !this.isDestroyed && this.reconnectAttempts < this.config.maxReconnectAttempts) {
        this.handleReconnect();
      } else if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
        console.error('[WebSocket] Max reconnection attempts reached');
        this.callbacks.onReconnectFailed?.();
      }
      
      this.callbacks.onClose?.(event.code, event.reason);
    };

    this.ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      this.callbacks.onError?.(error);
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WebSocketMessage;
        this.callbacks.onMessage?.(data);
      } catch (error) {
        console.error('[WebSocket] Message parsing error:', error);
      }
    };
  }

  private handleReconnect(): void {
    if (this.reconnectTimer || this.isDestroyed) return;

    this.reconnectAttempts++;
    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 second delay
    );
    
    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);
    
    this.callbacks.onReconnect?.(this.reconnectAttempts);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isDestroyed) {
        this.connect();
      }
    }, delay);
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer || !this.config.enableHeartbeat) return;

    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN && !this.isDestroyed) {
        this.send({ type: 'ping' });
        
        // Set a timeout to detect if heartbeat response is not received
        setTimeout(() => {
          if (this.ws?.readyState === WebSocket.OPEN && !this.isDestroyed) {
            console.warn('[WebSocket] Heartbeat timeout, reconnecting');
            this.ws.close(1000, 'Heartbeat timeout');
          }
        }, this.config.heartbeatTimeout);
      }
    }, this.config.heartbeatInterval);
  }

  private cleanup(): void {
    // Clear all timers to prevent memory leaks
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }
  }

  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) return;

    console.log(`[WebSocket] Flushing ${this.messageQueue.length} queued messages`);
    
    // Process messages in batches to avoid blocking
    const batchSize = 10;
    let processed = 0;
    
    const processBatch = () => {
      const batch = this.messageQueue.splice(0, batchSize);
      for (const message of batch) {
        if (this.sendImmediate(message)) {
          processed++;
        }
      }
      
      if (this.messageQueue.length > 0 && !this.isDestroyed) {
        // Use requestAnimationFrame for smooth processing
        requestAnimationFrame(processBatch);
      } else {
        console.log(`[WebSocket] Flushed ${processed} messages`);
      }
    };
    
    processBatch();
  }
}

// Helper function to create a WebSocket manager with default configuration
export function createWebSocketManager(
  url: string,
  callbacks: WebSocketCallbacks = {}
): WebSocketManager {
  return new WebSocketManager({ url }, callbacks);
}

// Memory-efficient message throttling utility
export class MessageThrottler {
  private lastSendTime = 0;
  private pendingMessages: WebSocketMessage[] = [];
  private throttleTimer: NodeJS.Timeout | null = null;
  private readonly throttleInterval: number;

  constructor(throttleInterval: number = 100) {
    this.throttleInterval = throttleInterval;
  }

  send(message: WebSocketMessage, sendFn: (msg: WebSocketMessage) => boolean): boolean {
    const now = Date.now();
    
    if (now - this.lastSendTime >= this.throttleInterval) {
      this.lastSendTime = now;
      return sendFn(message);
    } else {
      this.pendingMessages.push(message);
      
      if (!this.throttleTimer) {
        this.throttleTimer = setTimeout(() => {
          this.flushPending(sendFn);
        }, this.throttleInterval - (now - this.lastSendTime));
      }
      
      return false;
    }
  }

  private flushPending(sendFn: (msg: WebSocketMessage) => boolean): void {
    this.throttleTimer = null;
    const messages = [...this.pendingMessages];
    this.pendingMessages.length = 0;
    
    for (const message of messages) {
      sendFn(message);
    }
  }

  destroy(): void {
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }
    this.pendingMessages.length = 0;
  }
} 
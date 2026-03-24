/**
 * ─── Realtime Client — Multi-User Base ──────────────────────────────
 * WebSocket client for collaborative editing / live control.
 * Auto-reconnect with exponential backoff. Emits via EventBus.
 */

import { eventBus } from '@/core/system/eventBus';

export type RealtimeMessage = {
  type: string;
  payload: Record<string, unknown>;
  senderId?: string;
  timestamp?: number;
};

class RealtimeClient {
  private ws: WebSocket | null = null;
  private url = '';
  private _connected = false;
  private retryCount = 0;
  private maxRetries = 10;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private clientId = crypto.randomUUID().slice(0, 8);
  private listeners = new Set<(msg: RealtimeMessage) => void>();

  /** Connect to a WebSocket collaboration server */
  connect(url: string): void {
    this.url = url;
    this.retryCount = 0;
    this.doConnect();
  }

  disconnect(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.retryCount = this.maxRetries; // prevent reconnect
    this.ws?.close();
    this.ws = null;
    this._connected = false;
    eventBus.emit('CLUSTER.REALTIME_DISCONNECTED', { clientId: this.clientId });
  }

  /** Send a typed message to all peers */
  send(type: string, payload: Record<string, unknown> = {}): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const msg: RealtimeMessage = {
      type,
      payload,
      senderId: this.clientId,
      timestamp: Date.now(),
    };
    this.ws.send(JSON.stringify(msg));
  }

  /** Subscribe to incoming messages */
  onMessage(cb: (msg: RealtimeMessage) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  isConnected(): boolean { return this._connected; }
  getClientId(): string { return this.clientId; }

  private doConnect(): void {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this._connected = true;
        this.retryCount = 0;
        console.log('[Realtime] Connected as', this.clientId);
        eventBus.emit('CLUSTER.REALTIME_CONNECTED', { clientId: this.clientId });
      };

      this.ws.onmessage = (e) => {
        try {
          const msg: RealtimeMessage = JSON.parse(e.data);
          // Skip own messages
          if (msg.senderId === this.clientId) return;
          for (const cb of this.listeners) {
            try { cb(msg); } catch { /* no-op */ }
          }
          eventBus.emit('CLUSTER.REALTIME_MESSAGE', { type: msg.type });
        } catch { /* malformed message */ }
      };

      this.ws.onclose = () => {
        this._connected = false;
        if (this.retryCount < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30_000);
          this.retryCount++;
          console.warn(`[Realtime] Disconnected — retry ${this.retryCount} in ${delay}ms`);
          this.retryTimer = setTimeout(() => this.doConnect(), delay);
        }
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch (e) {
      console.error('[Realtime] Connection failed:', e);
    }
  }
}

export const realtimeClient = new RealtimeClient();

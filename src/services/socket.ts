export type SocketStatus = 'CONNECTED' | 'CONNECTING' | 'RECONNECTING' | 'DISCONNECTED';

type EventCallback = (payload: any) => void;

class LiveQuizSocket {
  private ws: WebSocket | null = null;
  private currentEventId: string | null = null;
  private currentParticipantId: string | null = null;
  private currentRole: string = 'VIEWER';
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private statusListeners: Set<(status: SocketStatus) => void> = new Set();
  private status: SocketStatus = 'DISCONNECTED';

  private reconnectAttempts = 0;
  private maxReconnectAttempts = 20;
  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private isExplicitlyClosed = false;

  private getWsUrl(): string {
    const envWs = (import.meta.env.VITE_WS_URL || '').trim();

    if (typeof window !== 'undefined') {
      const isCurrentHostLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      // If we are on a remote server/iframe and envWs has localhost, use the browser's current origin
      if (!isCurrentHostLocal && (envWs.includes('localhost') || envWs.includes('127.0.0.1'))) {
        const isHttps = window.location.protocol === 'https:';
        const proto = isHttps ? 'wss:' : 'ws:';
        return `${proto}//${window.location.host}/ws`;
      }

      if (envWs.length > 0) {
        return envWs.replace(/\/$/, '') + '/ws';
      }

      const isHttps = window.location.protocol === 'https:';
      const proto = isHttps ? 'wss:' : 'ws:';
      return `${proto}//${window.location.host}/ws`;
    }

    if (envWs.length > 0) {
      return envWs.replace(/\/$/, '') + '/ws';
    }

    return 'ws://localhost:3000/ws';
  }

  public connect(eventId?: string, participantId?: string, role: string = 'VIEWER') {
    if (eventId) this.currentEventId = eventId;
    if (participantId) this.currentParticipantId = participantId;
    this.currentRole = role;
    this.isExplicitlyClosed = false;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (this.currentEventId) {
        this.sendSubscribe();
      }
      return;
    }

    this.setStatus(this.reconnectAttempts > 0 ? 'RECONNECTING' : 'CONNECTING');

    const url = this.getWsUrl();
    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.setStatus('CONNECTED');
        this.reconnectAttempts = 0;
        this.startHeartbeat();

        if (this.currentEventId) {
          this.sendSubscribe();
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type) {
            this.emit(data.type, data.payload || data);
          }
        } catch (err) {
          console.error('[Socket] Failed to parse message', err);
        }
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        } else {
          this.setStatus('DISCONNECTED');
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[Socket] Connection issue', err);
        this.ws?.close();
      };
    } catch (err) {
      console.error('[Socket] Failed to create WebSocket', err);
      this.scheduleReconnect();
    }
  }

  private sendSubscribe() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.currentEventId) {
      this.ws.send(
        JSON.stringify({
          type: 'SUBSCRIBE',
          eventId: this.currentEventId,
          participantId: this.currentParticipantId,
          role: this.currentRole,
        })
      );
    }
  }

  private scheduleReconnect() {
    this.setStatus('RECONNECTING');
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus('DISCONNECTED');
      return;
    }

    // Exponential backoff with jitter
    const delay = Math.min(10000, 1000 * Math.pow(1.5, this.reconnectAttempts)) + Math.random() * 500;
    this.reconnectAttempts++;

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) clearInterval(this.pingInterval);
  }

  public disconnect() {
    this.isExplicitlyClosed = true;
    clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('DISCONNECTED');
  }

  private setStatus(s: SocketStatus) {
    this.status = s;
    this.statusListeners.forEach((cb) => cb(s));
  }

  public getStatus(): SocketStatus {
    return this.status;
  }

  public onStatusChange(callback: (status: SocketStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  public on(eventType: string, callback: EventCallback): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);
    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  private emit(eventType: string, payload: any) {
    const cbs = this.listeners.get(eventType);
    if (cbs) {
      cbs.forEach((cb) => cb(payload));
    }
  }
}

export const socket = new LiveQuizSocket();

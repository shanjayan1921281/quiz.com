import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { WsMessageIn, WsMessageOut } from './events';

export interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  eventId?: string;
  participantId?: string;
  role?: string;
}

export class LiveQuizWsServer {
  private wss: WebSocketServer;
  private rooms: Map<string, Set<ExtendedWebSocket>> = new Map(); // key = "event:<eventId>"

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.init();
  }

  private init() {
    this.wss.on('connection', (ws: ExtendedWebSocket) => {
      ws.isAlive = true;

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as WsMessageIn;
          this.handleMessage(ws, msg);
        } catch (err) {
          console.error('[WS] Failed to parse message', err);
        }
      });

      ws.on('close', () => {
        this.leaveRoom(ws);
      });

      ws.on('error', (err) => {
        console.error('[WS] Client socket error', err);
        this.leaveRoom(ws);
      });
    });

    // Heartbeat every 30 seconds to clean up dead/stale connections
    const interval = setInterval(() => {
      this.wss.clients.forEach((client) => {
        const extWs = client as ExtendedWebSocket;
        if (!extWs.isAlive) {
          this.leaveRoom(extWs);
          return extWs.terminate();
        }
        extWs.isAlive = false;
        extWs.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(interval);
    });

    console.log('[WS] LiveQuiz WebSocket Server initialized on /ws');
  }

  private handleMessage(ws: ExtendedWebSocket, msg: WsMessageIn) {
    if (msg.type === 'PING') {
      this.send(ws, {
        type: 'PONG',
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (msg.type === 'SUBSCRIBE' && msg.eventId) {
      this.leaveRoom(ws); // leave previous room if any
      ws.eventId = msg.eventId;
      ws.participantId = msg.participantId;
      ws.role = msg.role || 'VIEWER';

      const roomKey = `event:${msg.eventId}`;
      if (!this.rooms.has(roomKey)) {
        this.rooms.set(roomKey, new Set());
      }
      this.rooms.get(roomKey)!.add(ws);

      this.send(ws, {
        type: 'SUBSCRIBED',
        eventId: msg.eventId,
        payload: {
          room: roomKey,
          role: ws.role,
          participantId: ws.participantId,
          activeInRoom: this.rooms.get(roomKey)!.size
        },
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (msg.type === 'UNSUBSCRIBE') {
      this.leaveRoom(ws);
    }
  }

  private leaveRoom(ws: ExtendedWebSocket) {
    if (ws.eventId) {
      const roomKey = `event:${ws.eventId}`;
      const set = this.rooms.get(roomKey);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          this.rooms.delete(roomKey);
        }
      }
      ws.eventId = undefined;
    }
  }

  private send(ws: ExtendedWebSocket, msg: WsMessageOut) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  public broadcastToEvent(eventId: string, msg: WsMessageOut) {
    const roomKey = `event:${eventId}`;
    const clients = this.rooms.get(roomKey);
    if (!clients || clients.size === 0) return;

    const data = JSON.stringify(msg);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  public getConnectedCount(eventId: string): number {
    const roomKey = `event:${eventId}`;
    return this.rooms.get(roomKey)?.size || 0;
  }
}

let wsServerInstance: LiveQuizWsServer | null = null;

export function initWsServer(server: Server): LiveQuizWsServer {
  if (!wsServerInstance) {
    wsServerInstance = new LiveQuizWsServer(server);
  }
  return wsServerInstance;
}

export function getWsServer(): LiveQuizWsServer | null {
  return wsServerInstance;
}

/**
 * WebSocket Handler for live frame/event streaming
 */

import type { FastifyInstance } from 'fastify';
import type { WsMessage } from '@homiq-emulator/shared';
import type { WebSocket } from '@fastify/websocket';

export interface WebSocketHandler {
  emit(msg: WsMessage): void;
}

export function createWebSocketHandler(fastify: FastifyInstance): WebSocketHandler {
  const clients = new Set<WebSocket>();

  // Register WebSocket route
  fastify.register(async (app) => {
    app.get('/ws', { websocket: true }, (socket) => {
      clients.add(socket);
      console.log(`[WS] Client connected (${clients.size} total)`);

      socket.on('close', () => {
        clients.delete(socket);
        console.log(`[WS] Client disconnected (${clients.size} remaining)`);
      });

      socket.on('error', (err: Error) => {
        console.log(`[WS] Client error: ${err.message}`);
        clients.delete(socket);
      });

      // Send welcome message
      socket.send(JSON.stringify({
        type: 'connection',
        timestamp: new Date().toISOString(),
        data: { message: 'Connected to Homiq Emulator' },
      }));
    });
  });

  return {
    emit(msg: WsMessage): void {
      const json = JSON.stringify(msg);
      for (const client of clients) {
        try {
          client.send(json);
        } catch {
          clients.delete(client);
        }
      }
    },
  };
}

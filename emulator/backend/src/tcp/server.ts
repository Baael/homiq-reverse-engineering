/**
 * TCP Server - Emulates Moxa NE-4110S RS485-to-TCP/IP bridge
 */

import net from 'net';
import type { MoxaConfig, WsMessage } from '@homiq-emulator/shared';
import { FrameBuffer, parseFrame, serializeFrame } from '../protocol/parser.js';
import type { SimulationEngine } from '../simulation/engine.js';

interface ClientConnection {
  id: string;
  socket: net.Socket;
  remoteAddr: string;
  connectedAt: Date;
  lastActivity: Date;
  rxCount: number;
  txCount: number;
  buffer: FrameBuffer;
}

export interface TcpServer {
  start(): void;
  stop(): void;
  getConnections(): ClientConnection[];
  broadcast(frame: string): void;
}

export function createTcpServer(
  config: MoxaConfig,
  simulation: SimulationEngine,
  emit: (msg: WsMessage) => void
): TcpServer {
  const connections = new Map<string, ClientConnection>();
  let server: net.Server | null = null;
  let connectionIdCounter = 0;

  function handleConnection(socket: net.Socket): void {
    const id = `conn_${++connectionIdCounter}`;
    const remoteAddr = `${socket.remoteAddress}:${socket.remotePort}`;

    const client: ClientConnection = {
      id,
      socket,
      remoteAddr,
      connectedAt: new Date(),
      lastActivity: new Date(),
      rxCount: 0,
      txCount: 0,
      buffer: new FrameBuffer(),
    };

    connections.set(id, client);
    console.log(`[TCP] New connection: ${remoteAddr} (${connections.size} total)`);

    emit({
      type: 'connection',
      timestamp: new Date().toISOString(),
      data: { id, remoteAddr },
    });

    socket.on('data', (data) => {
      client.lastActivity = new Date();
      const frames = client.buffer.push(data.toString('utf-8'));

      for (const rawFrame of frames) {
        client.rxCount++;
        console.log(`[TCP RX] ${remoteAddr}: ${rawFrame}`);

        emit({
          type: 'frame_rx',
          timestamp: new Date().toISOString(),
          data: { remoteAddr, frame: rawFrame },
        });

        const parsed = parseFrame(rawFrame);
        if (!parsed) {
          console.log(`[TCP] Invalid frame from ${remoteAddr}: ${rawFrame}`);
          continue;
        }

        if (!parsed.valid) {
          console.log(`[TCP] CRC error from ${remoteAddr}: expected valid CRC`);
          // Still process if faults allow
        }

        // Let simulation engine handle the frame
        const responses = simulation.handleFrame(parsed, remoteAddr);

        for (const response of responses) {
          const wireFrame = serializeFrame(response);
          socket.write(wireFrame);
          client.txCount++;

          console.log(`[TCP TX] ${remoteAddr}: ${wireFrame.trim()}`);
          emit({
            type: 'frame_tx',
            timestamp: new Date().toISOString(),
            data: { remoteAddr, frame: wireFrame.trim() },
          });
        }
      }
    });

    socket.on('close', () => {
      connections.delete(id);
      console.log(`[TCP] Connection closed: ${remoteAddr} (${connections.size} remaining)`);

      emit({
        type: 'disconnection',
        timestamp: new Date().toISOString(),
        data: { id, remoteAddr },
      });
    });

    socket.on('error', (err) => {
      console.log(`[TCP] Socket error ${remoteAddr}: ${err.message}`);
    });

    // Set keep-alive
    socket.setKeepAlive(true, config.keepAliveIntervalMs);

    // Connection timeout
    socket.setTimeout(config.connectionTimeoutMs, () => {
      console.log(`[TCP] Connection timeout: ${remoteAddr}`);
      socket.destroy();
    });
  }

  return {
    start() {
      server = net.createServer(handleConnection);

      server.on('error', (err) => {
        console.error('[TCP] Server error:', err.message);
      });

      server.listen(config.port, config.host, () => {
        console.log(`[TCP] Listening on ${config.host}:${config.port}`);
      });

      // Set up simulation push events (async frames to clients)
      simulation.setPushHandler((frame) => {
        const wireFrame = serializeFrame(frame);
        for (const client of connections.values()) {
          client.socket.write(wireFrame);
          client.txCount++;

          emit({
            type: 'frame_tx',
            timestamp: new Date().toISOString(),
            data: { remoteAddr: client.remoteAddr, frame: wireFrame.trim(), push: true },
          });
        }
      });
    },

    stop() {
      if (server) {
        for (const client of connections.values()) {
          client.socket.destroy();
        }
        connections.clear();
        server.close();
        server = null;
      }
    },

    getConnections() {
      return Array.from(connections.values());
    },

    broadcast(frame: string) {
      for (const client of connections.values()) {
        client.socket.write(frame);
        client.txCount++;
      }
    },
  };
}

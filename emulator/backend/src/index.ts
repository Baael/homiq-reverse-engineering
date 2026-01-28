/**
 * Homiq Master Emulator - Backend Entry Point
 *
 * TCP Server (port 4001) + HTTP API + WebSocket for live logs
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { createTcpServer } from './tcp/server.js';
import { createDatabase } from './db/database.js';
import { registerApiRoutes } from './api/routes.js';
import { createSimulationEngine } from './simulation/engine.js';
import { createWebSocketHandler } from './ws/handler.js';
import { DEFAULT_MOXA_CONFIG } from '@homiq-emulator/shared';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║       Homiq Master Emulator (Moxa NE-4110S)            ║');
  console.log('║       TCP/IP ←→ RS485 Bridge Simulator                 ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log();

  // Initialize database
  const db = createDatabase();
  console.log('✓ SQLite database initialized');

  // Initialize simulation engine
  const simulation = createSimulationEngine(db);
  console.log('✓ Simulation engine ready');

  // Initialize Fastify HTTP server
  const fastify = Fastify({
    logger: {
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  await fastify.register(cors, { origin: true });
  await fastify.register(websocket);

  // Serve frontend static files in production
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  try {
    await fastify.register(fastifyStatic, {
      root: frontendPath,
      prefix: '/',
    });
  } catch {
    console.log('ℹ Frontend static files not found (dev mode)');
  }

  // WebSocket handler for live logs
  const wsHandler = createWebSocketHandler(fastify);
  simulation.setEventEmitter(wsHandler.emit);

  // Register API routes
  registerApiRoutes(fastify, db, simulation);

  // Start HTTP server
  const HTTP_PORT = parseInt(process.env.HTTP_PORT || '3000', 10);
  await fastify.listen({ port: HTTP_PORT, host: '0.0.0.0' });
  console.log(`✓ HTTP API listening on http://0.0.0.0:${HTTP_PORT}`);

  // Start TCP server (Moxa emulation)
  const config = { ...DEFAULT_MOXA_CONFIG };
  if (process.env.TCP_PORT) {
    config.port = parseInt(process.env.TCP_PORT, 10);
  }

  const tcpServer = createTcpServer(config, simulation, wsHandler.emit);
  tcpServer.start();
  console.log(`✓ TCP server listening on ${config.host}:${config.port}`);
  console.log();
  console.log('Ready to accept connections. Send frames like:');
  console.log('  <;HB;1;0;0;1;s;CRC;>');
  console.log('  <;ID.0;1;0;03;1;s;CRC;>');
  console.log();

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');
    tcpServer.stop();
    await fastify.close();
    db.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

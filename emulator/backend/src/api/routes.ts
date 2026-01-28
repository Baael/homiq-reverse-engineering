/**
 * HTTP API Routes
 */

import type { FastifyInstance } from 'fastify';
import type { DatabaseInstance } from '../db/database.js';
import type { SimulationEngine } from '../simulation/engine.js';

export function registerApiRoutes(
  fastify: FastifyInstance,
  db: DatabaseInstance,
  simulation: SimulationEngine
): void {
  // Health check
  fastify.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // ==================== DEVICES ====================

  // List all devices
  fastify.get('/api/devices', async () => {
    return simulation.getDevices();
  });

  // Get device by address
  fastify.get<{ Params: { addr: string } }>('/api/devices/:addr', async (request) => {
    const device = simulation.getDeviceByAddr(request.params.addr);
    if (!device) {
      return { error: 'Device not found' };
    }
    return device;
  });

  // Get device properties
  fastify.get<{ Params: { addr: string } }>('/api/devices/:addr/properties', async (request) => {
    const device = db.prepare('SELECT id FROM devices WHERE node_addr = ?').get(request.params.addr) as { id: number } | undefined;
    if (!device) {
      return { error: 'Device not found' };
    }

    const properties = db.prepare('SELECT * FROM device_properties WHERE device_id = ?').all(device.id);
    return properties;
  });

  // Get device programming
  fastify.get<{ Params: { addr: string } }>('/api/devices/:addr/programming', async (request) => {
    const device = db.prepare('SELECT id FROM devices WHERE node_addr = ?').get(request.params.addr) as { id: number } | undefined;
    if (!device) {
      return { error: 'Device not found' };
    }

    const programming = db.prepare('SELECT * FROM device_programming WHERE device_id = ?').all(device.id);
    return programming;
  });

  // Create device
  fastify.post<{
    Body: {
      name: string;
      nodeAddr: string;
      deviceType: string;
      deviceId?: string;
    };
  }>('/api/devices', async (request) => {
    const { name, nodeAddr, deviceType, deviceId } = request.body;

    try {
      const result = db.prepare(`
        INSERT INTO devices (name, node_addr, device_type, device_id)
        VALUES (?, ?, ?, ?)
      `).run(name, nodeAddr, deviceType, deviceId || null);

      return { id: result.lastInsertRowid, success: true };
    } catch (err) {
      return { error: (err as Error).message };
    }
  });

  // Update device
  fastify.put<{
    Params: { addr: string };
    Body: {
      name?: string;
      online?: boolean;
      programmingMode?: boolean;
    };
  }>('/api/devices/:addr', async (request) => {
    const { name, online, programmingMode } = request.body;

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (online !== undefined) {
      updates.push('online = ?');
      values.push(online ? 1 : 0);
    }
    if (programmingMode !== undefined) {
      updates.push('programming_mode = ?');
      values.push(programmingMode ? 1 : 0);
    }

    if (updates.length === 0) {
      return { error: 'No updates provided' };
    }

    updates.push('updated_at = datetime("now")');
    values.push(request.params.addr);

    db.prepare(`UPDATE devices SET ${updates.join(', ')} WHERE node_addr = ?`).run(...values);
    return { success: true };
  });

  // Delete device
  fastify.delete<{ Params: { addr: string } }>('/api/devices/:addr', async (request) => {
    db.prepare('DELETE FROM devices WHERE node_addr = ?').run(request.params.addr);
    return { success: true };
  });

  // Update device property
  fastify.put<{
    Params: { addr: string; key: string };
    Body: { value: string };
  }>('/api/devices/:addr/properties/:key', async (request) => {
    const device = db.prepare('SELECT id FROM devices WHERE node_addr = ?').get(request.params.addr) as { id: number } | undefined;
    if (!device) {
      return { error: 'Device not found' };
    }

    db.prepare('UPDATE device_properties SET current_value = ? WHERE device_id = ? AND key = ?')
      .run(request.body.value, device.id, request.params.key);
    return { success: true };
  });

  // ==================== SCENARIOS ====================

  // List scenarios
  fastify.get('/api/scenarios', async () => {
    const scenarios = db.prepare('SELECT * FROM scenarios').all() as Array<{
      id: number;
      name: string;
      enabled: number;
      definition: string;
      created_at: string;
      updated_at: string;
    }>;
    return scenarios.map((s) => ({
      ...s,
      definition: JSON.parse(s.definition),
    }));
  });

  // Get active scenario
  fastify.get('/api/scenarios/active', async () => {
    const scenario = db.prepare('SELECT * FROM scenarios WHERE enabled = 1').get();
    if (!scenario) {
      return { id: null, name: 'None' };
    }
    return {
      ...scenario,
      definition: JSON.parse((scenario as Record<string, unknown>).definition as string),
    };
  });

  // Activate scenario
  fastify.post<{ Params: { id: string } }>('/api/scenarios/:id/activate', async (request) => {
    // Disable all scenarios first
    db.prepare('UPDATE scenarios SET enabled = 0').run();
    // Enable selected
    db.prepare('UPDATE scenarios SET enabled = 1 WHERE id = ?').run(request.params.id);
    return { success: true };
  });

  // Create scenario
  fastify.post<{
    Body: {
      name: string;
      definition: object;
    };
  }>('/api/scenarios', async (request) => {
    const { name, definition } = request.body;

    try {
      const result = db.prepare(`
        INSERT INTO scenarios (name, definition)
        VALUES (?, ?)
      `).run(name, JSON.stringify(definition));

      return { id: result.lastInsertRowid, success: true };
    } catch (err) {
      return { error: (err as Error).message };
    }
  });

  // Update scenario
  fastify.put<{
    Params: { id: string };
    Body: {
      name?: string;
      definition?: object;
    };
  }>('/api/scenarios/:id', async (request) => {
    const { name, definition } = request.body;

    const updates: string[] = [];
    const values: string[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (definition !== undefined) {
      updates.push('definition = ?');
      values.push(JSON.stringify(definition));
    }

    if (updates.length === 0) {
      return { error: 'No updates provided' };
    }

    updates.push('updated_at = datetime("now")');
    values.push(request.params.id);

    db.prepare(`UPDATE scenarios SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return { success: true };
  });

  // Delete scenario
  fastify.delete<{ Params: { id: string } }>('/api/scenarios/:id', async (request) => {
    db.prepare('DELETE FROM scenarios WHERE id = ?').run(request.params.id);
    return { success: true };
  });

  // ==================== FAULTS ====================

  // List faults
  fastify.get('/api/faults', async () => {
    const faults = db.prepare('SELECT * FROM faults').all() as Array<{
      id: number;
      type: string;
      enabled: number;
      params: string;
    }>;
    return faults.map((f) => ({
      ...f,
      params: JSON.parse(f.params),
    }));
  });

  // Toggle fault
  fastify.post<{
    Params: { type: string };
    Body: { enabled: boolean; params?: object };
  }>('/api/faults/:type/toggle', async (request) => {
    const { enabled, params } = request.body;

    if (params) {
      db.prepare('UPDATE faults SET enabled = ?, params = ? WHERE type = ?')
        .run(enabled ? 1 : 0, JSON.stringify(params), request.params.type);
    } else {
      db.prepare('UPDATE faults SET enabled = ? WHERE type = ?')
        .run(enabled ? 1 : 0, request.params.type);
    }
    return { success: true };
  });

  // ==================== MOXA CONFIG ====================

  // Get Moxa config
  fastify.get('/api/moxa', async () => {
    const config = db.prepare('SELECT * FROM moxa_config WHERE id = 1').get();
    return config;
  });

  // Update Moxa config
  fastify.put<{
    Body: {
      host?: string;
      port?: number;
      keepAliveIntervalMs?: number;
      connectionTimeoutMs?: number;
      maxClients?: number;
    };
  }>('/api/moxa', async (request) => {
    const { host, port, keepAliveIntervalMs, connectionTimeoutMs, maxClients } = request.body;

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (host !== undefined) {
      updates.push('host = ?');
      values.push(host);
    }
    if (port !== undefined) {
      updates.push('port = ?');
      values.push(port);
    }
    if (keepAliveIntervalMs !== undefined) {
      updates.push('keep_alive_interval_ms = ?');
      values.push(keepAliveIntervalMs);
    }
    if (connectionTimeoutMs !== undefined) {
      updates.push('connection_timeout_ms = ?');
      values.push(connectionTimeoutMs);
    }
    if (maxClients !== undefined) {
      updates.push('max_clients = ?');
      values.push(maxClients);
    }

    if (updates.length > 0) {
      db.prepare(`UPDATE moxa_config SET ${updates.join(', ')} WHERE id = 1`).run(...values);
    }

    return { success: true, note: 'Restart required for changes to take effect' };
  });

  // ==================== EVENTS LOG ====================

  // Get recent events
  fastify.get<{
    Querystring: { limit?: string; direction?: string; cmd?: string };
  }>('/api/events', async (request) => {
    const limit = parseInt(request.query.limit || '100', 10);
    const direction = request.query.direction;
    const cmd = request.query.cmd;

    let query = 'SELECT * FROM events_log';
    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (direction) {
      conditions.push('direction = ?');
      values.push(direction);
    }
    if (cmd) {
      conditions.push("frame LIKE ?");
      values.push(`%${cmd}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY id DESC LIMIT ?';
    values.push(limit);

    const events = db.prepare(query).all(...values);
    return events;
  });

  // Clear events log
  fastify.delete('/api/events', async () => {
    db.prepare('DELETE FROM events_log').run();
    return { success: true };
  });

  // ==================== STATS ====================

  fastify.get('/api/stats', async () => {
    const deviceCount = db.prepare('SELECT COUNT(*) as count FROM devices').get() as { count: number };
    const eventCount = db.prepare('SELECT COUNT(*) as count FROM events_log').get() as { count: number };
    const rxCount = db.prepare("SELECT COUNT(*) as count FROM events_log WHERE direction = 'rx'").get() as { count: number };
    const txCount = db.prepare("SELECT COUNT(*) as count FROM events_log WHERE direction = 'tx'").get() as { count: number };
    const errorCount = db.prepare("SELECT COUNT(*) as count FROM events_log WHERE outcome != 'ok'").get() as { count: number };

    return {
      devices: deviceCount.count,
      totalEvents: eventCount.count,
      rxFrames: rxCount.count,
      txFrames: txCount.count,
      errors: errorCount.count,
    };
  });
}

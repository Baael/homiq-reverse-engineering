/**
 * Simulation Engine - Handles device state, commands, and scenarios
 */

import type {
  HomiqFrame,
  ParsedFrame,
  Device,
  DeviceProperty,
  WsMessage,
  FaultType
} from '@homiq-emulator/shared';
import { createAckFrame } from '../protocol/parser.js';
import type { DatabaseInstance } from '../db/database.js';

export interface SimulationEngine {
  handleFrame(frame: ParsedFrame, remoteAddr: string): HomiqFrame[];
  setEventEmitter(emit: (msg: WsMessage) => void): void;
  setPushHandler(handler: (frame: HomiqFrame) => void): void;
  getDevices(): Device[];
  getDeviceByAddr(addr: string): Device | null;
  updateDeviceProperty(deviceAddr: string, cmd: string, value: string): void;
  toggleProgrammingMode(deviceAddr: string, enabled: boolean): void;
}

export function createSimulationEngine(db: DatabaseInstance): SimulationEngine {
  let eventEmitter: ((msg: WsMessage) => void) | null = null;
  let pushHandler: ((frame: HomiqFrame) => void) | null = null;
  const sequenceCounters = new Map<string, number>();

  // Get next sequence ID for a device
  function getNextSeqId(deviceAddr: string): number {
    const current = sequenceCounters.get(deviceAddr) || 0;
    const next = (current % 511) + 1;
    sequenceCounters.set(deviceAddr, next);
    return next;
  }

  // Log event to database
  function logEvent(
    direction: 'rx' | 'tx',
    remoteAddr: string,
    frame: string,
    parsed: HomiqFrame | null,
    outcome: string
  ): void {
    try {
      db.prepare(`
        INSERT INTO events_log (direction, remote_addr, frame, parsed, outcome)
        VALUES (?, ?, ?, ?, ?)
      `).run(direction, remoteAddr, frame, parsed ? JSON.stringify(parsed) : null, outcome);
    } catch (err) {
      console.error('Failed to log event:', err);
    }
  }

  // Check if any fault should be applied
  function shouldApplyFault(type: FaultType, cmd?: string, deviceAddr?: string): boolean {
    const fault = db.prepare('SELECT * FROM faults WHERE type = ? AND enabled = 1').get(type) as {
      type: string;
      enabled: number;
      params: string;
    } | undefined;

    if (!fault) return false;

    const params = JSON.parse(fault.params);

    if (params.probability !== undefined) {
      if (Math.random() > params.probability) return false;
    }

    if (params.targetCmd && cmd && params.targetCmd !== cmd) return false;
    if (params.targetDevice && deviceAddr && params.targetDevice !== deviceAddr) return false;

    return true;
  }

  // Get delay from latency fault
  function getLatencyDelay(): number {
    const fault = db.prepare('SELECT * FROM faults WHERE type = ? AND enabled = 1').get('latency') as {
      params: string;
    } | undefined;

    if (!fault) return 0;

    const params = JSON.parse(fault.params);
    const base = params.delayMs || 0;
    const jitter = params.jitterMs || 0;
    return base + Math.floor(Math.random() * jitter);
  }

  // Handle specific commands
  function handleCommand(frame: ParsedFrame, remoteAddr: string): HomiqFrame[] {
    const { cmd, val, dst, id } = frame;
    const responses: HomiqFrame[] = [];

    // Find device by address
    const device = db.prepare('SELECT * FROM devices WHERE node_addr = ?').get(dst) as {
      id: number;
      name: string;
      node_addr: string;
      device_type: string;
      device_id: string;
      online: number;
      programming_mode: number;
    } | undefined;

    // Check device offline fault
    if (shouldApplyFault('device_offline', cmd, dst)) {
      console.log(`[SIM] Device ${dst} is offline (fault)`);
      logEvent('rx', remoteAddr, frame.raw, frame, 'device_offline');
      return [];
    }

    // Check ACK timeout fault
    if (shouldApplyFault('ack_timeout', cmd, dst)) {
      console.log(`[SIM] ACK timeout for ${cmd} (fault)`);
      logEvent('rx', remoteAddr, frame.raw, frame, 'ack_timeout');
      return [];
    }

    // Log received frame
    logEvent('rx', remoteAddr, frame.raw, frame, 'ok');

    // Handle HB (Heartbeat)
    if (cmd === 'HB') {
      responses.push(createAckFrame(frame, '1'));
      return responses;
    }

    // Handle ID.0 (Device identification)
    if (cmd === 'ID.0') {
      const deviceId = device?.device_id || '00000';
      responses.push(createAckFrame(frame, deviceId));
      return responses;
    }

    // Handle S.0 (Device status)
    if (cmd === 'S.0') {
      const status = device?.online ? '1' : '0';
      responses.push(createAckFrame(frame, status));
      return responses;
    }

    // Handle GI (Get inputs as bitmask)
    if (cmd === 'GI') {
      if (!device) {
        responses.push(createAckFrame(frame, '0'));
        return responses;
      }

      // Calculate bitmask from inputs
      const inputs = db.prepare(`
        SELECT current_value FROM device_properties
        WHERE device_id = ? AND cmd_read LIKE 'I.%'
        ORDER BY cmd_read
      `).all(device.id) as { current_value: string }[];

      let bitmask = 0;
      inputs.forEach((inp, idx) => {
        if (inp.current_value === '1') {
          bitmask |= (1 << idx);
        }
      });

      responses.push(createAckFrame(frame, bitmask.toString()));
      return responses;
    }

    // Handle LI (Get input limits/config)
    if (cmd === 'LI') {
      // Return configured input count as bitmask
      responses.push(createAckFrame(frame, '65535')); // 16 inputs
      return responses;
    }

    // Handle PG (Programming mode)
    if (cmd === 'PG') {
      if (device) {
        const enabled = val === '1' ? 1 : 0;
        db.prepare('UPDATE devices SET programming_mode = ?, updated_at = datetime("now") WHERE id = ?')
          .run(enabled, device.id);
        console.log(`[SIM] Device ${dst} programming mode: ${enabled ? 'ON' : 'OFF'}`);
      }
      responses.push(createAckFrame(frame));
      return responses;
    }

    // Handle programming commands (IM.*, II.*, ODS.*, IOM.*, etc.)
    const progCmds = ['IM', 'II', 'ODS', 'IOM', 'MIN', 'MAX', 'TB', 'TD', 'UDS', 'UDD'];
    const cmdBase = cmd.split('.')[0];
    if (progCmds.includes(cmdBase)) {
      if (device) {
        db.prepare(`
          INSERT OR REPLACE INTO device_programming (device_id, cmd, val, updated_at)
          VALUES (?, ?, ?, datetime('now'))
        `).run(device.id, cmd, val);
        console.log(`[SIM] Device ${dst} programmed: ${cmd}=${val}`);
      }
      responses.push(createAckFrame(frame));
      return responses;
    }

    // Handle I.* (Input read)
    if (cmd.startsWith('I.')) {
      if (device) {
        const prop = db.prepare(`
          SELECT current_value FROM device_properties
          WHERE device_id = ? AND cmd_read = ?
        `).get(device.id, cmd) as { current_value: string } | undefined;

        const value = prop?.current_value || '0';
        responses.push(createAckFrame(frame, value));
      } else {
        responses.push(createAckFrame(frame, '0'));
      }
      return responses;
    }

    // Handle O.* (Output write/read)
    if (cmd.startsWith('O.')) {
      if (device) {
        // Write the value
        db.prepare(`
          UPDATE device_properties SET current_value = ?
          WHERE device_id = ? AND cmd_write = ?
        `).run(val, device.id, cmd);

        console.log(`[SIM] Device ${dst} output ${cmd}=${val}`);

        // Emit device update
        eventEmitter?.({
          type: 'device_update',
          timestamp: new Date().toISOString(),
          data: { deviceAddr: dst, cmd, value: val },
        });
      }
      responses.push(createAckFrame(frame));
      return responses;
    }

    // Handle B1, B2 (Dimmer brightness)
    if (cmd === 'B1' || cmd === 'B2') {
      if (device) {
        const key = cmd === 'B1' ? 'brightness_1' : 'brightness_2';
        db.prepare(`
          UPDATE device_properties SET current_value = ?
          WHERE device_id = ? AND key = ?
        `).run(val, device.id, key);

        console.log(`[SIM] Device ${dst} dimmer ${cmd}=${val}`);
      }
      responses.push(createAckFrame(frame));
      return responses;
    }

    // Handle T.* (Temperature read)
    if (cmd.startsWith('T.')) {
      if (device) {
        const prop = db.prepare(`
          SELECT current_value FROM device_properties
          WHERE device_id = ? AND cmd_read = ?
        `).get(device.id, cmd) as { current_value: string } | undefined;

        const value = prop?.current_value || '0.0';
        responses.push(createAckFrame(frame, value));
      } else {
        responses.push(createAckFrame(frame, '0.0'));
      }
      return responses;
    }

    // Handle L.* (LED/Position)
    if (cmd.startsWith('L.')) {
      if (device) {
        db.prepare(`
          UPDATE device_properties SET current_value = ?
          WHERE device_id = ? AND cmd_write = ?
        `).run(val, device.id, cmd);

        console.log(`[SIM] Device ${dst} LED/position ${cmd}=${val}`);
      }
      responses.push(createAckFrame(frame));
      return responses;
    }

    // Unknown command - still ACK
    console.log(`[SIM] Unknown command: ${cmd}`);
    responses.push(createAckFrame(frame));
    return responses;
  }

  return {
    handleFrame(frame: ParsedFrame, remoteAddr: string): HomiqFrame[] {
      // Only process 'send' frames, not 'ack'
      if (frame.type !== 's') {
        return [];
      }

      // Check packet loss fault
      if (shouldApplyFault('packet_loss', frame.cmd, frame.dst)) {
        console.log(`[SIM] Packet dropped (fault): ${frame.raw}`);
        logEvent('rx', remoteAddr, frame.raw, frame, 'dropped');
        return [];
      }

      // Apply latency if configured
      const delay = getLatencyDelay();
      if (delay > 0) {
        // In a real implementation, we'd use setTimeout
        // For now, just log it
        console.log(`[SIM] Adding ${delay}ms latency`);
      }

      return handleCommand(frame, remoteAddr);
    },

    setEventEmitter(emit: (msg: WsMessage) => void): void {
      eventEmitter = emit;
    },

    setPushHandler(handler: (frame: HomiqFrame) => void): void {
      pushHandler = handler;

      // Start push event timers based on active scenario
      const scenario = db.prepare('SELECT * FROM scenarios WHERE enabled = 1').get() as {
        definition: string;
      } | undefined;

      if (scenario) {
        const def = JSON.parse(scenario.definition);
        if (def.pushEvents) {
          for (const pe of def.pushEvents) {
            setInterval(() => {
              let value = '0';
              if (pe.valueGenerator === 'toggle') {
                // Get current value and toggle
                const device = db.prepare('SELECT id FROM devices WHERE node_addr = ?').get(pe.deviceAddr) as { id: number } | undefined;
                if (device) {
                  const prop = db.prepare('SELECT current_value FROM device_properties WHERE device_id = ? AND cmd_read = ?')
                    .get(device.id, pe.cmd) as { current_value: string } | undefined;
                  value = prop?.current_value === '1' ? '0' : '1';
                  db.prepare('UPDATE device_properties SET current_value = ? WHERE device_id = ? AND cmd_read = ?')
                    .run(value, device.id, pe.cmd);
                }
              } else if (pe.valueGenerator === 'random') {
                const min = pe.minValue ?? 0;
                const max = pe.maxValue ?? 1;
                value = Math.floor(Math.random() * (max - min + 1) + min).toString();
              } else if (pe.valueGenerator === 'fixed') {
                value = pe.fixedValue ?? '1';
              }

              const pushFrame: HomiqFrame = {
                cmd: pe.cmd,
                val: value,
                src: pe.deviceAddr,
                dst: '0',
                id: getNextSeqId(pe.deviceAddr),
                type: 's',
                crc: 0,
              };

              console.log(`[SIM] Push event: ${pe.cmd}=${value} from ${pe.deviceAddr}`);
              handler(pushFrame);
            }, pe.intervalMs);
          }
        }
      }
    },

    getDevices(): Device[] {
      const rows = db.prepare('SELECT * FROM devices').all() as Array<{
        id: number;
        name: string;
        node_addr: string;
        device_type: string;
        device_id: string;
        online: number;
        programming_mode: number;
        created_at: string;
        updated_at: string;
      }>;

      return rows.map(row => ({
        id: row.id,
        name: row.name,
        nodeAddr: row.node_addr,
        deviceType: row.device_type as Device['deviceType'],
        deviceId: row.device_id,
        online: row.online === 1,
        programmingMode: row.programming_mode === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    },

    getDeviceByAddr(addr: string): Device | null {
      const row = db.prepare('SELECT * FROM devices WHERE node_addr = ?').get(addr) as {
        id: number;
        name: string;
        node_addr: string;
        device_type: string;
        device_id: string;
        online: number;
        programming_mode: number;
        created_at: string;
        updated_at: string;
      } | undefined;

      if (!row) return null;

      return {
        id: row.id,
        name: row.name,
        nodeAddr: row.node_addr,
        deviceType: row.device_type as Device['deviceType'],
        deviceId: row.device_id,
        online: row.online === 1,
        programmingMode: row.programming_mode === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    },

    updateDeviceProperty(deviceAddr: string, cmd: string, value: string): void {
      const device = db.prepare('SELECT id FROM devices WHERE node_addr = ?').get(deviceAddr) as { id: number } | undefined;
      if (device) {
        db.prepare(`
          UPDATE device_properties SET current_value = ?
          WHERE device_id = ? AND (cmd_read = ? OR cmd_write = ?)
        `).run(value, device.id, cmd, cmd);
      }
    },

    toggleProgrammingMode(deviceAddr: string, enabled: boolean): void {
      db.prepare('UPDATE devices SET programming_mode = ? WHERE node_addr = ?')
        .run(enabled ? 1 : 0, deviceAddr);
    },
  };
}

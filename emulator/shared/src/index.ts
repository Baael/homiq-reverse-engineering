/**
 * Homiq Protocol - Shared Types and Utilities
 *
 * Frame format: <;CMD;VAL;SRC;DST;ID;TYPE;CRC;>\r\n
 */

// ============================================================================
// Frame Types
// ============================================================================

export type FrameType = 's' | 'a';  // send or ack

export interface HomiqFrame {
  cmd: string;      // e.g. "I.3", "O.0", "HB", "ID.0", "PG"
  val: string;      // value (string, may be numeric or float like "21.36")
  src: string;      // source address (e.g. "0", "03")
  dst: string;      // destination address
  id: number;       // sequence number 1-511
  type: FrameType;  // 's' (send) or 'a' (ack)
  crc: number;      // CRC8 checksum
}

export interface ParsedFrame extends HomiqFrame {
  raw: string;      // original raw string
  valid: boolean;   // CRC validation result
}

// ============================================================================
// Device Types
// ============================================================================

export type DeviceType =
  | 'IO'           // 10x outs, 16x digital inputs
  | 'DIMMER'       // 2x 400VA dimmed outputs
  | 'UPDOWN'       // roller shutter (up/down)
  | 'RGB'          // RGB LED controller
  | 'IOWTEMP'      // IO with temperature sensors
  | 'HAC'          // HVAC controller
  | 'IO_IN_WALL'   // in-wall IO module
  | 'LED'          // LED controller
  | 'UDV';         // virtual user-defined variable

export interface Device {
  id: number;
  name: string;
  nodeAddr: string;           // DST address (e.g. "03")
  deviceType: DeviceType;
  deviceId?: string;          // device identifier (returned by ID.0)
  online: boolean;
  programmingMode: boolean;   // PG mode active
  createdAt: string;
  updatedAt: string;
}

export interface DeviceProperty {
  id: number;
  deviceId: number;
  key: string;                // property key (e.g. "input_0", "output_3", "temp_0")
  cmdRead: string;            // CMD for reading (e.g. "I.0", "T.0")
  cmdWrite?: string;          // CMD for writing (e.g. "O.0")
  valueType: 'bool' | 'int' | 'float' | 'string';
  currentValue: string;
  meta?: string;              // JSON metadata
}

export interface DeviceProgramming {
  id: number;
  deviceId: number;
  cmd: string;                // e.g. "IM.3", "II.0", "ODS.2"
  val: string;
  updatedAt: string;
}

// ============================================================================
// Scenario & Fault Types
// ============================================================================

export type FaultType =
  | 'none'
  | 'latency'         // add delay to responses
  | 'packet_loss'     // drop packets randomly
  | 'bad_crc'         // send invalid CRC
  | 'ack_timeout'     // don't send ACK
  | 'device_offline'  // device doesn't respond
  | 'restart_master'  // close TCP connection
  | 'noisy_inputs';   // inputs fluctuate randomly

export interface Scenario {
  id: number;
  name: string;
  enabled: boolean;
  definition: ScenarioDefinition;
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioDefinition {
  faults: FaultConfig[];
  pushEvents?: PushEventConfig[];
  inputFluctuation?: InputFluctuationConfig;
}

export interface FaultConfig {
  type: FaultType;
  enabled: boolean;
  probability?: number;       // 0-1 for random faults
  delayMs?: number;           // for latency
  targetCmd?: string;         // apply to specific CMD
  targetDevice?: string;      // apply to specific DST
}

export interface PushEventConfig {
  cmd: string;
  deviceAddr: string;
  intervalMs: number;
  valueGenerator: 'random' | 'toggle' | 'increment' | 'fixed';
  fixedValue?: string;
  minValue?: number;
  maxValue?: number;
}

export interface InputFluctuationConfig {
  enabled: boolean;
  minIntervalMs: number;
  maxIntervalMs: number;
  inputs: string[];           // list of I.* to fluctuate
}

// ============================================================================
// Moxa Configuration
// ============================================================================

export interface MoxaConfig {
  host: string;
  port: number;
  keepAliveIntervalMs: number;
  connectionTimeoutMs: number;
  maxClients: number;
}

export const DEFAULT_MOXA_CONFIG: MoxaConfig = {
  host: '0.0.0.0',
  port: 4001,
  keepAliveIntervalMs: 15000,
  connectionTimeoutMs: 20000,
  maxClients: 10,
};

// ============================================================================
// Event Log
// ============================================================================

export interface EventLog {
  id: number;
  timestamp: string;
  direction: 'rx' | 'tx';
  remoteAddr: string;
  frame: string;
  parsed?: HomiqFrame;
  outcome: 'ok' | 'crc_error' | 'parse_error' | 'dropped' | 'timeout';
}

// ============================================================================
// API DTOs
// ============================================================================

export interface TcpStatus {
  listening: boolean;
  port: number;
  connections: ConnectionInfo[];
  stats: {
    totalRx: number;
    totalTx: number;
    errors: number;
    uptime: number;
  };
}

export interface ConnectionInfo {
  id: string;
  remoteAddr: string;
  connectedAt: string;
  lastActivity: string;
  rxCount: number;
  txCount: number;
}

// ============================================================================
// WebSocket Messages
// ============================================================================

export type WsMessageType =
  | 'frame_rx'
  | 'frame_tx'
  | 'connection'
  | 'disconnection'
  | 'device_update'
  | 'scenario_change';

export interface WsMessage {
  type: WsMessageType;
  timestamp: string;
  data: unknown;
}

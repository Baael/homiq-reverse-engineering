/**
 * Homiq Protocol - Shared Types and Utilities
 *
 * Frame format: <;CMD;VAL;SRC;DST;ID;TYPE;CRC;>\r\n
 */
export type FrameType = 's' | 'a';
export interface HomiqFrame {
    cmd: string;
    val: string;
    src: string;
    dst: string;
    id: number;
    type: FrameType;
    crc: number;
}
export interface ParsedFrame extends HomiqFrame {
    raw: string;
    valid: boolean;
}
export type DeviceType = 'IO' | 'DIMMER' | 'UPDOWN' | 'RGB' | 'IOWTEMP' | 'HAC' | 'IO_IN_WALL' | 'LED' | 'UDV';
export interface Device {
    id: number;
    name: string;
    nodeAddr: string;
    deviceType: DeviceType;
    deviceId?: string;
    online: boolean;
    programmingMode: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface DeviceProperty {
    id: number;
    deviceId: number;
    key: string;
    cmdRead: string;
    cmdWrite?: string;
    valueType: 'bool' | 'int' | 'float' | 'string';
    currentValue: string;
    meta?: string;
}
export interface DeviceProgramming {
    id: number;
    deviceId: number;
    cmd: string;
    val: string;
    updatedAt: string;
}
export type FaultType = 'none' | 'latency' | 'packet_loss' | 'bad_crc' | 'ack_timeout' | 'device_offline' | 'restart_master' | 'noisy_inputs';
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
    probability?: number;
    delayMs?: number;
    targetCmd?: string;
    targetDevice?: string;
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
    inputs: string[];
}
export interface MoxaConfig {
    host: string;
    port: number;
    keepAliveIntervalMs: number;
    connectionTimeoutMs: number;
    maxClients: number;
}
export declare const DEFAULT_MOXA_CONFIG: MoxaConfig;
export interface EventLog {
    id: number;
    timestamp: string;
    direction: 'rx' | 'tx';
    remoteAddr: string;
    frame: string;
    parsed?: HomiqFrame;
    outcome: 'ok' | 'crc_error' | 'parse_error' | 'dropped' | 'timeout';
}
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
export type WsMessageType = 'frame_rx' | 'frame_tx' | 'connection' | 'disconnection' | 'device_update' | 'scenario_change';
export interface WsMessage {
    type: WsMessageType;
    timestamp: string;
    data: unknown;
}
//# sourceMappingURL=index.d.ts.map
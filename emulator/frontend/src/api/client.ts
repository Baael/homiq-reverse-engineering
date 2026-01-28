const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// Health
export async function getHealth() {
  return request<{ status: string; timestamp: string }>('/health');
}

// Stats
export async function getStats() {
  return request<{
    devices: number;
    totalEvents: number;
    rxFrames: number;
    txFrames: number;
    errors: number;
  }>('/stats');
}

// Devices
export interface Device {
  id: number;
  name: string;
  nodeAddr: string;
  deviceType: string;
  deviceId?: string;
  online: boolean;
  programmingMode: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getDevices() {
  return request<Device[]>('/devices');
}

export async function getDevice(addr: string) {
  return request<Device>(`/devices/${addr}`);
}

export async function getDeviceProperties(addr: string) {
  return request<Array<{
    id: number;
    device_id: number;
    key: string;
    cmd_read: string;
    cmd_write: string | null;
    value_type: string;
    current_value: string;
    meta: string | null;
  }>>(`/devices/${addr}/properties`);
}

export async function createDevice(data: {
  name: string;
  nodeAddr: string;
  deviceType: string;
  deviceId?: string;
}) {
  return request<{ id: number; success: boolean }>('/devices', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateDevice(addr: string, data: {
  name?: string;
  online?: boolean;
  programmingMode?: boolean;
}) {
  return request<{ success: boolean }>(`/devices/${addr}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteDevice(addr: string) {
  return request<{ success: boolean }>(`/devices/${addr}`, {
    method: 'DELETE',
  });
}

export async function updateDeviceProperty(addr: string, key: string, value: string) {
  return request<{ success: boolean }>(`/devices/${addr}/properties/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });
}

// Scenarios
export interface Scenario {
  id: number;
  name: string;
  enabled: number;
  definition: {
    faults?: Array<{
      type: string;
      enabled: boolean;
      probability?: number;
      delayMs?: number;
    }>;
    pushEvents?: Array<{
      cmd: string;
      deviceAddr: string;
      intervalMs: number;
      valueGenerator: string;
    }>;
  };
  created_at: string;
  updated_at: string;
}

export async function getScenarios() {
  return request<Scenario[]>('/scenarios');
}

export async function getActiveScenario() {
  return request<Scenario | { id: null; name: string }>('/scenarios/active');
}

export async function activateScenario(id: number) {
  return request<{ success: boolean }>(`/scenarios/${id}/activate`, {
    method: 'POST',
  });
}

export async function createScenario(data: { name: string; definition: object }) {
  return request<{ id: number; success: boolean }>('/scenarios', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateScenario(id: number, data: { name?: string; definition?: object }) {
  return request<{ success: boolean }>(`/scenarios/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteScenario(id: number) {
  return request<{ success: boolean }>(`/scenarios/${id}`, {
    method: 'DELETE',
  });
}

// Faults
export interface Fault {
  id: number;
  type: string;
  enabled: number;
  params: Record<string, unknown>;
}

export async function getFaults() {
  return request<Fault[]>('/faults');
}

export async function toggleFault(type: string, enabled: boolean, params?: object) {
  return request<{ success: boolean }>(`/faults/${type}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ enabled, params }),
  });
}

// Moxa Config
export interface MoxaConfig {
  id: number;
  host: string;
  port: number;
  keep_alive_interval_ms: number;
  connection_timeout_ms: number;
  max_clients: number;
}

export async function getMoxaConfig() {
  return request<MoxaConfig>('/moxa');
}

export async function updateMoxaConfig(data: Partial<{
  host: string;
  port: number;
  keepAliveIntervalMs: number;
  connectionTimeoutMs: number;
  maxClients: number;
}>) {
  return request<{ success: boolean; note: string }>('/moxa', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Events
export interface EventLog {
  id: number;
  timestamp: string;
  direction: 'rx' | 'tx';
  remote_addr: string;
  frame: string;
  parsed: string | null;
  outcome: string;
}

export async function getEvents(params?: {
  limit?: number;
  direction?: string;
  cmd?: string;
}) {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.direction) query.set('direction', params.direction);
  if (params?.cmd) query.set('cmd', params.cmd);

  const queryStr = query.toString();
  return request<EventLog[]>(`/events${queryStr ? `?${queryStr}` : ''}`);
}

export async function clearEvents() {
  return request<{ success: boolean }>('/events', {
    method: 'DELETE',
  });
}

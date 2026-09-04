import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';

export interface ReaderStatus {
  readerId: string;
  name: string;
  ip: string;
  tcpPort: number;
  enabled: boolean;
  tcpConnected: boolean;
  pingOk: boolean;
  modbusOk: boolean;
  lastValidCodeTime: string | null;
  currentTemperature: number | null;
  status: number | string;
  message: string;
  updatedTime: string;
}

export interface Alarm {
  id: string;
  workshopId: string;
  lineId: string;
  ipcId: string;
  readerId: string | null;
  type: number;
  level: number;
  message: string;
  startTime: string;
  updatedTime: string;
  endTime: string | null;
  isRecovered: boolean;
}

export interface ProductionStatus {
  workshopId: string;
  lineId: string;
  ipcId: string;
  runState: string;
  speed: number;
  emergencyStop: boolean;
  updatedTime: string;
  isProductionRunning: boolean;
  readers?: ReaderStatus[];
  activeAlarms?: Alarm[];
}

export interface StartManualTriggerResponse {
  accepted: boolean;
  batchId: string;
  status: number | string;
  message: string;
}

export interface ManualTriggerBatch {
  batchId: string;
  status: number | string;
  triggerTime: string;
  requestedBy: string;
  expectedReaderCount: number;
  receivedReaderCount: number;
  serialAckMessage: string | null;
  errorMessage: string | null;
  completedTime: string | null;
}

export interface ManualTriggerResult {
  batchId: string;
  readerId: string;
  readerName: string;
  resultStatus: number | string;
  codeValue: string | null;
  elapsedMs: number | null;
  message: string;
}

export interface ManualTriggerResultsResponse {
  batchId: string;
  count: number;
  items: ManualTriggerResult[];
}

const demoReaders: ReaderStatus[] = [
  { readerId: 'CR-01', name: '1号读码器', ip: '192.168.31.101', tcpPort: 9001, enabled: true, tcpConnected: true, pingOk: true, modbusOk: true, lastValidCodeTime: new Date(Date.now() - 12000).toISOString(), currentTemperature: 38.2, status: 3, message: '运行正常', updatedTime: new Date().toISOString() },
  { readerId: 'CR-02', name: '2号读码器', ip: '192.168.31.102', tcpPort: 9001, enabled: true, tcpConnected: true, pingOk: true, modbusOk: true, lastValidCodeTime: new Date(Date.now() - 19000).toISOString(), currentTemperature: 41.6, status: 3, message: '运行正常', updatedTime: new Date().toISOString() },
  { readerId: 'CR-03', name: '3号读码器', ip: '192.168.31.103', tcpPort: 9001, enabled: true, tcpConnected: true, pingOk: true, modbusOk: true, lastValidCodeTime: new Date(Date.now() - 25000).toISOString(), currentTemperature: 55.8, status: 4, message: '设备温度接近告警阈值', updatedTime: new Date().toISOString() },
  { readerId: 'CR-04', name: '4号读码器', ip: '192.168.31.104', tcpPort: 9001, enabled: true, tcpConnected: false, pingOk: false, modbusOk: false, lastValidCodeTime: new Date(Date.now() - 460000).toISOString(), currentTemperature: null, status: 1, message: 'TCP连接已断开', updatedTime: new Date().toISOString() },
];

const demoAlarms: Alarm[] = [
  { id: 'alarm-1', workshopId: '淮安车间', lineId: 'LINE-01', ipcId: 'IPC-01', readerId: 'CR-04', type: 1, level: 2, message: '读码器 TCP 连接中断，请检查设备供电和网线连接', startTime: new Date(Date.now() - 460000).toISOString(), updatedTime: new Date().toISOString(), endTime: null, isRecovered: false },
  { id: 'alarm-2', workshopId: '淮安车间', lineId: 'LINE-01', ipcId: 'IPC-01', readerId: 'CR-03', type: 2, level: 1, message: '设备温度 55.8℃，接近设定告警阈值', startTime: new Date(Date.now() - 180000).toISOString(), updatedTime: new Date().toISOString(), endTime: null, isRecovered: false },
];

export function isDemoModeEnabled() {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1';
}

const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const hubUrl = import.meta.env.VITE_SIGNALR_HUB_URL || `${apiBase}/hubs/production-state`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers,
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message || `监测服务请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

export async function fetchReaderStatus() {
  if (isDemoModeEnabled()) return demoReaders;
  return request<ReaderStatus[]>('/api/readers/status');
}

export async function fetchActiveAlarms() {
  if (isDemoModeEnabled()) return demoAlarms;
  return request<Alarm[]>('/api/alarms/active');
}

export async function fetchProductionStatus() {
  if (isDemoModeEnabled()) return { workshopId: '淮安车间', lineId: 'LINE-01', ipcId: 'IPC-01', runState: 'Stopped', speed: 0, emergencyStop: false, updatedTime: new Date().toISOString(), isProductionRunning: false } satisfies ProductionStatus;
  return request<ProductionStatus>('/api/production/status');
}

export async function startManualTrigger(body: { requestedBy?: string; remark?: string }) {
  if (isDemoModeEnabled()) return { accepted: true, batchId: `MT${Date.now()}`, status: 'CommandSent', message: '自检指令已发送' } satisfies StartManualTriggerResponse;
  return request<StartManualTriggerResponse>('/api/manual-trigger/readers/all', { method: 'POST', body: JSON.stringify(body) });
}

export async function getManualTriggerBatch(batchId: string): Promise<ManualTriggerBatch> {
  if (isDemoModeEnabled()) return { batchId, status: 'Completed', triggerTime: new Date().toISOString(), requestedBy: 'mobile-operator', expectedReaderCount: 4, receivedReaderCount: 4, serialAckMessage: '控制指令确认成功', errorMessage: null, completedTime: new Date().toISOString() };
  return request<ManualTriggerBatch>(`/api/manual-trigger/batches/${encodeURIComponent(batchId)}`);
}

export async function getManualTriggerResults(batchId: string): Promise<ManualTriggerResultsResponse> {
  if (isDemoModeEnabled()) return { batchId, count: 4, items: demoReaders.map((reader, index) => ({ batchId, readerId: reader.readerId, readerName: reader.name, resultStatus: index === 3 ? 'ReaderTimeout' : 'ValidCode', codeValue: index === 3 ? null : `TEST-${index + 1}`, elapsedMs: index === 3 ? 5000 : 180 + index * 34, message: index === 3 ? '等待结果超时' : '读码成功' })) };
  return request<ManualTriggerResultsResponse>(`/api/manual-trigger/batches/${encodeURIComponent(batchId)}/results`);
}

export function createProductionConnection(callbacks: {
  onState: (snapshot: ProductionStatus) => void;
  onConnectionChange: (state: 'connecting' | 'online' | 'offline') => void;
}) {
  if (isDemoModeEnabled() || typeof window === 'undefined') return null;

  const connection = new HubConnectionBuilder()
    .withUrl(hubUrl, { withCredentials: true })
    .withAutomaticReconnect([1000, 2000, 5000, 10000, 30000])
    .configureLogging(import.meta.env.DEV ? LogLevel.Warning : LogLevel.Error)
    .withKeepAliveInterval(15000)
    .withServerTimeout(60000)
    .build();

  connection.on('productionState', callbacks.onState);
  connection.onreconnecting(() => callbacks.onConnectionChange('connecting'));
  connection.onreconnected(() => callbacks.onConnectionChange('online'));
  connection.onclose(() => callbacks.onConnectionChange('offline'));

  void connection.start()
    .then(() => callbacks.onConnectionChange('online'))
    .catch(() => callbacks.onConnectionChange('offline'));

  return {
    async stop() {
      if (connection.state !== HubConnectionState.Disconnected) await connection.stop();
    },
  };
}

// Domain Types - Network Diagnostics Suite

export type DeviceType = 'ONT' | 'Router' | 'Switch' | 'Antenna' | 'Unknown';

export interface NetworkDevice {
  id: string; // MAC or IP or generated UUID
  ip: string;
  mac?: string;
  hostname?: string;
  vendor?: string;
  deviceType: DeviceType;
  discoveryMethod: 'mDNS' | 'PingSweep' | 'Manual';
  firstSeen: number;
  lastSeen: number;
  isReachable: boolean;
}

export interface SnmpMetric {
  oid: string;
  name: string;
  value: string | number;
  type: string;
  unit?: string;
}

export interface SnmpDiagnosticResult {
  deviceId: string;
  ip: string;
  community: string;
  timestamp: number;
  success: boolean;
  sysName?: string;
  sysUpTime?: string;
  sysDescr?: string;
  ifInOctets?: number;
  ifOutOctets?: number;
  metrics: SnmpMetric[];
  error?: string;
  durationMs: number;
}

export interface SshCommandResult {
  command: string;
  output: string;
  exitCode: number;
  timestamp: number;
  durationMs: number;
  error?: string;
}

export interface SshDiagnosticResult {
  deviceId: string;
  ip: string;
  port: number;
  username: string;
  timestamp: number;
  success: boolean;
  commandResults: SshCommandResult[];
  error?: string;
}

export interface InstallationEvidence {
  id: string;
  deviceId: string;
  qrCode?: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  photoUris: string[];
  photoBase64s?: string[];
  notes: string;
  technicianName: string;
  timestamp: number;
  synced: boolean;
  pdfGenerated: boolean;
  pdfPath?: string;
}

export type OutboxActionType = 
  | 'SYNC_INSTALLATION'
  | 'SYNC_DIAGNOSTIC'
  | 'SYNC_DEVICE';

export type OutboxStatus = 'pending' | 'syncing' | 'failed' | 'completed';

export interface OutboxItem {
  id: string; // UUIDv4 idempotency key
  actionType: OutboxActionType;
  entityId: string;
  payload: any;
  status: OutboxStatus;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: number;
  createdAt: number;
  updatedAt: number;
  lastError?: string;
}

export interface SyncBatchRequest {
  clientTimestamp: number;
  deviceId: string;
  items: {
    syncId: string; // Outbox Item ID
    actionType: OutboxActionType;
    createdAt: number;
    payload: any;
  }[];
}

export interface SyncBatchResponse {
  success: boolean;
  message: string;
  processedSyncIds: string[];
  failedSyncIds: { syncId: string; error: string }[];
  serverTimestamp: number;
}

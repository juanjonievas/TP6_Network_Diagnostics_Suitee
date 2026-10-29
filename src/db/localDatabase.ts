import { NetworkDevice, InstallationEvidence, OutboxItem, SnmpDiagnosticResult, SshDiagnosticResult } from '../types';

export class LocalDatabase {
  private static devices: Map<string, NetworkDevice> = new Map();
  private static installations: Map<string, InstallationEvidence> = new Map();
  private static snmpDiagnostics: SnmpDiagnosticResult[] = [];
  private static sshDiagnostics: SshDiagnosticResult[] = [];
  private static outboxQueue: Map<string, OutboxItem> = new Map();

  // ---- DEVICES ----
  static async saveDevice(device: NetworkDevice): Promise<void> {
    this.devices.set(device.id, { ...device, lastSeen: Date.now() });
  }

  static async getDevices(): Promise<NetworkDevice[]> {
    return Array.from(this.devices.values());
  }

  static async getDeviceById(id: string): Promise<NetworkDevice | null> {
    return this.devices.get(id) || null;
  }

  // ---- INSTALLATIONS ----
  static async saveInstallation(inst: InstallationEvidence): Promise<void> {
    this.installations.set(inst.id, { ...inst });
  }

  static async getInstallations(): Promise<InstallationEvidence[]> {
    return Array.from(this.installations.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  static async getInstallationById(id: string): Promise<InstallationEvidence | null> {
    return this.installations.get(id) || null;
  }

  static async updateInstallation(id: string, updates: Partial<InstallationEvidence>): Promise<void> {
    const existing = this.installations.get(id);
    if (existing) {
      this.installations.set(id, { ...existing, ...updates });
    }
  }

  // ---- DIAGNOSTICS ----
  static async saveSnmpDiagnostic(diag: SnmpDiagnosticResult): Promise<void> {
    this.snmpDiagnostics.push({ ...diag });
  }

  static async saveSshDiagnostic(diag: SshDiagnosticResult): Promise<void> {
    this.sshDiagnostics.push({ ...diag });
  }

  static async getDiagnosticsForDevice(deviceId: string): Promise<{
    snmp: SnmpDiagnosticResult[];
    ssh: SshDiagnosticResult[];
  }> {
    return {
      snmp: this.snmpDiagnostics.filter(d => d.deviceId === deviceId || d.ip === deviceId),
      ssh: this.sshDiagnostics.filter(d => d.deviceId === deviceId || d.ip === deviceId),
    };
  }

  static async getAllDiagnostics(): Promise<{
    snmp: SnmpDiagnosticResult[];
    ssh: SshDiagnosticResult[];
  }> {
    return {
      snmp: [...this.snmpDiagnostics],
      ssh: [...this.sshDiagnostics],
    };
  }

  // ---- OUTBOX (TRANSACTIONAL QUEUE) ----
  static async insertOutboxItem(item: OutboxItem): Promise<void> {
    this.outboxQueue.set(item.id, { ...item });
  }

  static async getOutboxItems(): Promise<OutboxItem[]> {
    return Array.from(this.outboxQueue.values()).sort((a, b) => a.createdAt - b.createdAt);
  }

  static async getPendingOutboxItems(): Promise<OutboxItem[]> {
    const now = Date.now();
    return Array.from(this.outboxQueue.values())
      .filter(item => (item.status === 'pending' || item.status === 'failed') && item.nextRetryAt <= now)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  static async updateOutboxStatus(
    id: string,
    status: OutboxItem['status'],
    lastError?: string
  ): Promise<void> {
    const item = this.outboxQueue.get(id);
    if (item) {
      item.status = status;
      item.updatedAt = Date.now();
      if (lastError) item.lastError = lastError;
      if (status === 'failed') {
        item.retryCount += 1;
        // Exponential backoff: 2s, 4s, 8s, 16s... up to 60s
        const backoffSeconds = Math.min(Math.pow(2, item.retryCount), 60);
        item.nextRetryAt = Date.now() + (backoffSeconds * 1000);
      }
      this.outboxQueue.set(id, item);
    }
  }

  static async deleteOutboxItem(id: string): Promise<void> {
    this.outboxQueue.delete(id);
  }

  static async clearAll(): Promise<void> {
    this.devices.clear();
    this.installations.clear();
    this.snmpDiagnostics = [];
    this.sshDiagnostics = [];
    this.outboxQueue.clear();
  }
}

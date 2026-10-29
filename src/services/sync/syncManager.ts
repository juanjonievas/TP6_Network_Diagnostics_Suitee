import NetInfo from '@react-native-community/netinfo';
import { OutboxService } from './outboxService';
import { SyncBatchRequest, SyncBatchResponse } from '../../types';

export interface SyncStats {
  isSyncing: boolean;
  lastSyncTimestamp: number | null;
  lastSyncStatus: 'success' | 'failed' | 'idle';
  pendingCount: number;
  lastError?: string;
}

export class SyncManager {
  private static backendUrl = 'http://192.168.1.100:3000';
  private static isSyncing = false;
  private static lastSyncTimestamp: number | null = null;
  private static lastSyncStatus: 'success' | 'failed' | 'idle' = 'idle';
  private static lastError?: string;
  private static listeners: Array<(stats: SyncStats) => void> = [];

  static setBackendUrl(url: string): void {
    this.backendUrl = url.replace(/\/+$/, '');
  }

  static getBackendUrl(): string {
    return this.backendUrl;
  }

  static addListener(listener: (stats: SyncStats) => void): () => void {
    this.listeners.push(listener);
    this.notifyListeners();
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private static notifyListeners(): void {
    OutboxService.getPendingItems().then((pending) => {
      const stats: SyncStats = {
        isSyncing: this.isSyncing,
        lastSyncTimestamp: this.lastSyncTimestamp,
        lastSyncStatus: this.lastSyncStatus,
        pendingCount: pending.length,
        lastError: this.lastError,
      };
      this.listeners.forEach(cb => cb(stats));
    });
  }

  /**
   * Initializes automatic network change listener
   */
  static init(initialBackendUrl?: string): void {
    if (initialBackendUrl) {
      this.setBackendUrl(initialBackendUrl);
    }

    NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable !== false) {
        this.syncNow().catch((err) => {
          console.warn('[SyncManager] Sincronización automática diferida:', err.message);
        });
      }
    });
  }

  /**
   * Flushes the pending Outbox items to the central backend stub
   */
  static async syncNow(): Promise<{ syncedCount: number; failedCount: number; error?: string }> {
    if (this.isSyncing) {
      return { syncedCount: 0, failedCount: 0 };
    }

    const pendingItems = await OutboxService.getPendingItems();
    if (pendingItems.length === 0) {
      this.lastSyncStatus = 'idle';
      this.notifyListeners();
      return { syncedCount: 0, failedCount: 0 };
    }

    this.isSyncing = true;
    this.lastError = undefined;
    this.notifyListeners();

    const idsToSync = pendingItems.map(i => i.id);
    await OutboxService.markSyncing(idsToSync);

    const batchRequest: SyncBatchRequest = {
      clientTimestamp: Date.now(),
      deviceId: 'mobile-technician-unit-01',
      items: pendingItems.map(item => ({
        syncId: item.id,
        actionType: item.actionType,
        createdAt: item.createdAt,
        payload: item.payload,
      })),
    };

    let syncedCount = 0;
    let failedCount = 0;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.backendUrl}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(batchRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Servidor devolvió error HTTP ${response.status} (${response.statusText})`);
      }

      const result: SyncBatchResponse = await response.json();

      // Process successfully synced IDs
      for (const syncId of result.processedSyncIds || []) {
        await OutboxService.markCompleted(syncId);
        syncedCount++;
      }

      // Handle items rejected or failed on server
      for (const failedItem of result.failedSyncIds || []) {
        await OutboxService.markFailed(failedItem.syncId, failedItem.error);
        failedCount++;
      }

      this.lastSyncStatus = 'success';
      this.lastSyncTimestamp = Date.now();
    } catch (err: any) {
      const errMsg = err.name === 'AbortError' 
        ? 'Timeout de conexión con el backend de sincronización (10s)' 
        : (err.message || 'Error de red al sincronizar');

      this.lastSyncStatus = 'failed';
      this.lastError = errMsg;

      // Mark all batch items as failed with backoff calculation
      for (const id of idsToSync) {
        await OutboxService.markFailed(id, errMsg);
        failedCount++;
      }
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }

    return { syncedCount, failedCount, error: this.lastError };
  }
}

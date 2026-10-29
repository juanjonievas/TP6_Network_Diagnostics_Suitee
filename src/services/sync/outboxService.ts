import { OutboxActionType, OutboxItem } from '../../types';
import { LocalDatabase } from '../../db/localDatabase';

export class OutboxService {
  /**
   * Generates a standard UUIDv4 identifier
   */
  static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Enqueues an action into the persistent Outbox queue
   */
  static async enqueue(
    actionType: OutboxActionType,
    entityId: string,
    payload: any,
    maxRetries = 5
  ): Promise<OutboxItem> {
    const id = this.generateUUID();
    const now = Date.now();

    const item: OutboxItem = {
      id,
      actionType,
      entityId,
      payload,
      status: 'pending',
      retryCount: 0,
      maxRetries,
      nextRetryAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await LocalDatabase.insertOutboxItem(item);
    return item;
  }

  static async getPendingItems(): Promise<OutboxItem[]> {
    return LocalDatabase.getPendingOutboxItems();
  }

  static async markSyncing(ids: string[]): Promise<void> {
    for (const id of ids) {
      await LocalDatabase.updateOutboxStatus(id, 'syncing');
    }
  }

  static async markCompleted(id: string): Promise<void> {
    const items = await LocalDatabase.getOutboxItems();
    const item = items.find(i => i.id === id);
    if (item && item.actionType === 'SYNC_INSTALLATION') {
      await LocalDatabase.updateInstallation(item.entityId, { synced: true });
    }
    await LocalDatabase.deleteOutboxItem(id);
  }

  static async markFailed(id: string, error: string): Promise<void> {
    await LocalDatabase.updateOutboxStatus(id, 'failed', error);
  }
}

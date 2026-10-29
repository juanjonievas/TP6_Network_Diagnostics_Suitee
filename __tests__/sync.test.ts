import { LocalDatabase } from '../src/db/localDatabase';
import { OutboxService } from '../src/services/sync/outboxService';
import { SyncManager } from '../src/services/sync/syncManager';
import { InstallationEvidence } from '../src/types';

describe('Offline-First Outbox Pattern & Sync Engine (RF-07)', () => {
  beforeEach(async () => {
    await LocalDatabase.clearAll();
  });

  test('OutboxService: enqueues action and persists with UUIDv4', async () => {
    const payload = {
      id: 'inst_001',
      deviceId: 'router_192_168_1_1',
      latitude: -32.4825,
      longitude: -58.2372,
      notes: 'Instalación de fibra completada',
    };

    const item = await OutboxService.enqueue('SYNC_INSTALLATION', 'inst_001', payload);

    expect(item.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(item.status).toBe('pending');
    expect(item.retryCount).toBe(0);

    const pending = await OutboxService.getPendingItems();
    expect(pending.length).toBe(1);
    expect(pending[0].entityId).toBe('inst_001');
  });

  test('OutboxService: handles retry count and exponential backoff on failure', async () => {
    const item = await OutboxService.enqueue('SYNC_INSTALLATION', 'inst_fail', { test: true });

    // Simulate failure 1
    await OutboxService.markFailed(item.id, 'Timeout de conexión');
    const items1 = await LocalDatabase.getOutboxItems();
    const updated1 = items1.find(i => i.id === item.id);
    expect(updated1?.status).toBe('failed');
    expect(updated1?.retryCount).toBe(1);
    expect(updated1?.nextRetryAt).toBeGreaterThan(Date.now());

    // Simulate failure 2
    await OutboxService.markFailed(item.id, 'Error de servidor 500');
    const items2 = await LocalDatabase.getOutboxItems();
    const updated2 = items2.find(i => i.id === item.id);
    expect(updated2?.retryCount).toBe(2);
  });

  test('OutboxService: markCompleted removes outbox item and updates installation synced state', async () => {
    const installation: InstallationEvidence = {
      id: 'inst_sync_test',
      deviceId: 'dev_123',
      latitude: -32.48,
      longitude: -58.23,
      photoUris: [],
      notes: 'Test sync',
      technicianName: 'Técnico Pérez',
      timestamp: Date.now(),
      synced: false,
      pdfGenerated: false,
    };

    await LocalDatabase.saveInstallation(installation);
    const outboxItem = await OutboxService.enqueue('SYNC_INSTALLATION', installation.id, installation);

    // Verify it is not synced initially
    let inst = await LocalDatabase.getInstallationById(installation.id);
    expect(inst?.synced).toBe(false);

    // Complete sync
    await OutboxService.markCompleted(outboxItem.id);

    // Verify outbox queue is now empty and installation is marked synced
    const pending = await OutboxService.getPendingItems();
    expect(pending.length).toBe(0);

    inst = await LocalDatabase.getInstallationById(installation.id);
    expect(inst?.synced).toBe(true);
  });
});

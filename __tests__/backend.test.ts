import request from 'supertest';
const app = require('../backend/src/app');

describe('Backend Stub API & Idempotent Synchronization (RF-07, E-04)', () => {
  beforeEach(async () => {
    await request(app).delete('/api/reset');
  });

  test('GET /api/health: returns server online status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('online');
    expect(res.body.service).toMatch(/Network Diagnostics Suite/i);
  });

  test('POST /api/sync: receives outbox batch and persists installation report', async () => {
    const syncId = '11111111-2222-4333-8444-555555555555';
    const batch = {
      deviceId: 'unit-test-mobile',
      clientTimestamp: Date.now(),
      items: [
        {
          syncId,
          actionType: 'SYNC_INSTALLATION',
          createdAt: Date.now(),
          payload: {
            id: 'inst_test_01',
            deviceId: 'router_core_1',
            latitude: -32.4825,
            longitude: -58.2372,
            notes: 'Antena alineada y router configurado',
            technicianName: 'Juan Carlos',
            timestamp: Date.now(),
            synced: true,
          },
        },
      ],
    };

    const res = await request(app).post('/api/sync').send(batch);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.processedSyncIds).toContain(syncId);

    // Verify it is queryable via GET /api/reports
    const reportsRes = await request(app).get('/api/reports');
    expect(reportsRes.status).toBe(200);
    expect(reportsRes.body.total).toBe(1);
    expect(reportsRes.body.reports[0].id).toBe('inst_test_01');
    expect(reportsRes.body.reports[0].notes).toBe('Antena alineada y router configurado');
  });

  test('POST /api/sync: guarantees IDEMPOTENCY - duplicate syncId does not duplicate data', async () => {
    const syncId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const batch = {
      deviceId: 'unit-test-mobile',
      clientTimestamp: Date.now(),
      items: [
        {
          syncId,
          actionType: 'SYNC_INSTALLATION',
          createdAt: Date.now(),
          payload: {
            id: 'inst_idempotent_01',
            deviceId: 'router_idempotent',
            latitude: -32.50,
            longitude: -58.20,
            notes: 'Primera transmisión',
            timestamp: Date.now(),
          },
        },
      ],
    };

    // First attempt
    const res1 = await request(app).post('/api/sync').send(batch);
    expect(res1.status).toBe(200);
    expect(res1.body.processedSyncIds).toContain(syncId);

    // Second attempt (exact same payload & syncId simulating network timeout retry)
    const res2 = await request(app).post('/api/sync').send(batch);
    expect(res2.status).toBe(200);
    expect(res2.body.processedSyncIds).toContain(syncId);

    // Total count in database MUST remain exactly 1
    const reportsRes = await request(app).get('/api/reports');
    expect(reportsRes.body.total).toBe(1);
  });

  test('GET /api/reports/:id: returns 404 for non-existent report', async () => {
    const res = await request(app).get('/api/reports/non_existent_id');
    expect(res.status).toBe(404);
  });
});

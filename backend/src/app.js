const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();

app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'Network Diagnostics Suite - Sync Backend',
    timestamp: Date.now(),
  });
});

/**
 * POST /api/sync
 * Receives Outbox batch from mobile device with Idempotency guarantees
 */
app.post('/api/sync', (req, res) => {
  const { deviceId, clientTimestamp, items } = req.body;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({
      success: false,
      message: 'Formato inválido: el campo items debe ser un array de acciones Outbox',
    });
  }

  const processedSyncIds = [];
  const failedSyncIds = [];

  for (const item of items) {
    const { syncId, actionType, payload } = item;

    if (!syncId || !actionType) {
      failedSyncIds.push({
        syncId: syncId || 'unknown',
        error: 'Ítem inválido: syncId y actionType son requeridos',
      });
      continue;
    }

    // Idempotency check: if already processed, return success without duplicate work
    if (db.isSyncIdProcessed(syncId)) {
      processedSyncIds.push(syncId);
      continue;
    }

    try {
      if (actionType === 'SYNC_INSTALLATION') {
        db.upsertInstallation(payload);
        db.markSyncIdProcessed(syncId);
        processedSyncIds.push(syncId);
      } else if (actionType === 'SYNC_DEVICE') {
        db.upsertDevice(payload);
        db.markSyncIdProcessed(syncId);
        processedSyncIds.push(syncId);
      } else if (actionType === 'SYNC_DIAGNOSTIC') {
        db.addDiagnostic(payload);
        db.markSyncIdProcessed(syncId);
        processedSyncIds.push(syncId);
      } else {
        failedSyncIds.push({
          syncId,
          error: `Tipo de acción no reconocido: ${actionType}`,
        });
      }
    } catch (err) {
      failedSyncIds.push({
        syncId,
        error: err.message || 'Error procesando entidad en el servidor',
      });
    }
  }

  db.save();

  return res.status(200).json({
    success: failedSyncIds.length === 0,
    message: `Lote sincronizado: ${processedSyncIds.length} procesados, ${failedSyncIds.length} fallidos`,
    processedSyncIds,
    failedSyncIds,
    serverTimestamp: Date.now(),
  });
});

/**
 * GET /api/devices
 * Lists all registered devices
 */
app.get('/api/devices', (req, res) => {
  const devices = db.getDevices();
  res.status(200).json({
    total: devices.length,
    devices,
  });
});

/**
 * GET /api/reports
 * Lists all installation reports
 */
app.get('/api/reports', (req, res) => {
  const installations = db.getInstallations();
  res.status(200).json({
    total: installations.length,
    reports: installations,
  });
});

/**
 * GET /api/reports/:id
 * Retrieves a single installation report by ID
 */
app.get('/api/reports/:id', (req, res) => {
  const report = db.getInstallationById(req.params.id);
  if (!report) {
    return res.status(404).json({ error: 'Reporte no encontrado' });
  }
  res.status(200).json(report);
});

/**
 * GET /api/diagnostics
 * Lists all diagnostic entries
 */
app.get('/api/diagnostics', (req, res) => {
  const diagnostics = db.getDiagnostics();
  res.status(200).json({
    total: diagnostics.length,
    diagnostics,
  });
});

/**
 * DELETE /api/reset
 * Resets database (for test isolation)
 */
app.delete('/api/reset', (req, res) => {
  db.reset();
  res.status(200).json({ message: 'Base de datos del backend reseteada con éxito' });
});

module.exports = app;

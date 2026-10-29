const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'sync_store.json');

class BackendDb {
  constructor() {
    this.store = {
      processedSyncIds: new Set(),
      devices: {},
      installations: {},
      diagnostics: [],
    };
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        this.store.processedSyncIds = new Set(parsed.processedSyncIds || []);
        this.store.devices = parsed.devices || {};
        this.store.installations = parsed.installations || {};
        this.store.diagnostics = parsed.diagnostics || [];
      }
    } catch (e) {
      console.warn('[BackendDb] Error cargando base de datos existente, inicializando limpia:', e.message);
    }
  }

  save() {
    try {
      const dataToSave = {
        processedSyncIds: Array.from(this.store.processedSyncIds),
        devices: this.store.devices,
        installations: this.store.installations,
        diagnostics: this.store.diagnostics,
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave, null, 2), 'utf8');
    } catch (e) {
      console.error('[BackendDb] Error guardando datos en disco:', e);
    }
  }

  isSyncIdProcessed(syncId) {
    return this.store.processedSyncIds.has(syncId);
  }

  markSyncIdProcessed(syncId) {
    this.store.processedSyncIds.add(syncId);
  }

  upsertDevice(device) {
    if (!device || !device.id) return;
    this.store.devices[device.id] = {
      ...device,
      updatedAt: Date.now(),
    };
    this.save();
  }

  getDevices() {
    return Object.values(this.store.devices);
  }

  upsertInstallation(inst) {
    if (!inst || !inst.id) return;
    this.store.installations[inst.id] = {
      ...inst,
      receivedAt: Date.now(),
    };
    this.save();
  }

  getInstallations() {
    return Object.values(this.store.installations);
  }

  getInstallationById(id) {
    return this.store.installations[id] || null;
  }

  addDiagnostic(diag) {
    this.store.diagnostics.push({
      ...diag,
      receivedAt: Date.now(),
    });
    this.save();
  }

  getDiagnostics() {
    return this.store.diagnostics;
  }

  reset() {
    this.store = {
      processedSyncIds: new Set(),
      devices: {},
      installations: {},
      diagnostics: [],
    };
    this.save();
  }
}

module.exports = new BackendDb();

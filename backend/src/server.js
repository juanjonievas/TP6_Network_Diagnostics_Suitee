const app = require('./app');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Listen on all network interfaces for LAN connectivity

app.listen(PORT, HOST, () => {
  console.log('====================================================');
  console.log('  Network Diagnostics Suite - Sync Backend Stub');
  console.log(`  Servidor activo en: http://${HOST}:${PORT}`);
  console.log(`  Endpoint Sync:      POST http://<TU_IP_LOCAL>:${PORT}/api/sync`);
  console.log(`  Endpoint Reportes:  GET  http://<TU_IP_LOCAL>:${PORT}/api/reports`);
  console.log(`  Endpoint Equipos:   GET  http://<TU_IP_LOCAL>:${PORT}/api/devices`);
  console.log('====================================================');
});

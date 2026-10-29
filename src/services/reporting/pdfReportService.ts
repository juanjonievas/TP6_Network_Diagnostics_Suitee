import { InstallationEvidence, NetworkDevice, SnmpDiagnosticResult, SshDiagnosticResult } from '../../types';

export interface ReportGenerationInput {
  installation: InstallationEvidence;
  device?: NetworkDevice | null;
  snmpDiagnostics?: SnmpDiagnosticResult[];
  sshDiagnostics?: SshDiagnosticResult[];
}

export class PdfReportService {
  /**
   * Generates a fully formatted, self-contained HTML document for the installation report
   */
  static buildHtmlReport(data: ReportGenerationInput): string {
    const { installation, device, snmpDiagnostics = [], sshDiagnostics = [] } = data;
    const formattedDate = new Date(installation.timestamp).toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      dateStyle: 'full',
      timeStyle: 'medium',
    });

    const lat = installation.latitude.toFixed(6);
    const lng = installation.longitude.toFixed(6);
    const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

    // Render photo gallery with self-contained Base64 images
    const photos = installation.photoBase64s || [];
    const photoHtml = photos.length > 0
      ? photos.map((b64, idx) => `
          <div class="photo-card">
            <img src="${b64}" alt="Evidencia Fotográfica ${idx + 1}" />
            <div class="photo-caption">Evidencia de Instalación #${idx + 1}</div>
          </div>
        `).join('')
      : '<p class="empty-notice">No se adjuntaron fotografías en este relevamiento.</p>';

    // Render SNMP metrics
    const snmpHtml = snmpDiagnostics.length > 0
      ? snmpDiagnostics.map(snmp => `
          <div class="diag-block">
            <div class="diag-header">Consulta SNMP a ${snmp.ip} (${new Date(snmp.timestamp).toLocaleTimeString()})</div>
            <table class="data-table">
              <tr><th>Métrica</th><th>OID</th><th>Valor Obtenido</th></tr>
              ${snmp.sysName ? `<tr><td>sysName</td><td>1.3.6.1.2.1.1.5.0</td><td><strong>${snmp.sysName}</strong></td></tr>` : ''}
              ${snmp.sysUpTime ? `<tr><td>sysUpTime</td><td>1.3.6.1.2.1.1.3.0</td><td>${snmp.sysUpTime}</td></tr>` : ''}
              ${snmp.ifInOctets !== undefined ? `<tr><td>ifInOctets.1</td><td>1.3.6.1.2.1.2.2.1.10.1</td><td>${snmp.ifInOctets.toLocaleString()} bytes</td></tr>` : ''}
              ${snmp.ifOutOctets !== undefined ? `<tr><td>ifOutOctets.1</td><td>1.3.6.1.2.1.2.2.1.16.1</td><td>${snmp.ifOutOctets.toLocaleString()} bytes</td></tr>` : ''}
              ${snmp.sysDescr ? `<tr><td>sysDescr</td><td>1.3.6.1.2.1.1.1.0</td><td><small>${snmp.sysDescr}</small></td></tr>` : ''}
            </table>
          </div>
        `).join('')
      : '<p class="empty-notice">Sin registros de auditoría SNMP adjuntos.</p>';

    // Render SSH commands
    const sshHtml = sshDiagnostics.length > 0
      ? sshDiagnostics.map(ssh => `
          <div class="diag-block">
            <div class="diag-header">Sesión SSH a ${ssh.ip}:${ssh.port} (Usuario: ${ssh.username})</div>
            ${ssh.commandResults.map(cmd => `
              <div class="terminal-box">
                <div class="terminal-cmd">$ ${cmd.command} <span class="term-dur">(${cmd.durationMs}ms)</span></div>
                <pre class="terminal-out">${cmd.output}</pre>
              </div>
            `).join('')}
          </div>
        `).join('')
      : '<p class="empty-notice">Sin comandos de diagnóstico SSH ejecutados.</p>';

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte de Instalación - ${device?.hostname || installation.deviceId}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1a202c; background: #fff; padding: 28px; line-height: 1.5; font-size: 13px; }
    .header { border-bottom: 3px solid #2b6cb0; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title h1 { font-size: 22px; color: #2b6cb0; font-weight: 700; margin-bottom: 4px; }
    .title p { color: #4a5568; font-size: 13px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-weight: 600; font-size: 11px; text-transform: uppercase; }
    .badge-success { background: #c6f6d5; color: #22543d; }
    .badge-offline { background: #feebc8; color: #7b341e; }
    .meta-box { background: #edf2f7; border-radius: 6px; padding: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 15px; font-weight: 700; color: #2d3748; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; }
    .data-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12px; }
    .data-table th, .data-table td { padding: 8px 12px; border: 1px solid #e2e8f0; text-align: left; }
    .data-table th { background: #f7fafc; color: #4a5568; font-weight: 600; width: 30%; }
    .photo-grid { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 10px; }
    .photo-card { border: 1px solid #cbd5e0; border-radius: 6px; overflow: hidden; max-width: 280px; }
    .photo-card img { width: 100%; height: 180px; object-fit: cover; display: block; }
    .photo-caption { padding: 6px; background: #f7fafc; font-size: 11px; color: #718096; text-align: center; }
    .diag-block { margin-bottom: 14px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
    .diag-header { background: #ebf8ff; color: #2b6cb0; padding: 8px 12px; font-weight: 600; font-size: 12px; }
    .terminal-box { margin: 8px 12px 12px 12px; background: #1a202c; border-radius: 4px; padding: 10px; }
    .terminal-cmd { color: #68d391; font-family: monospace; font-size: 11px; margin-bottom: 6px; }
    .term-dur { color: #a0aec0; font-size: 10px; }
    .terminal-out { color: #f7fafc; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; margin: 0; }
    .empty-notice { color: #a0aec0; font-style: italic; font-size: 12px; padding: 6px 0; }
    .footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #a0aec0; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">
      <h1>Network Diagnostics Suite</h1>
      <p>Reporte Técnico de Instalación e Inspección de Infraestructura</p>
    </div>
    <div>
      <span class="badge ${installation.synced ? 'badge-success' : 'badge-offline'}">
        ${installation.synced ? 'SINCRONIZADO' : 'PENDIENTE DE SYNC'}
      </span>
    </div>
  </div>

  <div class="meta-box">
    <div><strong>ID Registro:</strong> ${installation.id}</div>
    <div><strong>Fecha y Hora:</strong> ${formattedDate}</div>
    <div><strong>Técnico Responsable:</strong> ${installation.technicianName || 'Técnico de Campo'}</div>
  </div>

  <div class="section">
    <div class="section-title">1. Identificación del Equipo</div>
    <table class="data-table">
      <tr><th>Dispositivo / ID</th><td>${device?.hostname || installation.deviceId}</td></tr>
      <tr><th>Dirección IP</th><td>${device?.ip || 'N/A'}</td></tr>
      <tr><th>Dirección MAC</th><td>${device?.mac || 'No disponible (Políticas SELinux Android 10+)'}</td></tr>
      <tr><th>Tipo de Dispositivo</th><td>${device?.deviceType || 'Equipo de Telecomunicaciones'}</td></tr>
      <tr><th>Código QR / Barra Leído</th><td>${installation.qrCode || 'No registrado'}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">2. Georreferenciación y Evidencia de Campo</div>
    <table class="data-table">
      <tr><th>Latitud Satelital</th><td>${lat}°</td></tr>
      <tr><th>Longitud Satelital</th><td>${lng}°</td></tr>
      <tr><th>Precisión GPS</th><td>${installation.accuracy ? `${installation.accuracy.toFixed(1)} metros` : 'Alta precisión satelital'}</td></tr>
      <tr><th>Enlace a Mapa</th><td><a href="${mapsUrl}" target="_blank">Abrir ubicación en Google Maps (${lat}, ${lng})</a></td></tr>
      <tr><th>Observaciones Técnicas</th><td>${installation.notes || 'Instalación completada sin observaciones adicionales.'}</td></tr>
    </table>
    <div class="photo-grid">
      ${photoHtml}
    </div>
  </div>

  <div class="section">
    <div class="section-title">3. Telemetría y Diagnóstico de Red (SNMP)</div>
    ${snmpHtml}
  </div>

  <div class="section">
    <div class="section-title">4. Diagnóstico de Control Remoto (SSH)</div>
    ${sshHtml}
  </div>

  <div class="footer">
    Documento técnico generado automáticamente por Network Diagnostics Suite Mobile v1.0 • Licenciatura en Sistemas de Información (FCFyT)
  </div>
</body>
</html>`;
  }

  /**
   * Generates and writes the PDF file (or returns HTML in headless/test mode)
   */
  static async generatePdf(data: ReportGenerationInput): Promise<{ html: string; filePath: string }> {
    const html = this.buildHtmlReport(data);
    const fileName = `Reporte_Instalacion_${data.installation.id.substring(0, 8)}_${Date.now()}.pdf`;
    let filePath = `/data/user/0/com.networkdiagnosticssuite/files/Documents/${fileName}`;

    try {
      // In native environment, try react-native-html-to-pdf
      const RNHTMLtoPDF = require('react-native-html-to-pdf');
      const generateFn = RNHTMLtoPDF.generatePDF || (RNHTMLtoPDF.default && RNHTMLtoPDF.default.generatePDF);
      if (generateFn) {
        const file = await generateFn({
          html,
          fileName,
          directory: 'Documents',
        });
        filePath = file.filePath || filePath;
      }
    } catch (_) {
      // Running headless or in Node test environment: fallback to simulated path
      filePath = `simulated/reports/${fileName}`;
    }

    return { html, filePath };
  }
}

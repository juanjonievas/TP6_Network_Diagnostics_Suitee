import { PdfReportService } from '../src/services/reporting/pdfReportService';
import { EvidenceService } from '../src/services/evidence/evidenceService';
import { InstallationEvidence, NetworkDevice, SnmpDiagnosticResult, SshDiagnosticResult } from '../src/types';

describe('PDF Installation Report Generation Engine (RF-06)', () => {
  test('PdfReportService: builds structured HTML with GPS, embedded Base64 photos, and SNMP/SSH', () => {
    const mockDevice: NetworkDevice = {
      id: 'dev_cisco_01',
      ip: '192.168.1.1',
      mac: '00:1A:2B:3C:4D:5E',
      hostname: 'Router-Cisco-Core',
      deviceType: 'Router',
      discoveryMethod: 'PingSweep',
      firstSeen: Date.now() - 3600000,
      lastSeen: Date.now(),
      isReachable: true,
    };

    const mockPhotoBase64 = EvidenceService.getSampleRackPhotoBase64();

    const mockInstallation: InstallationEvidence = {
      id: 'inst_pdf_test_001',
      deviceId: mockDevice.id,
      qrCode: 'EQUIP-RACK-03-CISCO',
      latitude: -32.482512,
      longitude: -58.237245,
      accuracy: 4.5,
      photoUris: ['file:///simulated/photo1.jpg'],
      photoBase64s: [mockPhotoBase64],
      notes: 'Gabinete exterior sellado. Enlace de fibra óptica activo en puerto G0/1.',
      technicianName: 'Ing. Lucas Nievas',
      timestamp: Date.now(),
      synced: false,
      pdfGenerated: false,
    };

    const mockSnmp: SnmpDiagnosticResult = {
      deviceId: mockDevice.id,
      ip: mockDevice.ip,
      community: '***',
      timestamp: Date.now(),
      success: true,
      sysName: 'Router-Cisco-Core',
      sysUpTime: '12d 04:15:30.00',
      ifInOctets: 45231900,
      ifOutOctets: 12890400,
      metrics: [],
      durationMs: 35,
    };

    const mockSsh: SshDiagnosticResult = {
      deviceId: mockDevice.id,
      ip: mockDevice.ip,
      port: 22,
      username: 'admin',
      timestamp: Date.now(),
      success: true,
      commandResults: [
        {
          command: 'uptime',
          output: ' 14:02:11 up 12 days, 4:15, 1 user, load average: 0.05, 0.03, 0.01',
          exitCode: 0,
          timestamp: Date.now(),
          durationMs: 85,
        },
      ],
    };

    const html = PdfReportService.buildHtmlReport({
      installation: mockInstallation,
      device: mockDevice,
      snmpDiagnostics: [mockSnmp],
      sshDiagnostics: [mockSsh],
    });

    // Validations
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Network Diagnostics Suite');
    expect(html).toContain('Router-Cisco-Core');
    expect(html).toContain('192.168.1.1');
    expect(html).toContain('-32.482512');
    expect(html).toContain('-58.237245');
    expect(html).toContain('EQUIP-RACK-03-CISCO');
    expect(html).toContain('Ing. Lucas Nievas');
    expect(html).toContain('data:image/jpeg;base64');
    expect(html).toContain('12d 04:15:30.00');
    expect(html).toContain('load average: 0.05');
  });

  test('PdfReportService: generatePdf produces valid output structure', async () => {
    const mockInstallation: InstallationEvidence = {
      id: 'inst_pdf_standalone',
      deviceId: 'dev_standalone',
      latitude: -34.6037,
      longitude: -58.3816,
      photoUris: [],
      notes: 'Relevamiento rápido',
      technicianName: 'Técnico',
      timestamp: Date.now(),
      synced: true,
      pdfGenerated: false,
    };

    const result = await PdfReportService.generatePdf({
      installation: mockInstallation,
    });

    expect(result.html.length).toBeGreaterThan(100);
    expect(result.filePath).toMatch(/\.pdf$/);
  });
});

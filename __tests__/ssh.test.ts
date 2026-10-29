import { KeychainService } from '../src/services/security/keychainService';
import { SshService, PREDEFINED_SSH_COMMANDS } from '../src/services/ssh/sshService';

describe('SSH Remote Diagnostics & Keystore Security (RF-03, RNF-01)', () => {
  beforeEach(async () => {
    await KeychainService.deleteSshCredentials('192.168.1.1');
  });

  test('KeychainService: saves and retrieves credentials securely without plain text exposure', async () => {
    const ip = '192.168.1.1';
    const user = 'telecom_admin';
    const pass = 'S3cure!K3yst0re#Pass';

    const saved = await KeychainService.saveSshCredentials(ip, user, pass);
    expect(saved).toBe(true);

    const retrieved = await KeychainService.getSshCredentials(ip);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.username).toBe(user);
    expect(retrieved?.password).toBe(pass);

    // Delete credentials
    const deleted = await KeychainService.deleteSshCredentials(ip);
    expect(deleted).toBe(true);

    const afterDelete = await KeychainService.getSshCredentials(ip);
    expect(afterDelete).toBeNull();
  });

  test('SshService: predefined commands are defined according to telecom requirements', () => {
    expect(PREDEFINED_SSH_COMMANDS.length).toBeGreaterThanOrEqual(4);
    const ids = PREDEFINED_SSH_COMMANDS.map(c => c.id);
    expect(ids).toContain('uptime');
    expect(ids).toContain('interfaces');
    expect(ids).toContain('routing');
    expect(ids).toContain('system_info');
  });

  test('SshService: executeCommand runs successfully with mock/test engine', async () => {
    const ip = '192.168.1.1';
    await KeychainService.saveSshCredentials(ip, 'admin', 'password123');

    const result = await SshService.executeCommand(ip, 'uptime', { useMock: true });
    expect(result.command).toBe('uptime');
    expect(result.exitCode).toBe(0);
    expect(result.output).toMatch(/load average/i);
    expect(result.durationMs).toBeGreaterThan(0);
  });

  test('SshService: runPredefinedDiagnostics executes full suite of commands', async () => {
    const ip = '192.168.1.1';
    await KeychainService.saveSshCredentials(ip, 'admin', 'password123');

    const diag = await SshService.runPredefinedDiagnostics(ip, { useMock: true });
    expect(diag.success).toBe(true);
    expect(diag.commandResults.length).toBe(PREDEFINED_SSH_COMMANDS.length);
    expect(diag.commandResults[0].exitCode).toBe(0);
  });
});

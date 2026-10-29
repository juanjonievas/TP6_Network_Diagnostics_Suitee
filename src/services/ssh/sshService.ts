import { SshCommandResult, SshDiagnosticResult } from '../../types';
import { KeychainService } from '../security/keychainService';

export interface PredefinedSshCommand {
  id: string;
  name: string;
  command: string;
  description: string;
}

export const PREDEFINED_SSH_COMMANDS: PredefinedSshCommand[] = [
  {
    id: 'uptime',
    name: 'Uptime & Carga del Sistema',
    command: 'uptime',
    description: 'Muestra el tiempo encendido, usuarios y carga promedio del equipo',
  },
  {
    id: 'interfaces',
    name: 'Estado de Interfaces de Red',
    command: 'ip -brief addr show || ifconfig',
    description: 'Lista las interfaces activas, direcciones IP asignadas y máscaras',
  },
  {
    id: 'routing',
    name: 'Tabla de Enrutamiento IP',
    command: 'ip route show || netstat -rn',
    description: 'Muestra la puerta de enlace predeterminada y rutas locales del nodo',
  },
  {
    id: 'system_info',
    name: 'Información del Kernel / OS',
    command: 'uname -a',
    description: 'Versión del sistema operativo, arquitectura de procesador y hostname',
  },
];

export class SshService {
  /**
   * Executes a diagnostic command over SSH
   */
  static async executeCommand(
    ip: string,
    command: string,
    options: {
      port?: number;
      username?: string;
      password?: string;
      timeoutMs?: number;
      useMock?: boolean;
    } = {}
  ): Promise<SshCommandResult> {
    const port = options.port || 22;
    const timeoutMs = options.timeoutMs || 8000;
    const startTime = Date.now();

    // 1. Resolve credentials securely if not passed directly
    let username = options.username;
    let password = options.password;

    if (!username || !password) {
      const stored = await KeychainService.getSshCredentials(ip);
      if (stored) {
        username = stored.username;
        password = stored.password;
      }
    }

    if (!username || !password) {
      throw new Error(`Credenciales SSH no encontradas en Android Keystore para ${ip}`);
    }

    // 2. Headless / Mock fallback for automated tests or when useMock is true
    if (options.useMock || process.env.NODE_ENV === 'test') {
      const durationMs = 120;
      let mockOutput = '';

      if (command.includes('uptime')) {
        mockOutput = ' 13:45:02 up 14 days, 3:22, 1 user, load average: 0.12, 0.08, 0.05';
      } else if (command.includes('ip -brief') || command.includes('ifconfig')) {
        mockOutput = `eth0             UP             192.168.1.1/24 fe80::1/64\neth1             DOWN\nwlan0            UP             192.168.10.1/24`;
      } else if (command.includes('route')) {
        mockOutput = `default via 192.168.0.1 dev eth0 proto dhcp metric 100\n192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.1`;
      } else if (command.includes('uname')) {
        mockOutput = 'Linux switch-core-01 5.10.0-8-amd64 #1 SMP Debian 5.10.46-4 x86_64 GNU/Linux';
      } else {
        mockOutput = `[SSH Output for command: ${command}]\nStatus: OK`;
      }

      return {
        command,
        output: mockOutput,
        exitCode: 0,
        timestamp: Date.now(),
        durationMs,
      };
    }

    // 3. Real execution on Android via react-native-ssh-sftp
    return new Promise((resolve, reject) => {
      let SSH: any;
      try {
        SSH = require('react-native-ssh-sftp').default || require('react-native-ssh-sftp');
      } catch (err: any) {
        return reject(new Error('react-native-ssh-sftp no disponible en este entorno: ' + err.message));
      }

      let timer: any = null;
      let client: any = null;
      let settled = false;

      const finish = (result: SshCommandResult | null, error: Error | null) => {
        if (!settled) {
          settled = true;
          if (timer) clearTimeout(timer);
          if (client) {
            try {
              client.disconnect();
            } catch (_) {}
          }
          if (error) reject(error);
          else resolve(result!);
        }
      };

      timer = setTimeout(() => {
        finish(null, new Error(`Timeout de conexión SSH (${timeoutMs} ms) hacia ${ip}:${port}`));
      }, timeoutMs);

      try {
        client = new SSH(ip, port, username, password, (connErr: any) => {
          if (connErr) {
            return finish(null, new Error(`Error de autenticación/conexión SSH con ${ip}: ${connErr}`));
          }

          client.execute(command, (execErr: any, output: string) => {
            const durationMs = Date.now() - startTime;
            if (execErr) {
              return finish(null, new Error(`Error al ejecutar comando '${command}': ${execErr}`));
            }

            finish(
              {
                command,
                output: output || '(Sin salida)',
                exitCode: 0,
                timestamp: Date.now(),
                durationMs,
              },
              null
            );
          });
        });
      } catch (e: any) {
        finish(null, new Error(`Error interno SSH: ${e.message}`));
      }
    });
  }

  /**
   * Runs the full suite of predefined diagnostic commands on target host
   */
  static async runPredefinedDiagnostics(
    ip: string,
    options: {
      port?: number;
      username?: string;
      password?: string;
      useMock?: boolean;
    } = {}
  ): Promise<SshDiagnosticResult> {
    const results: SshCommandResult[] = [];
    let overallSuccess = true;
    let errorMessage: string | undefined;

    for (const item of PREDEFINED_SSH_COMMANDS) {
      try {
        const cmdRes = await this.executeCommand(ip, item.command, options);
        results.push(cmdRes);
      } catch (err: any) {
        overallSuccess = false;
        errorMessage = err.message;
        results.push({
          command: item.command,
          output: `ERROR: ${err.message}`,
          exitCode: 1,
          timestamp: Date.now(),
          durationMs: 0,
          error: err.message,
        });
      }
    }

    return {
      deviceId: ip,
      ip,
      port: options.port || 22,
      username: options.username || 'admin',
      timestamp: Date.now(),
      success: overallSuccess,
      commandResults: results,
      error: errorMessage,
    };
  }
}

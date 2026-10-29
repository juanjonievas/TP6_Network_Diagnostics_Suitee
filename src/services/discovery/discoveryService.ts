import { NetworkDevice, DeviceType } from '../../types';
import { SubnetUtils } from './subnetUtils';

export interface ScanProgress {
  scanned: number;
  total: number;
  percentage: number;
  activeCount: number;
  currentIp: string;
}

export class DiscoveryService {
  private static isScanning = false;
  private static cancelRequested = false;
  private static zeroconfInstance: any = null;

  static isScanRunning(): boolean {
    return this.isScanning;
  }

  static stopScan(): void {
    this.cancelRequested = true;
    if (this.zeroconfInstance) {
      try {
        this.zeroconfInstance.stop();
        this.zeroconfInstance.removeDeviceListeners();
      } catch (_) {}
      this.zeroconfInstance = null;
    }
    this.isScanning = false;
  }

  /**
   * Performs an active probe on a single IP address using TCP socket probe
   */
  static async probeHost(ip: string, ports = [80, 443, 22, 53], timeoutMs = 400): Promise<{ reachable: boolean; openPort?: number }> {
    let TcpSocket: any = null;
    try {
      TcpSocket = require('react-native-tcp-socket');
    } catch (_) {
      // Node.js fallback for headless tests
      try {
        TcpSocket = require('net');
      } catch (_) {}
    }

    if (!TcpSocket) {
      // If neither is available, return false
      return { reachable: false };
    }

    for (const port of ports) {
      const isOpen = await new Promise<boolean>((resolve) => {
        let isDone = false;
        let socket: any = null;
        let timer: any = null;

        const done = (result: boolean) => {
          if (!isDone) {
            isDone = true;
            if (timer) clearTimeout(timer);
            if (socket) {
              try {
                socket.destroy();
              } catch (_) {}
            }
            resolve(result);
          }
        };

        timer = setTimeout(() => done(false), timeoutMs);

        try {
          if (TcpSocket.createConnection) {
            socket = TcpSocket.createConnection({ host: ip, port, timeout: timeoutMs }, () => {
              done(true);
            });
          } else if (TcpSocket.connect) {
            socket = TcpSocket.connect(port, ip, () => {
              done(true);
            });
          } else {
            done(false);
            return;
          }

          socket.on('error', () => done(false));
          socket.on('timeout', () => done(false));
        } catch (_) {
          done(false);
        }
      });

      if (isOpen) {
        return { reachable: true, openPort: port };
      }
    }

    return { reachable: false };
  }

  /**
   * Scans a subnet CIDR range with concurrency control and progress callbacks
   */
  static async scanSubnet(
    baseIp: string,
    netmask = '255.255.255.0',
    onProgress?: (progress: ScanProgress) => void,
    onDeviceFound?: (device: NetworkDevice) => void
  ): Promise<NetworkDevice[]> {
    if (this.isScanning) {
      throw new Error('Ya hay un escaneo de red en ejecución');
    }

    this.isScanning = true;
    this.cancelRequested = false;

    const subnet = SubnetUtils.calculateSubnet(baseIp, netmask);
    const discoveredDevices: Map<string, NetworkDevice> = new Map();
    const totalHosts = subnet.ipList.length;
    let scannedCount = 0;

    // Concurrency batch size
    const BATCH_SIZE = 16;

    try {
      for (let i = 0; i < totalHosts; i += BATCH_SIZE) {
        if (this.cancelRequested) break;

        const batch = subnet.ipList.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (ip) => {
            if (this.cancelRequested) return;

            const probeResult = await this.probeHost(ip);
            scannedCount++;

            if (probeResult.reachable) {
              const isGateway = ip.endsWith('.1');
              const inferredType: DeviceType = isGateway ? 'Router' : SubnetUtils.inferDeviceType(undefined, probeResult.openPort ? [probeResult.openPort] : undefined);

              const device: NetworkDevice = {
                id: `dev_${ip.replace(/\./g, '_')}`,
                ip,
                mac: 'No disponible (Políticas SELinux Android 10+)',
                hostname: isGateway ? 'Gateway / Router Principal' : `Host-${ip}`,
                deviceType: inferredType,
                discoveryMethod: 'PingSweep',
                firstSeen: Date.now(),
                lastSeen: Date.now(),
                isReachable: true,
              };

              discoveredDevices.set(ip, device);
              if (onDeviceFound) {
                onDeviceFound(device);
              }
            }

            if (onProgress) {
              onProgress({
                scanned: scannedCount,
                total: totalHosts,
                percentage: Math.round((scannedCount / totalHosts) * 100),
                activeCount: discoveredDevices.size,
                currentIp: ip,
              });
            }
          })
        );
      }
    } finally {
      this.isScanning = false;
    }

    return Array.from(discoveredDevices.values());
  }

  /**
   * Starts mDNS/Bonjour discovery using react-native-zeroconf
   */
  static startMdnsDiscovery(onDeviceFound: (device: NetworkDevice) => void): void {
    try {
      const Zeroconf = require('react-native-zeroconf').default || require('react-native-zeroconf');
      this.zeroconfInstance = new Zeroconf();

      this.zeroconfInstance.on('resolved', (service: any) => {
        if (service.addresses && service.addresses.length > 0) {
          const ip = service.addresses[0];
          const hostname = service.host || service.name || 'mDNS Node';
          const type: DeviceType = SubnetUtils.inferDeviceType(hostname);

          const device: NetworkDevice = {
            id: `dev_${ip.replace(/\./g, '_')}`,
            ip,
            mac: 'No disponible (mDNS multicast)',
            hostname,
            deviceType: type,
            discoveryMethod: 'mDNS',
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            isReachable: true,
          };
          onDeviceFound(device);
        }
      });

      this.zeroconfInstance.on('error', (err: any) => {
        console.warn('[DiscoveryService mDNS Error]', err);
      });

      this.zeroconfInstance.scan('http', 'tcp', 'local.');
      setTimeout(() => {
        if (this.zeroconfInstance) {
          try {
            this.zeroconfInstance.scan('workstation', 'tcp', 'local.');
          } catch (_) {}
        }
      }, 3000);
    } catch (e: any) {
      console.warn('[DiscoveryService] Zeroconf no disponible en este entorno:', e.message);
    }
  }
}

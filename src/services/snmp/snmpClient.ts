import { Buffer } from 'buffer';
import { BerParser, DecodedSnmpResponse } from './berParser';
import { SNMP_OIDS, DEFAULT_TELEMETRY_OIDS } from './snmpOids';
import { SnmpDiagnosticResult, SnmpMetric } from '../../types';

export interface SnmpClientOptions {
  port?: number;
  community?: string;
  timeoutMs?: number;
  retries?: number;
}

export class SnmpClient {
  private static nextRequestId = 1000;

  private static getNextRequestId(): number {
    this.nextRequestId = (this.nextRequestId + 1) % 65535;
    return this.nextRequestId || 1;
  }

  /**
   * Executes an SNMP GetRequest for specified OIDs over UDP/161
   */
  static async get(
    ip: string,
    oids: string[] = DEFAULT_TELEMETRY_OIDS,
    options: SnmpClientOptions = {}
  ): Promise<SnmpDiagnosticResult> {
    const port = options.port || 161;
    const community = options.community || 'public';
    const timeoutMs = options.timeoutMs || 2500;
    const requestId = this.getNextRequestId();
    const startTime = Date.now();

    const requestPacket = BerParser.buildGetRequestPacket(requestId, community, oids);

    let decodedResponse: DecodedSnmpResponse | null = null;
    let socketError: string | null = null;

    try {
      const responseBuffer = await this.sendUdpDatagram(ip, port, requestPacket, timeoutMs);
      decodedResponse = BerParser.decodeSnmpMessage(responseBuffer);
    } catch (err: any) {
      socketError = err.message || 'Error de socket UDP o timeout SNMP';
    }

    const durationMs = Date.now() - startTime;

    if (!decodedResponse) {
      return {
        deviceId: ip,
        ip,
        community: '***', // Never log or expose community string
        timestamp: Date.now(),
        success: false,
        metrics: [],
        error: socketError || 'Sin respuesta del agente SNMP (Timeout)',
        durationMs,
      };
    }

    if (decodedResponse.errorStatus !== 0) {
      return {
        deviceId: ip,
        ip,
        community: '***',
        timestamp: Date.now(),
        success: false,
        metrics: [],
        error: `Error reportado por el dispositivo: ${decodedResponse.errorStatusText}`,
        durationMs,
      };
    }

    // Map varbinds to metrics and top-level fields
    const metrics: SnmpMetric[] = [];
    let sysName: string | undefined;
    let sysUpTime: string | undefined;
    let sysDescr: string | undefined;
    let ifInOctets: number | undefined;
    let ifOutOctets: number | undefined;

    for (const vb of decodedResponse.varBinds) {
      let metricName = vb.oid;
      let unit: string | undefined;

      if (vb.oid === SNMP_OIDS.sysName.oid) {
        metricName = 'sysName';
        sysName = String(vb.value);
      } else if (vb.oid === SNMP_OIDS.sysUpTime.oid) {
        metricName = 'sysUpTime';
        sysUpTime = BerParser.formatTimeTicks(Number(vb.value));
        unit = 'centésimas de seg';
      } else if (vb.oid === SNMP_OIDS.sysDescr.oid) {
        metricName = 'sysDescr';
        sysDescr = String(vb.value);
      } else if (vb.oid === SNMP_OIDS.ifInOctets1.oid) {
        metricName = 'ifInOctets.1';
        ifInOctets = Number(vb.value);
        unit = 'bytes';
      } else if (vb.oid === SNMP_OIDS.ifOutOctets1.oid) {
        metricName = 'ifOutOctets.1';
        ifOutOctets = Number(vb.value);
        unit = 'bytes';
      }

      metrics.push({
        oid: vb.oid,
        name: metricName,
        value: vb.value,
        type: vb.typeName,
        unit,
      });
    }

    return {
      deviceId: ip,
      ip,
      community: '***',
      timestamp: Date.now(),
      success: true,
      sysName,
      sysUpTime,
      sysDescr,
      ifInOctets,
      ifOutOctets,
      metrics,
      durationMs,
    };
  }

  /**
   * Internal transport adapter: uses react-native-udp on mobile, or dgram on Node/Jest
   */
  private static sendUdpDatagram(
    ip: string,
    port: number,
    packet: Buffer,
    timeoutMs: number
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      let isSettled = false;
      let socket: any = null;
      let timer: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (socket) {
          try {
            socket.close();
          } catch (_) {}
          socket = null;
        }
      };

      timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          cleanup();
          reject(new Error(`Timeout de consulta SNMP (${timeoutMs} ms) a ${ip}:${port}`));
        }
      }, timeoutMs);

      // Check environment: Node.js / Jest (dgram) vs React Native (react-native-udp)
      try {
        let createSocket: any;
        if (process.env.NODE_ENV === 'test' || typeof (global as any).nativeCallSyncHook === 'undefined') {
          const dgram = require('dgram');
          createSocket = (opts: any) => dgram.createSocket(opts.type || 'udp4');
        } else {
          try {
            const RNUdp = require('react-native-udp');
            createSocket = RNUdp.createSocket || (RNUdp.default && RNUdp.default.createSocket);
          } catch (_) {
            const dgram = require('dgram');
            createSocket = (opts: any) => dgram.createSocket(opts.type || 'udp4');
          }
        }

        socket = createSocket({ type: 'udp4' });

        socket.on('error', (err: any) => {
          if (!isSettled) {
            isSettled = true;
            cleanup();
            reject(new Error(`Error de socket UDP: ${err.message || err}`));
          }
        });

        socket.on('message', (msg: any) => {
          if (!isSettled) {
            isSettled = true;
            cleanup();
            const buf = Buffer.isBuffer(msg) ? msg : Buffer.from(msg);
            resolve(buf);
          }
        });

        socket.bind(0, () => {
          socket.send(packet, 0, packet.length, port, ip, (err: any) => {
            if (err && !isSettled) {
              isSettled = true;
              cleanup();
              reject(new Error(`Error al enviar datagrama UDP a ${ip}:${port} - ${err.message || err}`));
            }
          });
        });
      } catch (e: any) {
        if (!isSettled) {
          isSettled = true;
          cleanup();
          reject(new Error(`Error inicializando socket: ${e.message}`));
        }
      }
    });
  }
}

// Subnet and IP calculation utilities for LAN discovery

export interface SubnetInfo {
  networkAddress: string;
  broadcastAddress: string;
  firstHost: string;
  lastHost: string;
  totalHosts: number;
  ipList: string[];
}

export class SubnetUtils {
  static ipToInt(ip: string): number {
    return ip
      .split('.')
      .reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
  }

  static intToIp(intVal: number): string {
    return [
      (intVal >>> 24) & 255,
      (intVal >>> 16) & 255,
      (intVal >>> 8) & 255,
      intVal & 255,
    ].join('.');
  }

  /**
   * Generates the list of usable host IPs for a given IP and Subnet Mask
   */
  static calculateSubnet(ip: string, netmask = '255.255.255.0'): SubnetInfo {
    const ipInt = this.ipToInt(ip);
    const maskInt = this.ipToInt(netmask);

    const networkInt = (ipInt & maskInt) >>> 0;
    const invertedMask = (~maskInt) >>> 0;
    const broadcastInt = (networkInt | invertedMask) >>> 0;

    const firstHostInt = networkInt + 1;
    const lastHostInt = broadcastInt - 1;
    const totalHosts = Math.max(0, lastHostInt - firstHostInt + 1);

    const ipList: string[] = [];
    for (let current = firstHostInt; current <= lastHostInt; current++) {
      ipList.push(this.intToIp(current));
    }

    return {
      networkAddress: this.intToIp(networkInt),
      broadcastAddress: this.intToIp(broadcastInt),
      firstHost: this.intToIp(firstHostInt),
      lastHost: this.intToIp(lastHostInt),
      totalHosts,
      ipList,
    };
  }

  /**
   * Detects the probable gateway IP for a subnet (typically .1)
   */
  static getLikelyGateway(ip: string): string {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.1`;
    }
    return '192.168.1.1';
  }

  /**
   * Infers device type based on open ports, hostname, or vendor
   */
  static inferDeviceType(hostname?: string, openPorts?: number[]): 'ONT' | 'Router' | 'Switch' | 'Antenna' | 'Unknown' {
    const name = (hostname || '').toLowerCase();
    if (name.includes('ont') || name.includes('fiber') || name.includes('zte') || name.includes('huawei')) {
      return 'ONT';
    }
    if (name.includes('switch') || name.includes('cisco') || name.includes('catalyst')) {
      return 'Switch';
    }
    if (name.includes('antenna') || name.includes('ubnt') || name.includes('mikrotik') || name.includes('airmax')) {
      return 'Antenna';
    }
    if (name.includes('router') || name.includes('gateway') || (openPorts && openPorts.includes(53))) {
      return 'Router';
    }
    return 'Unknown';
  }
}

import { SubnetUtils } from '../src/services/discovery/subnetUtils';

describe('LAN Subnet and Discovery Utilities (RF-01)', () => {
  test('SubnetUtils: ipToInt and intToIp conversions', () => {
    const ip = '192.168.1.1';
    const num = SubnetUtils.ipToInt(ip);
    expect(num).toBe(3232235777);
    expect(SubnetUtils.intToIp(num)).toBe(ip);
  });

  test('SubnetUtils: calculateSubnet computes /24 subnet correctly', () => {
    const result = SubnetUtils.calculateSubnet('192.168.1.50', '255.255.255.0');
    expect(result.networkAddress).toBe('192.168.1.0');
    expect(result.broadcastAddress).toBe('192.168.1.255');
    expect(result.firstHost).toBe('192.168.1.1');
    expect(result.lastHost).toBe('192.168.1.254');
    expect(result.totalHosts).toBe(254);
    expect(result.ipList.length).toBe(254);
    expect(result.ipList[0]).toBe('192.168.1.1');
    expect(result.ipList[253]).toBe('192.168.1.254');
  });

  test('SubnetUtils: calculateSubnet computes small /30 subnet', () => {
    const result = SubnetUtils.calculateSubnet('10.0.0.1', '255.255.255.252');
    expect(result.networkAddress).toBe('10.0.0.0');
    expect(result.broadcastAddress).toBe('10.0.0.3');
    expect(result.firstHost).toBe('10.0.0.1');
    expect(result.lastHost).toBe('10.0.0.2');
    expect(result.totalHosts).toBe(2);
    expect(result.ipList).toEqual(['10.0.0.1', '10.0.0.2']);
  });

  test('SubnetUtils: getLikelyGateway returns .1 host of the subnet', () => {
    expect(SubnetUtils.getLikelyGateway('192.168.10.45')).toBe('192.168.10.1');
    expect(SubnetUtils.getLikelyGateway('10.20.30.40')).toBe('10.20.30.1');
  });

  test('SubnetUtils: inferDeviceType classifies network nodes correctly', () => {
    expect(SubnetUtils.inferDeviceType('zte-fiber-ont-gpon')).toBe('ONT');
    expect(SubnetUtils.inferDeviceType('cisco-catalyst-2960-switch')).toBe('Switch');
    expect(SubnetUtils.inferDeviceType('ubnt-airmax-antenna-01')).toBe('Antenna');
    expect(SubnetUtils.inferDeviceType('home-gateway-wifi', [53])).toBe('Router');
    expect(SubnetUtils.inferDeviceType('unknown-pc')).toBe('Unknown');
  });
});

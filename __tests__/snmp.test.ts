import { Buffer } from 'buffer';
import dgram from 'dgram';
import { BerParser, Asn1Type } from '../src/services/snmp/berParser';
import { SnmpClient } from '../src/services/snmp/snmpClient';
import { SNMP_OIDS } from '../src/services/snmp/snmpOids';

describe('SNMP ASN.1 / BER Encoding and Decoding Engine (RF-02)', () => {
  test('BerParser: encodeLength and readLength for short and long forms', () => {
    // Short form (< 128)
    const bufShort = BerParser.encodeLength(42);
    expect(bufShort).toEqual(Buffer.from([42]));
    const readShort = BerParser.readLength(bufShort, 0);
    expect(readShort.length).toBe(42);
    expect(readShort.bytesRead).toBe(1);

    // Long form (>= 128)
    const bufLong = BerParser.encodeLength(500);
    // 500 = 0x01F4 -> 2 bytes -> header 0x82, 0x01, 0xF4
    expect(bufLong).toEqual(Buffer.from([0x82, 0x01, 0xf4]));
    const readLong = BerParser.readLength(bufLong, 0);
    expect(readLong.length).toBe(500);
    expect(readLong.bytesRead).toBe(3);
  });

  test('BerParser: encodeInteger handles positive, zero, and MSB sign bit', () => {
    const zeroBuf = BerParser.encodeInteger(0);
    expect(zeroBuf).toEqual(Buffer.from([0x02, 0x01, 0x00]));

    const valBuf = BerParser.encodeInteger(100);
    expect(valBuf).toEqual(Buffer.from([0x02, 0x01, 100]));

    // Number with MSB set (e.g. 130 = 0x82) must have leading 0x00 to remain positive
    const msbBuf = BerParser.encodeInteger(130);
    expect(msbBuf).toEqual(Buffer.from([0x02, 0x02, 0x00, 0x82]));
  });

  test('BerParser: encodeOid and decodeOid roundtrip for MIB-II OIDs', () => {
    const testOids = [
      '1.3.6.1.2.1.1.1.0', // sysDescr
      '1.3.6.1.2.1.1.3.0', // sysUpTime
      '1.3.6.1.2.1.1.5.0', // sysName
      '1.3.6.1.2.1.2.2.1.10.1', // ifInOctets.1
    ];

    for (const oid of testOids) {
      const encoded = BerParser.encodeOid(oid);
      expect(encoded[0]).toBe(Asn1Type.OBJECT_IDENTIFIER);
      const len = encoded[1];
      const decoded = BerParser.decodeOid(encoded, 2, len);
      expect(decoded).toBe(oid);
    }
  });

  test('BerParser: buildGetRequestPacket produces valid SNMPv2c message', () => {
    const reqId = 12345;
    const community = 'public';
    const oids = [SNMP_OIDS.sysName.oid, SNMP_OIDS.sysUpTime.oid];

    const packet = BerParser.buildGetRequestPacket(reqId, community, oids);
    expect(packet[0]).toBe(Asn1Type.SEQUENCE);

    // Root sequence length
    const rootLen = BerParser.readLength(packet, 1);
    expect(packet.length).toBe(1 + rootLen.bytesRead + rootLen.length);

    // Verify community string appears inside the packet
    expect(packet.includes(Buffer.from('public'))).toBe(true);
  });

  test('BerParser: decodeSnmpMessage decodes GetResponse with all data types', () => {
    // Construct a synthetic GetResponse packet containing sysName (OctetString) and sysUpTime (TimeTicks)
    const reqIdBuf = BerParser.encodeInteger(999);
    const errStatusBuf = BerParser.encodeInteger(0);
    const errIndexBuf = BerParser.encodeInteger(0);

    // VarBind 1: sysName = "Switch-Core-Rack-3"
    const vb1Oid = BerParser.encodeOid(SNMP_OIDS.sysName.oid);
    const vb1Val = BerParser.encodeOctetString('Switch-Core-Rack-3');
    const vb1 = BerParser.encodeSequence(Asn1Type.SEQUENCE, [vb1Oid, vb1Val]);

    // VarBind 2: sysUpTime = 360000 centiseconds (1 hour)
    const vb2Oid = BerParser.encodeOid(SNMP_OIDS.sysUpTime.oid);
    // TimeTicks tag is 0x43
    const ticksVal = Buffer.from([0x43, 0x03, 0x05, 0x7e, 0x40]); // 360000 = 0x057E40
    const vb2 = BerParser.encodeSequence(Asn1Type.SEQUENCE, [vb2Oid, ticksVal]);

    // VarBind 3: ifInOctets.1 = 1500000 bytes (Counter32 = 0x41)
    const vb3Oid = BerParser.encodeOid(SNMP_OIDS.ifInOctets1.oid);
    const c32Val = Buffer.from([0x41, 0x03, 0x16, 0xe3, 0x60]); // 1500000 = 0x16E360
    const vb3 = BerParser.encodeSequence(Asn1Type.SEQUENCE, [vb3Oid, c32Val]);

    const varbindList = BerParser.encodeSequence(Asn1Type.SEQUENCE, [vb1, vb2, vb3]);
    const pduPayload = Buffer.concat([reqIdBuf, errStatusBuf, errIndexBuf, varbindList]);
    const pdu = BerParser.encodeSequence(Asn1Type.GET_RESPONSE_PDU, [pduPayload]);

    const versionBuf = BerParser.encodeInteger(1);
    const communityBuf = BerParser.encodeOctetString('public');
    const fullMessage = BerParser.encodeSequence(Asn1Type.SEQUENCE, [versionBuf, communityBuf, pdu]);

    // Decode message
    const decoded = BerParser.decodeSnmpMessage(fullMessage);
    expect(decoded.version).toBe(1);
    expect(decoded.community).toBe('public');
    expect(decoded.requestId).toBe(999);
    expect(decoded.errorStatus).toBe(0);
    expect(decoded.varBinds.length).toBe(3);

    // Verify VarBind 1 (sysName)
    expect(decoded.varBinds[0].oid).toBe(SNMP_OIDS.sysName.oid);
    expect(decoded.varBinds[0].value).toBe('Switch-Core-Rack-3');

    // Verify VarBind 2 (sysUpTime)
    expect(decoded.varBinds[1].oid).toBe(SNMP_OIDS.sysUpTime.oid);
    expect(decoded.varBinds[1].typeName).toBe('TIMETICKS');
    expect(decoded.varBinds[1].value).toBe(360000);

    // Verify VarBind 3 (Counter32)
    expect(decoded.varBinds[2].oid).toBe(SNMP_OIDS.ifInOctets1.oid);
    expect(decoded.varBinds[2].typeName).toBe('COUNTER32');
    expect(decoded.varBinds[2].value).toBe(1500000);
  });

  test('BerParser: formatTimeTicks converts centiseconds to days/hours/minutes', () => {
    // 9006100 centiseconds = 90061 seconds = 1 day, 1 hour, 1 minute, 1 second
    const formatted = BerParser.formatTimeTicks(9006100);
    expect(formatted).toBe('1d 01:01:01.00');
  });

  test('SnmpClient: queries live mock UDP SNMP server successfully', async () => {
    // Spin up an in-memory UDP SNMP agent server
    const server = dgram.createSocket('udp4');
    let serverPort = 0;

    await new Promise<void>((resolve) => {
      server.bind(0, '127.0.0.1', () => {
        const address = server.address();
        serverPort = typeof address === 'string' ? 0 : address.port;
        resolve();
      });
    });

    server.on('message', (msg, rinfo) => {
      // Decode the incoming GetRequest
      const req = BerParser.decodeSnmpMessage(msg);
      
      // Build a GetResponse responding to the request ID
      const reqIdBuf = BerParser.encodeInteger(req.requestId);
      const errStatusBuf = BerParser.encodeInteger(0);
      const errIndexBuf = BerParser.encodeInteger(0);

      const vb1 = BerParser.encodeSequence(Asn1Type.SEQUENCE, [
        BerParser.encodeOid(SNMP_OIDS.sysName.oid),
        BerParser.encodeOctetString('Mock-Router-Cisco'),
      ]);
      const vbList = BerParser.encodeSequence(Asn1Type.SEQUENCE, [vb1]);
      const pdu = BerParser.encodeSequence(Asn1Type.GET_RESPONSE_PDU, [
        Buffer.concat([reqIdBuf, errStatusBuf, errIndexBuf, vbList]),
      ]);

      const respMsg = BerParser.encodeSequence(Asn1Type.SEQUENCE, [
        BerParser.encodeInteger(1),
        BerParser.encodeOctetString(req.community),
        pdu,
      ]);

      server.send(respMsg, rinfo.port, rinfo.address);
    });

    // Run query using SnmpClient
    const result = await SnmpClient.get('127.0.0.1', [SNMP_OIDS.sysName.oid], {
      port: serverPort,
      community: 'public',
      timeoutMs: 1500,
    });

    expect(result.success).toBe(true);
    expect(result.sysName).toBe('Mock-Router-Cisco');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    // Close mock UDP server
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test('SnmpClient: handles timeout gracefully when host does not answer', async () => {
    // Send to a port with no listener and short timeout
    const result = await SnmpClient.get('127.0.0.1', [SNMP_OIDS.sysName.oid], {
      port: 19876,
      timeoutMs: 200,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Timeout/i);
    expect(result.metrics.length).toBe(0);
  });
});

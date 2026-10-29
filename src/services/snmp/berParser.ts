import { Buffer } from 'buffer';

export enum Asn1Type {
  INTEGER = 0x02,
  OCTET_STRING = 0x04,
  NULL = 0x05,
  OBJECT_IDENTIFIER = 0x06,
  SEQUENCE = 0x30,
  IP_ADDRESS = 0x40,     // Application 0
  COUNTER32 = 0x41,      // Application 1
  GAUGE32 = 0x42,        // Application 2
  TIMETICKS = 0x43,      // Application 3
  OPAQUE = 0x44,         // Application 4
  COUNTER64 = 0x46,      // Application 6
  GET_REQUEST_PDU = 0xa0,
  GET_RESPONSE_PDU = 0xa2,
  NO_SUCH_OBJECT = 0x80,
  NO_SUCH_INSTANCE = 0x81,
  END_OF_MIB_VIEW = 0x82,
}

export interface SnmpVarBind {
  oid: string;
  type: Asn1Type;
  typeName: string;
  value: any;
  rawBytes?: Buffer;
}

export interface DecodedSnmpResponse {
  version: number;
  community: string;
  pduType: number;
  requestId: number;
  errorStatus: number;
  errorStatusText: string;
  errorIndex: number;
  varBinds: SnmpVarBind[];
}

export class BerParser {
  // ---- ENCODING ----

  static encodeLength(len: number): Buffer {
    if (len < 128) {
      return Buffer.from([len]);
    }
    const bytes: number[] = [];
    let l = len;
    while (l > 0) {
      bytes.unshift(l & 0xff);
      l >>= 8;
    }
    return Buffer.from([0x80 | bytes.length, ...bytes]);
  }

  static encodeInteger(value: number): Buffer {
    let bytes: number[] = [];
    if (value === 0) {
      bytes = [0];
    } else {
      let v = value;
      while (v > 0) {
        bytes.unshift(v & 0xff);
        v >>= 8;
      }
      if (bytes[0] & 0x80) {
        bytes.unshift(0); // Ensure positive sign bit for unsigned SNMP ints
      }
    }
    const lenBuf = this.encodeLength(bytes.length);
    return Buffer.concat([Buffer.from([Asn1Type.INTEGER]), lenBuf, Buffer.from(bytes)]);
  }

  static encodeOctetString(str: string): Buffer {
    const payload = Buffer.from(str, 'utf8');
    const lenBuf = this.encodeLength(payload.length);
    return Buffer.concat([Buffer.from([Asn1Type.OCTET_STRING]), lenBuf, payload]);
  }

  static encodeNull(): Buffer {
    return Buffer.from([Asn1Type.NULL, 0x00]);
  }

  static parseOidString(oidStr: string): number[] {
    return oidStr
      .replace(/^\./, '')
      .split('.')
      .map(part => parseInt(part, 10))
      .filter(n => !isNaN(n));
  }

  static encodeOid(oidStrOrArray: string | number[]): Buffer {
    const oid = typeof oidStrOrArray === 'string' 
      ? this.parseOidString(oidStrOrArray) 
      : oidStrOrArray;

    if (oid.length < 2) {
      throw new Error(`Invalid OID: must contain at least 2 components: ${oidStrOrArray}`);
    }

    const bytes: number[] = [];
    // First octet is (X * 40) + Y
    bytes.push(oid[0] * 40 + oid[1]);

    for (let i = 2; i < oid.length; i++) {
      let val = oid[i];
      if (val < 128) {
        bytes.push(val);
      } else {
        const subBytes: number[] = [];
        subBytes.push(val & 0x7f);
        val >>= 7;
        while (val > 0) {
          subBytes.unshift((val & 0x7f) | 0x80);
          val >>= 7;
        }
        bytes.push(...subBytes);
      }
    }

    const payload = Buffer.from(bytes);
    const lenBuf = this.encodeLength(payload.length);
    return Buffer.concat([Buffer.from([Asn1Type.OBJECT_IDENTIFIER]), lenBuf, payload]);
  }

  static encodeSequence(tag: number, buffers: Buffer[]): Buffer {
    const payload = Buffer.concat(buffers);
    const lenBuf = this.encodeLength(payload.length);
    return Buffer.concat([Buffer.from([tag]), lenBuf, payload]);
  }

  /**
   * Builds an SNMPv2c GetRequest PDU packet
   */
  static buildGetRequestPacket(requestId: number, community: string, oids: string[]): Buffer {
    const varbindBuffers = oids.map(oid => {
      const oidBuf = this.encodeOid(oid);
      const nullBuf = this.encodeNull();
      return this.encodeSequence(Asn1Type.SEQUENCE, [oidBuf, nullBuf]);
    });

    const varbindList = this.encodeSequence(Asn1Type.SEQUENCE, varbindBuffers);

    const pduPayload = Buffer.concat([
      this.encodeInteger(requestId),
      this.encodeInteger(0), // error-status (0 = noError)
      this.encodeInteger(0), // error-index (0)
      varbindList,
    ]);

    const pdu = this.encodeSequence(Asn1Type.GET_REQUEST_PDU, [pduPayload]);

    // SNMPv2c message wrapper: Sequence { version (1 for v2c), community, PDU }
    const versionBuf = this.encodeInteger(1); // 1 = SNMPv2c (RFC 1901)
    const communityBuf = this.encodeOctetString(community);

    return this.encodeSequence(Asn1Type.SEQUENCE, [versionBuf, communityBuf, pdu]);
  }

  // ---- DECODING ----

  static readLength(buf: Buffer, offset: number): { length: number; bytesRead: number } {
    if (offset >= buf.length) {
      throw new Error(`Buffer underrun reading length at offset ${offset}`);
    }
    const initial = buf[offset];
    if ((initial & 0x80) === 0) {
      return { length: initial, bytesRead: 1 };
    }
    const numOctets = initial & 0x7f;
    if (numOctets === 0) {
      throw new Error('Indefinite length encoding is not supported for SNMP');
    }
    if (offset + 1 + numOctets > buf.length) {
      throw new Error(`Buffer underrun reading multibyte length at offset ${offset}`);
    }
    let length = 0;
    for (let i = 0; i < numOctets; i++) {
      length = (length << 8) | buf[offset + 1 + i];
    }
    return { length, bytesRead: 1 + numOctets };
  }

  static decodeOid(buf: Buffer, offset: number, length: number): string {
    if (length === 0) return '';
    const firstByte = buf[offset];
    const x = Math.floor(firstByte / 40);
    const y = firstByte % 40;
    const components: number[] = [x, y];

    let currentVal = 0;
    for (let i = 1; i < length; i++) {
      const byte = buf[offset + i];
      currentVal = (currentVal << 7) | (byte & 0x7f);
      if ((byte & 0x80) === 0) {
        components.push(currentVal);
        currentVal = 0;
      }
    }
    return components.join('.');
  }

  static getErrorStatusText(status: number): string {
    switch (status) {
      case 0: return 'noError (0)';
      case 1: return 'tooBig (1)';
      case 2: return 'noSuchName (2)';
      case 3: return 'badValue (3)';
      case 4: return 'readOnly (4)';
      case 5: return 'genErr (5)';
      case 6: return 'noAccess (6)';
      case 7: return 'wrongType (7)';
      case 8: return 'wrongLength (8)';
      case 9: return 'wrongEncoding (9)';
      case 10: return 'wrongValue (10)';
      case 11: return 'noCreation (11)';
      case 12: return 'inconsistentValue (12)';
      case 13: return 'resourceUnavailable (13)';
      case 14: return 'commitFailed (14)';
      case 15: return 'undoFailed (15)';
      case 16: return 'authorizationError (16)';
      case 17: return 'notWritable (17)';
      case 18: return 'inconsistentName (18)';
      default: return `unknownError (${status})`;
    }
  }

  /**
   * Decodes an incoming SNMP Response buffer into a structured object
   */
  static decodeSnmpMessage(buf: Buffer): DecodedSnmpResponse {
    let offset = 0;

    // 1. Root Sequence
    const rootTag = buf[offset++];
    if (rootTag !== Asn1Type.SEQUENCE) {
      throw new Error(`Expected root SEQUENCE (0x30), received 0x${rootTag.toString(16)}`);
    }
    const rootLen = this.readLength(buf, offset);
    offset += rootLen.bytesRead;

    // 2. Version (Integer)
    const verTag = buf[offset++];
    if (verTag !== Asn1Type.INTEGER) {
      throw new Error(`Expected version INTEGER (0x02), received 0x${verTag.toString(16)}`);
    }
    const verLen = this.readLength(buf, offset);
    offset += verLen.bytesRead;
    let version = 0;
    for (let i = 0; i < verLen.length; i++) {
      version = (version << 8) | buf[offset + i];
    }
    offset += verLen.length;

    // 3. Community (Octet String)
    const commTag = buf[offset++];
    if (commTag !== Asn1Type.OCTET_STRING) {
      throw new Error(`Expected community OCTET STRING (0x04), received 0x${commTag.toString(16)}`);
    }
    const commLen = this.readLength(buf, offset);
    offset += commLen.bytesRead;
    const community = buf.toString('utf8', offset, offset + commLen.length);
    offset += commLen.length;

    // 4. PDU (Usually GetResponse 0xA2)
    const pduTag = buf[offset++];
    const pduLen = this.readLength(buf, offset);
    offset += pduLen.bytesRead;

    // 5. Request-ID (Integer)
    const reqTag = buf[offset++];
    if (reqTag !== Asn1Type.INTEGER) {
      throw new Error(`Expected Request-ID INTEGER (0x02), received 0x${reqTag.toString(16)}`);
    }
    const reqLen = this.readLength(buf, offset);
    offset += reqLen.bytesRead;
    let requestId = 0;
    for (let i = 0; i < reqLen.length; i++) {
      requestId = (requestId << 8) | buf[offset + i];
    }
    offset += reqLen.length;

    // 6. Error-Status (Integer)
    const errStatusTag = buf[offset++];
    const errStatusLen = this.readLength(buf, offset);
    offset += errStatusLen.bytesRead;
    let errorStatus = 0;
    for (let i = 0; i < errStatusLen.length; i++) {
      errorStatus = (errorStatus << 8) | buf[offset + i];
    }
    offset += errStatusLen.length;

    // 7. Error-Index (Integer)
    const errIndexTag = buf[offset++];
    const errIndexLen = this.readLength(buf, offset);
    offset += errIndexLen.bytesRead;
    let errorIndex = 0;
    for (let i = 0; i < errIndexLen.length; i++) {
      errorIndex = (errorIndex << 8) | buf[offset + i];
    }
    offset += errIndexLen.length;

    // 8. VarBindList (Sequence)
    const varBindListTag = buf[offset++];
    if (varBindListTag !== Asn1Type.SEQUENCE) {
      throw new Error(`Expected VarBindList SEQUENCE (0x30), received 0x${varBindListTag.toString(16)}`);
    }
    const varBindListLen = this.readLength(buf, offset);
    offset += varBindListLen.bytesRead;

    const varBindListEnd = offset + varBindListLen.length;
    const varBinds: SnmpVarBind[] = [];

    // Parse each VarBind Sequence { OID, Value }
    while (offset < varBindListEnd && offset < buf.length) {
      const vbSeqTag = buf[offset++];
      if (vbSeqTag !== Asn1Type.SEQUENCE) {
        break;
      }
      const vbSeqLen = this.readLength(buf, offset);
      offset += vbSeqLen.bytesRead;

      // OID
      const oidTag = buf[offset++];
      if (oidTag !== Asn1Type.OBJECT_IDENTIFIER) {
        throw new Error(`Expected VarBind OID (0x06), received 0x${oidTag.toString(16)}`);
      }
      const oidLen = this.readLength(buf, offset);
      offset += oidLen.bytesRead;
      const oidStr = this.decodeOid(buf, offset, oidLen.length);
      offset += oidLen.length;

      // Value
      const valTypeTag = buf[offset++];
      const valLen = this.readLength(buf, offset);
      offset += valLen.bytesRead;

      let parsedValue: any = null;
      let typeName = 'UNKNOWN';

      switch (valTypeTag) {
        case Asn1Type.INTEGER:
          typeName = 'INTEGER';
          let intVal = 0;
          for (let i = 0; i < valLen.length; i++) {
            intVal = (intVal << 8) | buf[offset + i];
          }
          parsedValue = intVal;
          break;

        case Asn1Type.OCTET_STRING:
          typeName = 'OCTET_STRING';
          parsedValue = buf.toString('utf8', offset, offset + valLen.length);
          break;

        case Asn1Type.OBJECT_IDENTIFIER:
          typeName = 'OBJECT_IDENTIFIER';
          parsedValue = this.decodeOid(buf, offset, valLen.length);
          break;

        case Asn1Type.IP_ADDRESS:
          typeName = 'IP_ADDRESS';
          const ipParts = [];
          for (let i = 0; i < valLen.length; i++) {
            ipParts.push(buf[offset + i]);
          }
          parsedValue = ipParts.join('.');
          break;

        case Asn1Type.COUNTER32:
          typeName = 'COUNTER32';
          let c32 = 0;
          for (let i = 0; i < valLen.length; i++) {
            c32 = ((c32 << 8) | buf[offset + i]) >>> 0;
          }
          parsedValue = c32;
          break;

        case Asn1Type.GAUGE32:
          typeName = 'GAUGE32';
          let g32 = 0;
          for (let i = 0; i < valLen.length; i++) {
            g32 = ((g32 << 8) | buf[offset + i]) >>> 0;
          }
          parsedValue = g32;
          break;

        case Asn1Type.TIMETICKS:
          typeName = 'TIMETICKS';
          let ticks = 0;
          for (let i = 0; i < valLen.length; i++) {
            ticks = ((ticks << 8) | buf[offset + i]) >>> 0;
          }
          parsedValue = ticks; // In hundredths of a second
          break;

        case Asn1Type.NULL:
          typeName = 'NULL';
          parsedValue = null;
          break;

        case Asn1Type.NO_SUCH_OBJECT:
          typeName = 'NO_SUCH_OBJECT';
          parsedValue = 'NoSuchObject';
          break;

        case Asn1Type.NO_SUCH_INSTANCE:
          typeName = 'NO_SUCH_INSTANCE';
          parsedValue = 'NoSuchInstance';
          break;

        case Asn1Type.END_OF_MIB_VIEW:
          typeName = 'END_OF_MIB_VIEW';
          parsedValue = 'EndOfMibView';
          break;

        default:
          typeName = `TAG_0x${valTypeTag.toString(16)}`;
          parsedValue = buf.slice(offset, offset + valLen.length).toString('hex');
          break;
      }

      offset += valLen.length;

      varBinds.push({
        oid: oidStr,
        type: valTypeTag,
        typeName,
        value: parsedValue,
      });
    }

    return {
      version,
      community,
      pduType: pduTag,
      requestId,
      errorStatus,
      errorStatusText: this.getErrorStatusText(errorStatus),
      errorIndex,
      varBinds,
    };
  }

  /**
   * Helper to format TimeTicks into days, hours, mins, secs
   */
  static formatTimeTicks(hundredths: number): string {
    const totalSeconds = Math.floor(hundredths / 100);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const remainder = hundredths % 100;

    let res = '';
    if (days > 0) res += `${days}d `;
    res += `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${remainder.toString().padStart(2, '0')}`;
    return res;
  }
}

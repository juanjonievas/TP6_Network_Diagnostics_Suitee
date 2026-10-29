export interface MibOidDefinition {
  oid: string;
  name: string;
  description: string;
  unit?: string;
}

export const SNMP_OIDS = {
  // MIB-II System Group (1.3.6.1.2.1.1.x)
  sysDescr: {
    oid: '1.3.6.1.2.1.1.1.0',
    name: 'sysDescr',
    description: 'Descripción textual de la entidad (OS, hardware, software version)',
  },
  sysUpTime: {
    oid: '1.3.6.1.2.1.1.3.0',
    name: 'sysUpTime',
    description: 'Tiempo transcurrido desde la última inicialización de la porción de red',
    unit: 'centésimas de segundo',
  },
  sysContact: {
    oid: '1.3.6.1.2.1.1.4.0',
    name: 'sysContact',
    description: 'Contacto administrativo del equipo',
  },
  sysName: {
    oid: '1.3.6.1.2.1.1.5.0',
    name: 'sysName',
    description: 'Nombre de dominio completamente calificado o identificador asignado',
  },
  sysLocation: {
    oid: '1.3.6.1.2.1.1.6.0',
    name: 'sysLocation',
    description: 'Ubicación física del nodo de red',
  },

  // MIB-II Interfaces Group (1.3.6.1.2.1.2.2.1.x) - Interface #1
  ifDescr1: {
    oid: '1.3.6.1.2.1.2.2.1.2.1',
    name: 'ifDescr.1',
    description: 'Nombre descriptivo de la interfaz #1 (e.g. eth0, wan0)',
  },
  ifOperStatus1: {
    oid: '1.3.6.1.2.1.2.2.1.8.1',
    name: 'ifOperStatus.1',
    description: 'Estado operativo actual de la interfaz (1=up, 2=down, 3=testing)',
  },
  ifInOctets1: {
    oid: '1.3.6.1.2.1.2.2.1.10.1',
    name: 'ifInOctets.1',
    description: 'Total de bytes (octetos) recibidos por la interfaz',
    unit: 'bytes',
  },
  ifOutOctets1: {
    oid: '1.3.6.1.2.1.2.2.1.16.1',
    name: 'ifOutOctets.1',
    description: 'Total de bytes (octetos) transmitidos por la interfaz',
    unit: 'bytes',
  },
} as const;

export const DEFAULT_TELEMETRY_OIDS = [
  SNMP_OIDS.sysName.oid,
  SNMP_OIDS.sysUpTime.oid,
  SNMP_OIDS.sysDescr.oid,
  SNMP_OIDS.ifInOctets1.oid,
  SNMP_OIDS.ifOutOctets1.oid,
];

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NetworkDevice, SnmpDiagnosticResult, SshDiagnosticResult } from '../types';
import { LocalDatabase } from '../db/localDatabase';
import { StatusBadge } from '../components/StatusBadge';
import { Colors, Spacing, Typography } from '../theme';

export const DeviceDetailScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const initialDevice: NetworkDevice = route.params?.device || {
    id: 'dev_default',
    ip: '192.168.1.1',
    hostname: 'Router de Campo',
    deviceType: 'Router',
    discoveryMethod: 'Manual',
    firstSeen: Date.now(),
    lastSeen: Date.now(),
    isReachable: true,
  };

  const [device, setDevice] = useState<NetworkDevice>(initialDevice);
  const [history, setHistory] = useState<{ snmp: SnmpDiagnosticResult[]; ssh: SshDiagnosticResult[] }>({
    snmp: [],
    ssh: [],
  });

  useEffect(() => {
    LocalDatabase.getDiagnosticsForDevice(device.id).then(setHistory);
  }, [device.id]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Device Info Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.hostname}>{device.hostname || device.ip}</Text>
          <StatusBadge label={device.deviceType} type="info" />
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Dirección IP:</Text>
          <Text style={styles.metaValue}>{device.ip}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Dirección MAC:</Text>
          <Text style={styles.metaValue}>{device.mac || 'No disponible (Android 10+ SELinux)'}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Método de Detección:</Text>
          <Text style={styles.metaValue}>{device.discoveryMethod}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Último Avistamiento:</Text>
          <Text style={styles.metaValue}>{new Date(device.lastSeen).toLocaleTimeString()}</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <Text style={styles.sectionTitle}>Acciones de Diagnóstico e Instalación</Text>
      <View style={styles.actionGrid}>
        <TouchableOpacity
          style={[styles.btn, styles.btnSnmp]}
          onPress={() => navigation.navigate('SNMPDiagnostic', { device })}
        >
          <Text style={styles.btnTitle}>Consulta SNMP (RF-02)</Text>
          <Text style={styles.btnSub}>sysName, uptime y contadores de tráfico</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnSsh]}
          onPress={() => navigation.navigate('SSHDiagnostic', { device })}
        >
          <Text style={styles.btnTitle}>Consola Remota SSH (RF-03)</Text>
          <Text style={styles.btnSub}>Comandos de diagnóstico con Keystore</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnEvidence]}
          onPress={() => navigation.navigate('InstallationForm', { device })}
        >
          <Text style={styles.btnTitle}>Registrar Instalación (RF-05)</Text>
          <Text style={styles.btnSub}>Fotos, coordenadas GPS y notas técnicas</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnHistory]}
          onPress={() => navigation.navigate('DiagnosticHistory', { deviceId: device.id })}
        >
          <Text style={styles.btnTitle}>Ver Historial Offline (RF-08)</Text>
          <Text style={styles.btnSub}>Auditorías previas guardadas en el equipo</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Diagnostic Summary */}
      {(history.snmp.length > 0 || history.ssh.length > 0) && (
        <View style={styles.historyCard}>
          <Text style={styles.historyTitle}>Diagnósticos Recientes Registrados</Text>
          <Text style={styles.historySubtitle}>
            {history.snmp.length} consultas SNMP • {history.ssh.length} ejecuciones SSH
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  hostname: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  metaLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  metaValue: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  actionGrid: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  btn: {
    padding: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
  },
  btnSnmp: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  btnSsh: {
    backgroundColor: '#f5f3ff',
    borderColor: '#ddd6fe',
  },
  btnEvidence: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  btnHistory: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  btnTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  btnSub: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  historyCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  historySubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});

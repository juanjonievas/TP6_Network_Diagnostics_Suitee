import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { OutboxStatusBar } from '../components/OutboxStatusBar';
import { LocalDatabase } from '../db/localDatabase';
import { NetworkDevice, InstallationEvidence } from '../types';
import { Colors, Spacing, Typography } from '../theme';

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [installations, setInstallations] = useState<InstallationEvidence[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    const devs = await LocalDatabase.getDevices();
    const insts = await LocalDatabase.getInstallations();
    setDevices(devs);
    setInstallations(insts);
  };

  useEffect(() => {
    loadData();
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <OutboxStatusBar onPress={() => navigation.navigate('SyncStatus')} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.appName}>Network Diagnostics Suite</Text>
          <Text style={styles.appSubtitle}>Toolkit de Campo para Infraestructura de Telecomunicaciones</Text>
        </View>

        {/* Dashboard Metrics */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricNumber}>{devices.length}</Text>
            <Text style={styles.metricLabel}>Equipos en Red</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricNumber}>{installations.length}</Text>
            <Text style={styles.metricLabel}>Instalaciones</Text>
          </View>
        </View>

        {/* Action Grid */}
        <Text style={styles.sectionTitle}>Módulos Operativos de Campo</Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={[styles.actionBtn, { borderLeftColor: Colors.primary }]}
            onPress={() => navigation.navigate('Discovery')}
          >
            <Text style={styles.actionTitle}>1. Escaneo LAN & mDNS</Text>
            <Text style={styles.actionDesc}>Barrido de subred CIDR y resolución de nodos activos (RF-01)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { borderLeftColor: '#059669' }]}
            onPress={() => navigation.navigate('SNMPDiagnostic')}
          >
            <Text style={styles.actionTitle}>2. Diagnóstico SNMP</Text>
            <Text style={styles.actionDesc}>Telemetría UDP/161: sysUpTime, sysName y tráfico de interfaces (RF-02)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { borderLeftColor: '#7c3aed' }]}
            onPress={() => navigation.navigate('SSHDiagnostic')}
          >
            <Text style={styles.actionTitle}>3. Diagnóstico Remoto SSH</Text>
            <Text style={styles.actionDesc}>Comandos de red predefinidos con Keystore seguro (RF-03)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { borderLeftColor: '#d97706' }]}
            onPress={() => navigation.navigate('QRScanner')}
          >
            <Text style={styles.actionTitle}>4. Escáner QR / Código de Barras</Text>
            <Text style={styles.actionDesc}>Identificación óptica de activos con modo de contingencia (RF-04)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { borderLeftColor: '#2563eb' }]}
            onPress={() => navigation.navigate('InstallationForm')}
          >
            <Text style={styles.actionTitle}>5. Registrar Instalación</Text>
            <Text style={styles.actionDesc}>Captura fotográfica, georreferenciación GPS y reporte PDF (RF-05, RF-06)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { borderLeftColor: '#4b5563' }]}
            onPress={() => navigation.navigate('DiagnosticHistory')}
          >
            <Text style={styles.actionTitle}>6. Historial Offline</Text>
            <Text style={styles.actionDesc}>Auditorías y reportes consultables sin conexión (RF-08)</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Discovered Devices */}
        {devices.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Equipos Descubiertos Recientes</Text>
            {devices.slice(0, 3).map((dev) => (
              <TouchableOpacity
                key={dev.id}
                style={styles.deviceItem}
                onPress={() => navigation.navigate('DeviceDetail', { device: dev })}
              >
                <View>
                  <Text style={styles.deviceHost}>{dev.hostname || dev.ip}</Text>
                  <Text style={styles.deviceIp}>IP: {dev.ip} • Tipo: {dev.deviceType}</Text>
                </View>
                <Text style={styles.deviceAction}>Ver Ficha →</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  header: {
    marginBottom: Spacing.md,
  },
  appName: {
    ...Typography.title,
    color: Colors.primaryDark,
  },
  appSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  metricCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  metricNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.primary,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
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
  actionBtn: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 5,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  actionDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  recentSection: {
    marginTop: Spacing.xs,
  },
  deviceItem: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  deviceHost: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  deviceIp: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  deviceAction: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
});

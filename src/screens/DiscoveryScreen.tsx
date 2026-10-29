import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DiscoveryService, ScanProgress } from '../services/discovery/discoveryService';
import { LocalDatabase } from '../db/localDatabase';
import { NetworkDevice } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Colors, Spacing, Typography } from '../theme';

export const DiscoveryScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [baseIp, setBaseIp] = useState('192.168.1.1');
  const [netmask, setNetmask] = useState('255.255.255.0');
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [devices, setDevices] = useState<NetworkDevice[]>([]);

  const handleStartScan = async () => {
    if (!baseIp) {
      Alert.alert('Error', 'Ingrese una dirección IP base para calcular la subred');
      return;
    }

    setIsScanning(true);
    setProgress(null);
    setDevices([]);

    // Also start mDNS listener in background
    DiscoveryService.startMdnsDiscovery((device) => {
      setDevices(prev => {
        if (!prev.find(d => d.ip === device.ip)) {
          LocalDatabase.saveDevice(device);
          return [device, ...prev];
        }
        return prev;
      });
    });

    try {
      const results = await DiscoveryService.scanSubnet(
        baseIp,
        netmask,
        (p) => setProgress(p),
        (newDev) => {
          LocalDatabase.saveDevice(newDev);
          setDevices(prev => {
            if (!prev.find(d => d.ip === newDev.ip)) {
              return [...prev, newDev];
            }
            return prev;
          });
        }
      );
      setDevices(results);
    } catch (err: any) {
      Alert.alert('Aviso de Escaneo', err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleStopScan = () => {
    DiscoveryService.stopScan();
    setIsScanning(false);
  };

  return (
    <View style={styles.container}>
      {/* Subnet Input Bar */}
      <View style={styles.inputCard}>
        <View style={styles.inputRow}>
          <View style={{ flex: 2, marginRight: Spacing.sm }}>
            <Text style={styles.label}>IP Base de Red</Text>
            <TextInput
              style={styles.input}
              value={baseIp}
              onChangeText={setBaseIp}
              keyboardType="numeric"
              placeholder="192.168.1.1"
              editable={!isScanning}
            />
          </View>
          <View style={{ flex: 2 }}>
            <Text style={styles.label}>Máscara Subred</Text>
            <TextInput
              style={styles.input}
              value={netmask}
              onChangeText={setNetmask}
              keyboardType="numeric"
              placeholder="255.255.255.0"
              editable={!isScanning}
            />
          </View>
        </View>

        <View style={styles.btnRow}>
          {isScanning ? (
            <TouchableOpacity style={[styles.btn, styles.btnStop]} onPress={handleStopScan}>
              <Text style={styles.btnText}>Detener Escaneo</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.btn, styles.btnStart]} onPress={handleStartScan}>
              <Text style={styles.btnText}>Iniciar Barrido LAN (RF-01)</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Technical Notice about Android SELinux / ARP */}
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>
            ℹ️ <strong>Mecanismo de Descubrimiento:</strong> Sondeo activo Ping Sweep sobre puertos 80/443/22/53 + mDNS Bonjour. Las direcciones MAC del kernel están restringidas por SELinux a partir de Android 10 por privacidad.
          </Text>
        </View>
      </View>

      {/* Progress Section */}
      {isScanning && progress && (
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Escaneando host: {progress.currentIp}</Text>
            <Text style={styles.progressPercent}>{progress.percentage}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress.percentage}%` }]} />
          </View>
          <View style={styles.progressMeta}>
            <Text style={styles.progressText}>Procesados: {progress.scanned} de {progress.total} hosts</Text>
            <Text style={styles.progressText}>Activos: {progress.activeCount}</Text>
          </View>
        </View>
      )}

      {/* Discovered Devices List */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Dispositivos Activos Encontrados ({devices.length})</Text>
      </View>

      <FlatList
        data={devices}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !isScanning ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Ningún dispositivo listado aún</Text>
              <Text style={styles.emptySubtitle}>Presione "Iniciar Barrido LAN" para descubrir equipos en su red.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('DeviceDetail', { device: item })}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardHost}>{item.hostname || item.ip}</Text>
              <StatusBadge label={item.deviceType} type={item.deviceType === 'Router' ? 'info' : 'success'} />
            </View>
            <Text style={styles.cardIp}>IP: {item.ip}</Text>
            <Text style={styles.cardMac}>MAC: {item.mac}</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.cardMethod}>Método: {item.discoveryMethod}</Text>
              <Text style={styles.cardAction}>Diagnosticar →</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  inputCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.borderDark,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: '#fff',
  },
  btnRow: {
    marginTop: 4,
  },
  btn: {
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  btnStart: {
    backgroundColor: Colors.primary,
  },
  btnStop: {
    backgroundColor: Colors.danger,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  noticeBox: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
  },
  noticeText: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 15,
  },
  progressCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  listHeader: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  listContent: {
    padding: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardHost: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  cardIp: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  cardMac: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cardMethod: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  cardAction: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  emptySubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
});

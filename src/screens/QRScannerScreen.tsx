import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LocalDatabase } from '../db/localDatabase';
import { NetworkDevice } from '../types';
import { Colors, Spacing, Typography } from '../theme';

export const QRScannerScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [scannedCode, setScannedCode] = useState<string>('');
  const [manualCode, setManualCode] = useState<string>('ROUTER-CISCO-C2960-01');
  const [hasCameraPermission, setHasCameraPermission] = useState(false);

  useEffect(() => {
    // Check camera permission if vision camera is available
    try {
      const { Camera } = require('react-native-vision-camera');
      if (Camera && Camera.requestCameraPermission) {
        Camera.requestCameraPermission().then((status: string) => {
          setHasCameraPermission(status === 'granted');
        });
      }
    } catch (_) {
      // Running in headless or environment without native camera
      setHasCameraPermission(false);
    }
  }, []);

  const handleApplyCode = (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) {
      Alert.alert('Código Vacío', 'Ingrese o escanee un código de activo');
      return;
    }

    setScannedCode(cleanCode);

    // Check if code contains an IP address
    const ipMatch = cleanCode.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
    const resolvedIp = ipMatch ? ipMatch[0] : '192.168.1.1';

    const device: NetworkDevice = {
      id: `dev_${cleanCode.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      ip: resolvedIp,
      hostname: cleanCode,
      deviceType: cleanCode.toLowerCase().includes('ont') ? 'ONT' : cleanCode.toLowerCase().includes('switch') ? 'Switch' : 'Router',
      discoveryMethod: 'Manual',
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      isReachable: true,
    };

    LocalDatabase.saveDevice(device);

    Alert.alert(
      'Código Identificado (RF-04)',
      `Código: ${cleanCode}\nEquipo vinculado: ${device.hostname}\nIP: ${device.ip}`,
      [
        {
          text: 'Ficha de Equipo',
          onPress: () => navigation.navigate('DeviceDetail', { device }),
        },
        {
          text: 'Registrar Instalación',
          onPress: () => navigation.navigate('InstallationForm', { device, qrCode: cleanCode }),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Viewfinder Mock / Camera Area */}
      <View style={styles.cameraBox}>
        <View style={styles.viewfinder}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
          <Text style={styles.viewfinderText}>
            {hasCameraPermission 
              ? 'Alinee el código QR o código de barras de la etiqueta' 
              : 'Visor de Cámara Óptica Activo\n(Permiso de Cámara concedido)'}
          </Text>
        </View>
      </View>

      {/* Manual & Demo Barcode Contingency Section */}
      <View style={styles.manualCard}>
        <Text style={styles.cardTitle}>Modo de Contingencia / Pruebas (RF-04)</Text>
        <Text style={styles.cardSubtitle}>
          Permite ingresar códigos de activos manualmente ante etiquetas dañadas o borradas en racks.
        </Text>

        <TextInput
          style={styles.input}
          value={manualCode}
          onChangeText={setManualCode}
          placeholder="Código de activo o MAC (ej: ROUTER-01)"
          autoCapitalize="characters"
        />

        {/* Quick Demo Code Chips */}
        <View style={styles.chipsContainer}>
          <TouchableOpacity
            style={styles.chip}
            onPress={() => setManualCode('ROUTER-CISCO-C2960-01')}
          >
            <Text style={styles.chipText}>Router Cisco</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.chip}
            onPress={() => setManualCode('ONT-ZTE-ZXHN-F670L')}
          >
            <Text style={styles.chipText}>ONT Fibra ZTE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.chip}
            onPress={() => setManualCode('ANTENNA-UBNT-LITEBEAM-5AC')}
          >
            <Text style={styles.chipText}>Antena Ubiquiti</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.btnScan} onPress={() => handleApplyCode(manualCode)}>
          <Text style={styles.btnScanText}>Vincular Código a Ficha Técnica</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  viewfinder: {
    width: 250,
    height: 250,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    padding: 20,
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#3b82f6',
  },
  cornerTL: { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4 },
  viewfinderText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    borderRadius: 4,
  },
  manualCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  cardSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.borderDark,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: '#fff',
    marginBottom: Spacing.sm,
  },
  chipsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
  },
  chip: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  btnScan: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  btnScanText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});

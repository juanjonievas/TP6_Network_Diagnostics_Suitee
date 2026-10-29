import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { EvidenceService, LocationResult } from '../services/evidence/evidenceService';
import { OutboxService } from '../services/sync/outboxService';
import { PdfReportService } from '../services/reporting/pdfReportService';
import { LocalDatabase } from '../db/localDatabase';
import { InstallationEvidence, NetworkDevice } from '../types';
import { Colors, Spacing, Typography } from '../theme';

export const InstallationFormScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const device: NetworkDevice | undefined = route.params?.device;
  const initialQr: string = route.params?.qrCode || '';

  const [deviceId, setDeviceId] = useState(device?.hostname || device?.ip || 'Router-Cisco-Core');
  const [qrCode, setQrCode] = useState(initialQr);
  const [technicianName, setTechnicianName] = useState('Técnico de Infraestructura');
  const [notes, setNotes] = useState('Instalación en rack completada. Parches de fibra y alimentación estabilizada.');
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCaptureGps = async () => {
    setGpsLoading(true);
    try {
      const loc = await EvidenceService.getCurrentLocation(10000);
      setLocation(loc);
      Alert.alert('GPS Satelital Adquirido', `Lat: ${loc.latitude.toFixed(6)}\nLng: ${loc.longitude.toFixed(6)}\nPrecisión: ±${loc.accuracy.toFixed(1)}m`);
    } catch (err: any) {
      Alert.alert('Error GPS', err.message);
    } finally {
      setGpsLoading(false);
    }
  };

  const handleAttachPhoto = () => {
    setHasPhoto(true);
    Alert.alert('Fotografía Capturada', 'Foto de gabinete de telecomunicaciones adjuntada en Base64 para reporte PDF.');
  };

  const handleSaveAndEnqueue = async (generatePdfNow = false) => {
    if (!location) {
      Alert.alert('Faltan Coordenadas GPS', 'Por favor capture la ubicación satelital antes de registrar la instalación.');
      return;
    }

    setSaving(true);
    const photoBase64 = hasPhoto ? EvidenceService.getSampleRackPhotoBase64() : undefined;

    const installation: InstallationEvidence = {
      id: `inst_${Date.now()}`,
      deviceId,
      qrCode: qrCode.trim() || undefined,
      latitude: location.latitude,
      longitude: location.longitude,
      altitude: location.altitude || undefined,
      accuracy: location.accuracy,
      photoUris: ['file:///simulated/rack_photo.jpg'],
      photoBase64s: photoBase64 ? [photoBase64] : [],
      notes,
      technicianName,
      timestamp: Date.now(),
      synced: false,
      pdfGenerated: false,
    };

    try {
      // 1. Save in local database (Offline-First)
      await LocalDatabase.saveInstallation(installation);

      // 2. Enqueue in Outbox for deferred synchronization
      await OutboxService.enqueue('SYNC_INSTALLATION', installation.id, installation);

      if (generatePdfNow) {
        // 3. Generate PDF Report
        const pdfRes = await PdfReportService.generatePdf({
          installation,
          device,
        });

        await LocalDatabase.updateInstallation(installation.id, {
          pdfGenerated: true,
          pdfPath: pdfRes.filePath,
        });

        navigation.navigate('PDFViewer', {
          html: pdfRes.html,
          filePath: pdfRes.filePath,
          installation,
        });
      } else {
        Alert.alert(
          'Instalación Registrada',
          'La evidencia ha sido guardada en la base de datos local y encolada en el Outbox para sincronización automática cuando haya conectividad.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Home'),
            },
          ]
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Datos de la Instalación (RF-05)</Text>

        <Text style={styles.label}>Equipo / Hostname</Text>
        <TextInput
          style={styles.input}
          value={deviceId}
          onChangeText={setDeviceId}
          placeholder="Identificador del equipo"
        />

        <Text style={styles.label}>Código QR / Barra de Activo</Text>
        <TextInput
          style={styles.input}
          value={qrCode}
          onChangeText={setQrCode}
          placeholder="Escanee o ingrese código (opcional)"
        />

        <Text style={styles.label}>Técnico Responsable</Text>
        <TextInput
          style={styles.input}
          value={technicianName}
          onChangeText={setTechnicianName}
          placeholder="Nombre del técnico"
        />

        {/* GPS Sensor Section */}
        <View style={styles.sensorBox}>
          <View style={styles.sensorHeader}>
            <Text style={styles.sensorTitle}>📍 Georreferenciación Satelital (GPS Real)</Text>
            {location && <Text style={styles.gpsSuccessBadge}>Fijado ±{location.accuracy.toFixed(1)}m</Text>}
          </View>
          {location ? (
            <Text style={styles.gpsCoords}>
              Lat: {location.latitude.toFixed(6)}° • Lng: {location.longitude.toFixed(6)}°
            </Text>
          ) : (
            <Text style={styles.gpsMuted}>No se ha adquirido la posición del sensor satelital</Text>
          )}
          <TouchableOpacity
            style={[styles.btnGps, gpsLoading && styles.btnDisabled]}
            onPress={handleCaptureGps}
            disabled={gpsLoading}
          >
            {gpsLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.btnGpsText}>Adquirir Coordenadas Satelitales (Hardware GPS)</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Photo Evidence Section */}
        <View style={styles.sensorBox}>
          <Text style={styles.sensorTitle}>📷 Evidencia Fotográfica</Text>
          {hasPhoto ? (
            <Text style={styles.photoAttached}>✅ Fotografía de instalación adjuntada</Text>
          ) : (
            <Text style={styles.gpsMuted}>Sin fotografías registradas</Text>
          )}
          <TouchableOpacity style={styles.btnPhoto} onPress={handleAttachPhoto}>
            <Text style={styles.btnPhotoText}>Capturar Fotografía de Gabinete</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Observaciones Técnicas de Campo</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
          placeholder="Notas de instalación, puertos conectados, niveles de potencia óptica..."
        />

        {/* Submit Buttons */}
        <TouchableOpacity
          style={[styles.btnSubmit, saving && styles.btnDisabled]}
          onPress={() => handleSaveAndEnqueue(false)}
          disabled={saving}
        >
          <Text style={styles.btnSubmitText}>Guardar Local & Encolar Outbox (RF-05)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnPdf, saving && styles.btnDisabled]}
          onPress={() => handleSaveAndEnqueue(true)}
          disabled={saving}
        >
          <Text style={styles.btnPdfText}>Guardar y Generar Reporte PDF (RF-06)</Text>
        </TouchableOpacity>
      </View>
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
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
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
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: '#fff',
    marginBottom: Spacing.sm,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  sensorBox: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    borderRadius: 6,
    marginBottom: Spacing.sm,
  },
  sensorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sensorTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  gpsSuccessBadge: {
    fontSize: 11,
    color: Colors.success,
    fontWeight: '700',
    backgroundColor: Colors.successBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gpsCoords: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primaryDark,
    marginBottom: 6,
  },
  gpsMuted: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  photoAttached: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success,
    marginBottom: 6,
  },
  btnGps: {
    backgroundColor: '#1d4ed8',
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  btnGpsText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  btnPhoto: {
    backgroundColor: '#374151',
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  btnPhotoText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  btnSubmit: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  btnSubmitText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  btnPdf: {
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  btnPdfText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Share } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Colors, Spacing } from '../theme';

export const PDFViewerScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const filePath: string = route.params?.filePath || 'Reporte_Instalacion.pdf';
  const installation = route.params?.installation;

  const handleShare = async () => {
    try {
      await Share.share({
        title: 'Reporte Técnico de Instalación',
        message: `Reporte de instalación ${installation?.id || ''} generado en: ${filePath}`,
        url: filePath,
      });
    } catch (error: any) {
      Alert.alert('Compartir', error.message);
    }
  };

  const handleOpenPdf = () => {
    Alert.alert(
      'Visor de Documentos',
      `Documento PDF almacenado en el almacenamiento accesible del dispositivo:\n\n${filePath}\n\nListo para exportación y visualización offline.`
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.successIconBox}>
          <Text style={styles.successIcon}>📄</Text>
        </View>

        <Text style={styles.title}>Reporte PDF Generado con Éxito</Text>
        <Text style={styles.subtitle}>El documento técnico de campo ha sido compilado y guardado en almacenamiento local.</Text>

        <View style={styles.metaBox}>
          <Text style={styles.metaRow}><strong>ID Reporte:</strong> {installation?.id || 'inst_temp'}</Text>
          <Text style={styles.metaRow}><strong>Dispositivo:</strong> {installation?.deviceId || 'Equipo'}</Text>
          <Text style={styles.metaRow}><strong>Ubicación GPS:</strong> {installation?.latitude?.toFixed(5)}°, {installation?.longitude?.toFixed(5)}°</Text>
          <Text style={styles.metaRow}><strong>Ruta Local:</strong> {filePath}</Text>
        </View>

        <TouchableOpacity style={styles.btnPrimary} onPress={handleOpenPdf}>
          <Text style={styles.btnPrimaryText}>Abrir Documento en Visor Local</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnSecondary} onPress={handleShare}>
          <Text style={styles.btnSecondaryText}>Compartir / Exportar PDF</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnHome} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.btnHomeText}>Volver al Panel Principal</Text>
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
    alignItems: 'center',
  },
  card: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    width: '100%',
    alignItems: 'center',
  },
  successIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#def7ec',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  successIcon: {
    fontSize: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  metaBox: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    borderRadius: 8,
    width: '100%',
    marginBottom: Spacing.lg,
  },
  metaRow: {
    fontSize: 12,
    color: Colors.text,
    marginBottom: 6,
  },
  btnPrimary: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 6,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  btnSecondary: {
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 6,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  btnSecondaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  btnHome: {
    backgroundColor: 'transparent',
    paddingVertical: 10,
    width: '100%',
    alignItems: 'center',
  },
  btnHomeText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
});

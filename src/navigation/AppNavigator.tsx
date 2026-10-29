import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { DiscoveryScreen } from '../screens/DiscoveryScreen';
import { DeviceDetailScreen } from '../screens/DeviceDetailScreen';
import { SNMPDiagnosticScreen } from '../screens/SNMPDiagnosticScreen';
import { SSHDiagnosticScreen } from '../screens/SSHDiagnosticScreen';
import { QRScannerScreen } from '../screens/QRScannerScreen';
import { InstallationFormScreen } from '../screens/InstallationFormScreen';
import { DiagnosticHistoryScreen } from '../screens/DiagnosticHistoryScreen';
import { SyncStatusScreen } from '../screens/SyncStatusScreen';
import { PDFViewerScreen } from '../screens/PDFViewerScreen';
import { NetworkDevice, InstallationEvidence } from '../types';
import { Colors } from '../theme';

export type RootStackParamList = {
  Home: undefined;
  Discovery: undefined;
  DeviceDetail: { device?: NetworkDevice };
  SNMPDiagnostic: { device?: NetworkDevice };
  SSHDiagnostic: { device?: NetworkDevice };
  QRScanner: undefined;
  InstallationForm: { device?: NetworkDevice; qrCode?: string };
  DiagnosticHistory: { deviceId?: string };
  SyncStatus: undefined;
  PDFViewer: { html: string; filePath: string; installation?: InstallationEvidence };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.primaryDark,
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 16,
        },
        headerBackVisible: true,
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Network Diagnostics Suite' }}
      />
      <Stack.Screen
        name="Discovery"
        component={DiscoveryScreen}
        options={{ title: 'Escaneo LAN & mDNS (RF-01)' }}
      />
      <Stack.Screen
        name="DeviceDetail"
        component={DeviceDetailScreen}
        options={{ title: 'Ficha Técnica del Equipo' }}
      />
      <Stack.Screen
        name="SNMPDiagnostic"
        component={SNMPDiagnosticScreen}
        options={{ title: 'Diagnóstico SNMP UDP (RF-02)' }}
      />
      <Stack.Screen
        name="SSHDiagnostic"
        component={SSHDiagnosticScreen}
        options={{ title: 'Consola Remota SSH (RF-03)' }}
      />
      <Stack.Screen
        name="QRScanner"
        component={QRScannerScreen}
        options={{ title: 'Lector Óptico QR / Barras (RF-04)' }}
      />
      <Stack.Screen
        name="InstallationForm"
        component={InstallationFormScreen}
        options={{ title: 'Registrar Instalación (RF-05)' }}
      />
      <Stack.Screen
        name="DiagnosticHistory"
        component={DiagnosticHistoryScreen}
        options={{ title: 'Historial Offline (RF-08)' }}
      />
      <Stack.Screen
        name="SyncStatus"
        component={SyncStatusScreen}
        options={{ title: 'Sincronización & Outbox (RF-07)' }}
      />
      <Stack.Screen
        name="PDFViewer"
        component={PDFViewerScreen}
        options={{ title: 'Reporte PDF Generado (RF-06)' }}
      />
    </Stack.Navigator>
  );
};

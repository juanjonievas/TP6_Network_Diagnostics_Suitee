import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { SnmpClient } from '../services/snmp/snmpClient';
import { LocalDatabase } from '../db/localDatabase';
import { SnmpDiagnosticResult } from '../types';
import { Colors, Spacing, Typography } from '../theme';

export const SNMPDiagnosticScreen: React.FC = () => {
  const route = useRoute<any>();
  const initialIp = route.params?.device?.ip || '192.168.1.1';

  const [ip, setIp] = useState(initialIp);
  const [port, setPort] = useState('161');
  const [community, setCommunity] = useState('public');
  const [timeoutMs, setTimeoutMs] = useState('2500');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SnmpDiagnosticResult | null>(null);

  const handleRunSnmp = async () => {
    if (!ip) {
      Alert.alert('Error', 'Ingrese una dirección IP válida');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await SnmpClient.get(ip, undefined, {
        port: parseInt(port, 10) || 161,
        community: community.trim() || 'public',
        timeoutMs: parseInt(timeoutMs, 10) || 2500,
      });

      setResult(res);

      if (res.success) {
        await LocalDatabase.saveSnmpDiagnostic(res);
      }
    } catch (err: any) {
      Alert.alert('Error SNMP', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Configuration Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Parámetros de Consulta SNMPv2c (UDP/161)</Text>

        <View style={styles.row}>
          <View style={{ flex: 3, marginRight: Spacing.sm }}>
            <Text style={styles.label}>Dirección IP</Text>
            <TextInput
              style={styles.input}
              value={ip}
              onChangeText={setIp}
              keyboardType="numeric"
              placeholder="192.168.1.1"
              editable={!loading}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Puerto</Text>
            <TextInput
              style={styles.input}
              value={port}
              onChangeText={setPort}
              keyboardType="numeric"
              placeholder="161"
              editable={!loading}
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={{ flex: 2, marginRight: Spacing.sm }}>
            <Text style={styles.label}>Community String</Text>
            <TextInput
              style={styles.input}
              value={community}
              onChangeText={setCommunity}
              placeholder="public"
              secureTextEntry
              editable={!loading}
            />
          </View>
          <View style={{ flex: 2 }}>
            <Text style={styles.label}>Timeout (ms)</Text>
            <TextInput
              style={styles.input}
              value={timeoutMs}
              onChangeText={setTimeoutMs}
              keyboardType="numeric"
              placeholder="2500"
              editable={!loading}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleRunSnmp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.btnText}>Consultar OIDs MIB-II (RF-02)</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Results View */}
      {result && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>
              {result.success ? '✅ Consulta Exitosa' : '❌ Fallo en Consulta'}
            </Text>
            <Text style={styles.resultDuration}>{result.durationMs} ms</Text>
          </View>

          {result.error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>Error: {result.error}</Text>
            </View>
          )}

          {result.success && (
            <View style={styles.metricsContainer}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>sysName (Nombre de Sistema)</Text>
                <Text style={styles.metricValue}>{result.sysName || 'No provisto'}</Text>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>sysUpTime (Tiempo Activo)</Text>
                <Text style={styles.metricValue}>{result.sysUpTime || 'No provisto'}</Text>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>ifInOctets.1 (Tráfico Entrada RX)</Text>
                <Text style={styles.metricValue}>
                  {result.ifInOctets !== undefined ? `${result.ifInOctets.toLocaleString()} bytes` : 'N/A'}
                </Text>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>ifOutOctets.1 (Tráfico Salida TX)</Text>
                <Text style={styles.metricValue}>
                  {result.ifOutOctets !== undefined ? `${result.ifOutOctets.toLocaleString()} bytes` : 'N/A'}
                </Text>
              </View>

              {result.sysDescr && (
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>sysDescr (Descripción)</Text>
                  <Text style={[styles.metricValue, { fontSize: 11 }]}>{result.sysDescr}</Text>
                </View>
              )}
            </View>
          )}
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
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  row: {
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
  btn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  resultCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  resultDuration: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  errorBox: {
    backgroundColor: Colors.dangerBg,
    padding: Spacing.sm,
    borderRadius: 6,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  metricsContainer: {
    marginVertical: 4,
  },
  metricItem: {
    padding: Spacing.sm,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
});

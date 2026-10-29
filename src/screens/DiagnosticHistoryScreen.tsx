import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { LocalDatabase } from '../db/localDatabase';
import { SnmpDiagnosticResult, SshDiagnosticResult, InstallationEvidence } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Colors, Spacing } from '../theme';

export const DiagnosticHistoryScreen: React.FC = () => {
  const route = useRoute<any>();
  const initialFilter = route.params?.deviceId || '';

  const [filterText, setFilterText] = useState(initialFilter);
  const [activeTab, setActiveTab] = useState<'snmp' | 'ssh' | 'inst'>('snmp');
  const [snmpList, setSnmpList] = useState<SnmpDiagnosticResult[]>([]);
  const [sshList, setSshList] = useState<SshDiagnosticResult[]>([]);
  const [instList, setInstList] = useState<InstallationEvidence[]>([]);

  useEffect(() => {
    LocalDatabase.getAllDiagnostics().then(({ snmp, ssh }) => {
      setSnmpList(snmp);
      setSshList(ssh);
    });
    LocalDatabase.getInstallations().then(setInstList);
  }, []);

  const filteredSnmp = snmpList.filter(s => 
    !filterText || s.ip.includes(filterText) || (s.sysName && s.sysName.toLowerCase().includes(filterText.toLowerCase()))
  );

  const filteredSsh = sshList.filter(s => 
    !filterText || s.ip.includes(filterText) || s.username.toLowerCase().includes(filterText.toLowerCase())
  );

  const filteredInst = instList.filter(i => 
    !filterText || i.deviceId.toLowerCase().includes(filterText.toLowerCase()) || (i.notes && i.notes.toLowerCase().includes(filterText.toLowerCase()))
  );

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={filterText}
          onChangeText={setFilterText}
          placeholder="Filtrar por IP, host o notas..."
        />
      </View>

      {/* Segment Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'snmp' && styles.tabActive]}
          onPress={() => setActiveTab('snmp')}
        >
          <Text style={[styles.tabText, activeTab === 'snmp' && styles.tabTextActive]}>
            SNMP ({filteredSnmp.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'ssh' && styles.tabActive]}
          onPress={() => setActiveTab('ssh')}
        >
          <Text style={[styles.tabText, activeTab === 'ssh' && styles.tabTextActive]}>
            SSH ({filteredSsh.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'inst' && styles.tabActive]}
          onPress={() => setActiveTab('inst')}
        >
          <Text style={[styles.tabText, activeTab === 'inst' && styles.tabTextActive]}>
            Instalaciones ({filteredInst.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* List Display */}
      {activeTab === 'snmp' && (
        <FlatList
          data={filteredSnmp}
          keyExtractor={(_, idx) => `snmp_${idx}`}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardHost}>{item.sysName || item.ip}</Text>
                <StatusBadge label={item.success ? 'Exitosa' : 'Fallida'} type={item.success ? 'success' : 'danger'} />
              </View>
              <Text style={styles.cardMeta}>IP: {item.ip} • Duración: {item.durationMs}ms</Text>
              <Text style={styles.cardMeta}>Fecha: {new Date(item.timestamp).toLocaleString()}</Text>
              {item.sysUpTime && <Text style={styles.cardDetail}>Uptime: {item.sysUpTime}</Text>}
              {item.ifInOctets !== undefined && (
                <Text style={styles.cardDetail}>
                  Tráfico: RX {item.ifInOctets.toLocaleString()} B • TX {item.ifOutOctets?.toLocaleString() || 0} B
                </Text>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No hay consultas SNMP registradas.</Text>}
        />
      )}

      {activeTab === 'ssh' && (
        <FlatList
          data={filteredSsh}
          keyExtractor={(_, idx) => `ssh_${idx}`}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardHost}>{item.ip}:{item.port}</Text>
                <StatusBadge label={item.success ? 'Ejecutado' : 'Con Errores'} type={item.success ? 'success' : 'warning'} />
              </View>
              <Text style={styles.cardMeta}>Usuario: {item.username} • {new Date(item.timestamp).toLocaleString()}</Text>
              <Text style={styles.cardDetail}>{item.commandResults.length} comandos ejecutados en la sesión</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No hay ejecuciones SSH registradas.</Text>}
        />
      )}

      {activeTab === 'inst' && (
        <FlatList
          data={filteredInst}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardHost}>{item.deviceId}</Text>
                <StatusBadge label={item.synced ? 'Sincronizado' : 'Offline'} type={item.synced ? 'success' : 'warning'} />
              </View>
              <Text style={styles.cardMeta}>GPS: {item.latitude.toFixed(5)}°, {item.longitude.toFixed(5)}° (±{item.accuracy?.toFixed(1) || '0'}m)</Text>
              <Text style={styles.cardMeta}>Fecha: {new Date(item.timestamp).toLocaleString()}</Text>
              <Text style={styles.cardDetail}>Notas: {item.notes}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No hay instalaciones registradas localmente.</Text>}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchBar: {
    padding: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: Colors.borderDark,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
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
  cardMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  cardDetail: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '500',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textMuted,
    paddingVertical: 40,
    fontSize: 14,
  },
});

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { SyncManager, SyncStats } from '../services/sync/syncManager';
import { LocalDatabase } from '../db/localDatabase';
import { OutboxItem } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Colors, Spacing } from '../theme';

export const SyncStatusScreen: React.FC = () => {
  const [backendUrl, setBackendUrl] = useState(SyncManager.getBackendUrl());
  const [stats, setStats] = useState<SyncStats>({
    isSyncing: false,
    lastSyncTimestamp: null,
    lastSyncStatus: 'idle',
    pendingCount: 0,
  });
  const [outboxItems, setOutboxItems] = useState<OutboxItem[]>([]);
  const [testingHealth, setTestingHealth] = useState(false);

  const reloadData = async () => {
    const items = await LocalDatabase.getOutboxItems();
    setOutboxItems(items);
  };

  useEffect(() => {
    reloadData();
    const unsubscribe = SyncManager.addListener((newStats) => {
      setStats(newStats);
      reloadData();
    });
    return unsubscribe;
  }, []);

  const handleSaveBackendUrl = () => {
    SyncManager.setBackendUrl(backendUrl);
    Alert.alert('Configuración Guardada', `URL del backend actualizada a: ${backendUrl}`);
  };

  const handleTestHealth = async () => {
    setTestingHealth(true);
    try {
      const res = await fetch(`${backendUrl}/api/health`);
      if (res.ok) {
        const data = await res.json();
        Alert.alert('Backend Conectado ✅', `Servicio: ${data.service}\nEstado: ${data.status}\nServidor accesible en la LAN.`);
      } else {
        Alert.alert('Error de Servidor', `Respuesta HTTP ${res.status}: ${res.statusText}`);
      }
    } catch (err: any) {
      Alert.alert('Fallo de Conexión ❌', `No se pudo conectar a ${backendUrl}. Verifique que el backend esté ejecutándose en la misma red Wi-Fi y que no haya firewall bloqueando el puerto 3000.`);
    } finally {
      setTestingHealth(false);
    }
  };

  const handleForceSync = async () => {
    const res = await SyncManager.syncNow();
    if (res.error) {
      Alert.alert('Resultado de Sincronización', `Sincronizados: ${res.syncedCount}\nFallidos: ${res.failedCount}\nDetalle: ${res.error}`);
    } else {
      Alert.alert('Sincronización Exitosa', `Se procesaron y confirmaron ${res.syncedCount} operaciones de la cola outbox.`);
    }
    await reloadData();
  };

  return (
    <View style={styles.container}>
      {/* Backend Config Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Configuración del Backend Stub</Text>
        <Text style={styles.cardSubtitle}>Dirección IP y puerto del servidor central en la red local</Text>

        <View style={styles.urlRow}>
          <TextInput
            style={styles.urlInput}
            value={backendUrl}
            onChangeText={setBackendUrl}
            placeholder="http://192.168.1.100:3000"
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.btnSave} onPress={handleSaveBackendUrl}>
            <Text style={styles.btnSaveText}>Guardar</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.btnHealth, testingHealth && styles.btnDisabled]}
          onPress={handleTestHealth}
          disabled={testingHealth}
        >
          {testingHealth ? (
            <ActivityIndicator color="#1e429f" size="small" />
          ) : (
            <Text style={styles.btnHealthText}>Probar Conexión con Servidor (/api/health)</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Sync Status Banner */}
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Text style={styles.statusTitle}>Estado de la Cola Outbox (RF-07)</Text>
          <StatusBadge
            label={stats.isSyncing ? 'Sincronizando' : stats.pendingCount === 0 ? 'Al Día' : 'Pendientes'}
            type={stats.isSyncing ? 'warning' : stats.pendingCount === 0 ? 'success' : 'warning'}
          />
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{stats.pendingCount}</Text>
            <Text style={styles.statLabel}>En Cola</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>
              {stats.lastSyncTimestamp ? new Date(stats.lastSyncTimestamp).toLocaleTimeString() : 'Nunca'}
            </Text>
            <Text style={styles.statLabel}>Última Sincronización</Text>
          </View>
        </View>

        {stats.lastError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>Último error: {stats.lastError}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.btnSync, (stats.isSyncing || stats.pendingCount === 0) && styles.btnDisabled]}
          onPress={handleForceSync}
          disabled={stats.isSyncing || stats.pendingCount === 0}
        >
          {stats.isSyncing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.btnSyncText}>Vaciar Cola Outbox (Sync Now)</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Outbox Items List */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Acciones en Cola Persistente ({outboxItems.length})</Text>
      </View>

      <FlatList
        data={outboxItems}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No hay acciones pendientes en la cola</Text>
            <Text style={styles.emptySub}>Todos los registros locales están sincronizados con el servidor.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemType}>{item.actionType}</Text>
              <StatusBadge
                label={item.status}
                type={item.status === 'completed' ? 'success' : item.status === 'failed' ? 'danger' : 'warning'}
              />
            </View>
            <Text style={styles.itemMeta}>ID Idempotente: {item.id}</Text>
            <Text style={styles.itemMeta}>Entidad: {item.entityId} • Reintentos: {item.retryCount}/{item.maxRetries}</Text>
            {item.lastError && <Text style={styles.itemError}>Error: {item.lastError}</Text>}
          </View>
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
  card: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  cardSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  urlRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  urlInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.borderDark,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    backgroundColor: '#fff',
  },
  btnSave: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnSaveText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  btnHealth: {
    backgroundColor: Colors.primaryLight,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  btnHealthText: {
    color: Colors.primaryDark,
    fontSize: 13,
    fontWeight: '700',
  },
  statusCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    margin: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: Spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  errorBanner: {
    backgroundColor: Colors.dangerBg,
    padding: 8,
    borderRadius: 6,
    marginBottom: Spacing.sm,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 12,
  },
  btnSync: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnSyncText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  listHeader: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  itemCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.sm,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xs,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemType: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  itemMeta: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  itemError: {
    fontSize: 11,
    color: Colors.danger,
    marginTop: 2,
  },
  emptyBox: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
});

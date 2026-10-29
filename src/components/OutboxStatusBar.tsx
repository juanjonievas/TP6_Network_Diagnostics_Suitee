import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SyncManager, SyncStats } from '../services/sync/syncManager';
import { Colors } from '../theme';

interface Props {
  onPress?: () => void;
}

export const OutboxStatusBar: React.FC<Props> = ({ onPress }) => {
  const [stats, setStats] = useState<SyncStats>({
    isSyncing: false,
    lastSyncTimestamp: null,
    lastSyncStatus: 'idle',
    pendingCount: 0,
  });

  useEffect(() => {
    const unsubscribe = SyncManager.addListener(setStats);
    return unsubscribe;
  }, []);

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.container}>
      <View style={styles.content}>
        <View style={styles.left}>
          <View style={[styles.indicator, stats.pendingCount > 0 ? styles.indicatorPending : styles.indicatorSynced]} />
          <Text style={styles.text}>
            {stats.isSyncing 
              ? 'Sincronizando con backend central...' 
              : stats.pendingCount > 0 
                ? `${stats.pendingCount} operaciones encoladas (Offline Outbox)` 
                : 'Cola sincronizada • Modo Offline Activo'}
          </Text>
        </View>
        <Text style={styles.actionText}>{stats.isSyncing ? 'Enviando...' : 'Ver Cola'}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1f2937',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  indicatorSynced: {
    backgroundColor: '#31c48d',
  },
  indicatorPending: {
    backgroundColor: '#f59e0b',
  },
  text: {
    color: '#f9fafb',
    fontSize: 12,
    fontWeight: '500',
  },
  actionText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '600',
  },
});

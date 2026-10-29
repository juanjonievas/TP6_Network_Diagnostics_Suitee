import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { SshService, PREDEFINED_SSH_COMMANDS } from '../services/ssh/sshService';
import { KeychainService } from '../services/security/keychainService';
import { LocalDatabase } from '../db/localDatabase';
import { SshDiagnosticResult } from '../types';
import { Colors, Spacing, Typography } from '../theme';

export const SSHDiagnosticScreen: React.FC = () => {
  const route = useRoute<any>();
  const initialIp = route.params?.device?.ip || '192.168.1.1';

  const [ip, setIp] = useState(initialIp);
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [hasStoredCreds, setHasStoredCreds] = useState(false);
  const [loading, setLoading] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string>('Esperando ejecución de comandos...\n');

  useEffect(() => {
    KeychainService.getSshCredentials(ip).then((creds) => {
      if (creds) {
        setUsername(creds.username);
        setPassword(creds.password || '');
        setHasStoredCreds(true);
      }
    });
  }, [ip]);

  const handleSaveToKeystore = async () => {
    if (!username || !password) {
      Alert.alert('Datos incompletos', 'Ingrese usuario y contraseña para resguardar en Keystore');
      return;
    }
    const ok = await KeychainService.saveSshCredentials(ip, username, password);
    if (ok) {
      setHasStoredCreds(true);
      Alert.alert('Keystore Seguro', `Credenciales para ${ip} cifradas en hardware Android Keystore (TEE/StrongBox).`);
    } else {
      Alert.alert('Aviso', 'No se pudieron almacenar las credenciales en Keystore');
    }
  };

  const handleRunCommand = async (command: string) => {
    setLoading(true);
    setTerminalOutput(prev => prev + `\n$ ${command}\n[Conectando a ${ip}:${port}...]`);

    try {
      const res = await SshService.executeCommand(ip, command, {
        port: parseInt(port, 10) || 22,
        username,
        password,
        timeoutMs: 8000,
        useMock: false, // Will attempt real SSH or fallback safely
      });

      setTerminalOutput(prev => prev + `\n${res.output}\n[Completado en ${res.durationMs}ms - ExitCode: ${res.exitCode}]\n`);
    } catch (err: any) {
      setTerminalOutput(prev => prev + `\n[ERROR]: ${err.message}\n`);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAllDiagnostics = async () => {
    setLoading(true);
    setTerminalOutput(`=== Sesión de Diagnóstico SSH iniciada para ${ip} ===\n`);

    try {
      const diagRes = await SshService.runPredefinedDiagnostics(ip, {
        port: parseInt(port, 10) || 22,
        username,
        password,
      });

      let out = '';
      for (const item of diagRes.commandResults) {
        out += `\n$ ${item.command} (${item.durationMs}ms)\n${item.output}\n`;
      }
      setTerminalOutput(out);

      await LocalDatabase.saveSshDiagnostic(diagRes);
    } catch (err: any) {
      setTerminalOutput(prev => prev + `\n[ERROR CRÍTICO]: ${err.message}\n`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* SSH Connection Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Conexión SSH Segura (RF-03)</Text>
          {hasStoredCreds && <Text style={styles.keystoreBadge}>🔐 Keystore Activo</Text>}
        </View>

        <View style={styles.row}>
          <View style={{ flex: 3, marginRight: Spacing.sm }}>
            <Text style={styles.label}>Host / IP</Text>
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
              placeholder="22"
              editable={!loading}
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={{ flex: 2, marginRight: Spacing.sm }}>
            <Text style={styles.label}>Usuario</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="admin"
              autoCapitalize="none"
              editable={!loading}
            />
          </View>
          <View style={{ flex: 2 }}>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              editable={!loading}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.btnKeystore} onPress={handleSaveToKeystore}>
          <Text style={styles.btnKeystoreText}>🔒 Cifrar y Guardar Credenciales en Keystore</Text>
        </TouchableOpacity>
      </View>

      {/* Predefined Commands Selector */}
      <View style={styles.commandsCard}>
        <Text style={styles.cardTitle}>Comandos de Diagnóstico Predefinidos</Text>
        <View style={styles.cmdGrid}>
          {PREDEFINED_SSH_COMMANDS.map(cmd => (
            <TouchableOpacity
              key={cmd.id}
              style={styles.cmdBtn}
              onPress={() => handleRunCommand(cmd.command)}
              disabled={loading}
            >
              <Text style={styles.cmdBtnTitle}>{cmd.name}</Text>
              <Text style={styles.cmdBtnCmd}>$ {cmd.command}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.btnRunAll, loading && styles.btnDisabled]}
          onPress={handleRunAllDiagnostics}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.btnRunAllText}>Ejecutar Diagnóstico Completo SSH</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Terminal Output */}
      <View style={styles.terminalContainer}>
        <View style={styles.terminalBar}>
          <View style={styles.terminalDots}>
            <View style={[styles.dot, { backgroundColor: '#ef4444' }]} />
            <View style={[styles.dot, { backgroundColor: '#f59e0b' }]} />
            <View style={[styles.dot, { backgroundColor: '#10b981' }]} />
          </View>
          <Text style={styles.terminalTitle}>SSH Terminal Session • {ip}</Text>
        </View>
        <ScrollView style={styles.terminalScroll} nestedScrollEnabled>
          <Text style={styles.terminalText}>{terminalOutput}</Text>
        </ScrollView>
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
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  keystoreBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.success,
    backgroundColor: Colors.successBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
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
  btnKeystore: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: Colors.borderDark,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  btnKeystoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  commandsCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  cmdGrid: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  cmdBtn: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
    borderRadius: 6,
  },
  cmdBtnTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  cmdBtnCmd: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  btnRunAll: {
    backgroundColor: '#7c3aed',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnRunAllText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  terminalContainer: {
    backgroundColor: '#111827',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#374151',
  },
  terminalBar: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  terminalDots: {
    flexDirection: 'row',
    gap: 6,
    marginRight: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  terminalTitle: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  terminalScroll: {
    maxHeight: 220,
    padding: 12,
  },
  terminalText: {
    color: '#4ade80',
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
});

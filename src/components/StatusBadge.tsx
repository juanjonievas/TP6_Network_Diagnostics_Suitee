import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme';

interface StatusBadgeProps {
  label: string;
  type?: 'success' | 'warning' | 'danger' | 'info';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ label, type = 'info' }) => {
  const getColors = () => {
    switch (type) {
      case 'success':
        return { bg: Colors.successBg, text: Colors.success };
      case 'warning':
        return { bg: Colors.warningBg, text: Colors.warning };
      case 'danger':
        return { bg: Colors.dangerBg, text: Colors.danger };
      default:
        return { bg: Colors.primaryLight, text: Colors.primaryDark };
    }
  };

  const c = getColors();

  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});

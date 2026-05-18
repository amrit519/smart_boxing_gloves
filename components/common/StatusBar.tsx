import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useAppSelector } from '@/store/hooks';
import { THEME_COLOR } from '@/constants/Colors';
import { useTheme } from '@/context/ThemeContext';
import { Colors } from '@/constants/Colors';

export function StatusBar() {
  const { isConnected, deviceName } = useAppSelector(state => state.connection);
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? Colors.dark : Colors.light;

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <View style={styles.statusRow}>
        <View style={styles.statusIndicator}>
          <View style={[
            styles.statusDot,
            { backgroundColor: isConnected ? THEME_COLOR : theme.secondary }
          ]} />
          <ThemedText style={styles.statusText}>{isConnected ? 'Connected' : 'Not Connected'}</ThemedText>
        </View>
        {deviceName && (
          <ThemedText style={styles.deviceName}>{deviceName}</ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 13,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  deviceName: {
    fontSize: 13,
    fontWeight: '500',
  },
}); 
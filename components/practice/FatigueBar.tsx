import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { getFatigueColor, getFatigueLabel } from '@/utils/fatigue';

interface FatigueBarProps {
  fatigue: number; // 0-100
}

export function FatigueBar({ fatigue }: FatigueBarProps) {
  const color = getFatigueColor(fatigue);
  const label = getFatigueLabel(fatigue);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>⚡ FATIGUE</ThemedText>
        <ThemedText style={[styles.percentage, { color }]}>{fatigue}%</ThemedText>
      </View>
      <View style={styles.barBackground}>
        <View
          style={[
            styles.barFill,
            {
              width: `${Math.min(fatigue, 100)}%`,
              backgroundColor: color,
            },
          ]}
        />
        {/* Battery-style segments */}
        {[20, 40, 60, 80].map(pos => (
          <View
            key={pos}
            style={[styles.segment, { left: `${pos}%` }]}
          />
        ))}
      </View>
      <ThemedText style={[styles.label, { color }]}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 12,
    opacity: 0.5,
    letterSpacing: 2,
    fontWeight: '600',
  },
  percentage: {
    fontSize: 16,
    fontWeight: '800',
  },
  barBackground: {
    height: 14,
    backgroundColor: 'rgba(150,150,150,0.15)',
    borderRadius: 7,
    overflow: 'hidden',
    position: 'relative',
  },
  barFill: {
    height: '100%',
    borderRadius: 7,
  },
  segment: {
    position: 'absolute',
    top: 0,
    width: 2,
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  label: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 1,
  },
});

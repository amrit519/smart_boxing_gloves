import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import Svg, { Circle } from 'react-native-svg';

interface CircularGaugeProps {
  value: number;
  maxValue: number;
  label: string;
  unit: string;
  color: string;
  size?: number;
}

export function CircularGauge({
  value,
  maxValue,
  label,
  unit,
  color,
  size = 110,
}: CircularGaugeProps) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / maxValue, 1);
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(150,150,150,0.15)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90, ${size / 2}, ${size / 2})`}
        />
      </Svg>
      <View style={styles.textContainer}>
        <ThemedText style={[styles.value, { color }]}>
          {Math.round(value)}
        </ThemedText>
        <ThemedText style={styles.unit}>{unit}</ThemedText>
        <ThemedText style={styles.label}>{label}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
  },
  textContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 32,
  },
  unit: {
    fontSize: 11,
    opacity: 0.5,
    marginTop: -2,
    fontWeight: '600',
  },
  label: {
    fontSize: 10,
    opacity: 0.4,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
});

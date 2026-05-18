import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { THEME_COLOR } from '@/constants/Colors';

interface RoundTimerProps {
  currentRound: number;
  totalRounds: number;
  formattedTime: string;
  isResting: boolean;
}

export function RoundTimer({
  currentRound,
  totalRounds,
  formattedTime,
  isResting,
}: RoundTimerProps) {
  return (
    <View style={styles.container}>
      <View style={styles.roundBadge}>
        <ThemedText style={styles.roundLabel}>
          {isResting ? 'REST' : `ROUND ${currentRound}`}
        </ThemedText>
        <ThemedText style={styles.roundOf}>
          {isResting ? `Next: Round ${currentRound + 1}` : `of ${totalRounds}`}
        </ThemedText>
      </View>
      <View style={[styles.timerContainer, isResting && styles.timerResting]}>
        <ThemedText style={[styles.timer, isResting && styles.timerTextResting]}>
          {formattedTime}
        </ThemedText>
      </View>
      {/* Round dots indicator */}
      <View style={styles.dotsContainer}>
        {Array.from({ length: totalRounds }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < currentRound && styles.dotCompleted,
              i === currentRound - 1 && !isResting && styles.dotActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  roundBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 4,
  },
  roundLabel: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: 3,
  },
  roundOf: {
    fontSize: 14,
    opacity: 0.5,
    fontWeight: '500',
  },
  timerContainer: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timerResting: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
  },
  timer: {
    fontSize: 56,
    lineHeight: 64,
    fontWeight: '800',
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  timerTextResting: {
    color: '#34C759',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(150,150,150,0.3)',
  },
  dotCompleted: {
    backgroundColor: THEME_COLOR,
  },
  dotActive: {
    backgroundColor: THEME_COLOR,
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
});

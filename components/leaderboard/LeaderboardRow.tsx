import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { LeaderboardEntry } from '@/types/database';
import { Colors } from '@/constants/Colors';

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  isDarkMode: boolean;
}

export function LeaderboardRow({ entry, isDarkMode }: LeaderboardRowProps) {
  const theme = isDarkMode ? Colors.dark : Colors.light;

  const getMedalColor = (rank: number): string | null => {
    if (rank === 1) return Colors.medals.gold;
    if (rank === 2) return Colors.medals.silver;
    if (rank === 3) return Colors.medals.bronze;
    return null;
  };

  const getMedalEmoji = (rank: number): string => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '';
  };

  const medalColor = getMedalColor(entry.rank);
  const isTopThree = entry.rank <= 3;

  return (
    <View style={[
      styles.row,
      { backgroundColor: theme.surface, borderColor: theme.border },
      isTopThree && { borderColor: medalColor || theme.border },
    ]}>
      <View style={styles.rankContainer}>
        {isTopThree ? (
          <ThemedText style={styles.medal}>{getMedalEmoji(entry.rank)}</ThemedText>
        ) : (
          <ThemedText style={[styles.rank, { color: theme.secondary }]}>
            {entry.rank}
          </ThemedText>
        )}
      </View>

      <View style={styles.info}>
        <View style={[styles.avatar, { backgroundColor: (medalColor || theme.primary) + '25' }]}>
          <ThemedText style={[styles.avatarText, { color: medalColor || theme.primary }]}>
            {entry.full_name.charAt(0).toUpperCase()}
          </ThemedText>
        </View>
        <View style={styles.nameContainer}>
          <ThemedText style={styles.name}>{entry.full_name}</ThemedText>
          <ThemedText style={[styles.sessions, { color: theme.secondary }]}>
            {entry.total_sessions} sessions
          </ThemedText>
        </View>
      </View>

      <View style={styles.stats}>
        <ThemedText style={styles.statValue}>
          {entry.total_punches.toLocaleString()}
        </ThemedText>
        <ThemedText style={[styles.statLabel, { color: theme.secondary }]}>
          punches
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  rankContainer: {
    width: 36,
    alignItems: 'center',
  },
  rank: {
    fontSize: 15,
    fontWeight: '600',
  },
  medal: {
    fontSize: 22,
  },
  info: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  nameContainer: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
  },
  sessions: {
    fontSize: 11,
    marginTop: 1,
  },
  stats: {
    alignItems: 'flex-end',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FF9500',
  },
  statLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

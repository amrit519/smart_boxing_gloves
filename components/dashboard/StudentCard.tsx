import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { LiveStudentData } from '@/types/database';
import { getFatigueColor } from '@/utils/fatigue';
import { Colors } from '@/constants/Colors';

interface StudentCardProps {
  student: LiveStudentData;
  isDarkMode: boolean;
  onViewDetail?: () => void;
}

function PulsingDot() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View style={[styles.liveDot, { opacity }]} />
  );
}

export function StudentCard({ student, isDarkMode, onViewDetail }: StudentCardProps) {
  const theme = isDarkMode ? Colors.dark : Colors.light;
  const fatigueColor = getFatigueColor(student.current_fatigue);

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.header}>
        <View style={styles.nameRow}>
          <View style={[styles.avatar, { backgroundColor: theme.primary + '30' }]}>
            <ThemedText style={[styles.avatarText, { color: theme.primary }]}>
              {student.full_name.charAt(0).toUpperCase()}
            </ThemedText>
          </View>
          <View>
            <ThemedText style={styles.name}>{student.full_name}</ThemedText>
            <View style={styles.statusRow}>
              {student.is_live ? (
                <>
                  <PulsingDot />
                  <ThemedText style={styles.liveText}>Live Now</ThemedText>
                </>
              ) : (
                <ThemedText style={[styles.offlineText, { color: theme.secondary }]}>
                  Offline
                </ThemedText>
              )}
            </View>
          </View>
        </View>
      </View>

      {student.is_live && (
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <ThemedText style={[styles.statLabel, { color: theme.secondary }]}>Round</ThemedText>
            <ThemedText style={styles.statValue}>{student.current_round}</ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.stat}>
            <ThemedText style={[styles.statLabel, { color: theme.secondary }]}>Speed</ThemedText>
            <ThemedText style={styles.statValue}>{student.current_speed} m/s</ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.stat}>
            <ThemedText style={[styles.statLabel, { color: theme.secondary }]}>Fatigue</ThemedText>
            <ThemedText style={[styles.statValue, { color: fatigueColor }]}>
              {student.current_fatigue}%
            </ThemedText>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[styles.detailButton, { borderColor: theme.primary }]}
        onPress={onViewDetail}
      >
        <ThemedText style={[styles.detailButtonText, { color: theme.primary }]}>
          View Detail
        </ThemedText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  header: {
    marginBottom: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759',
  },
  liveText: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: '600',
  },
  offlineText: {
    fontSize: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  statDivider: {
    width: 1,
    height: 28,
  },
  detailButton: {
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  detailButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

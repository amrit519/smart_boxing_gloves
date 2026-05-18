import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, THEME_COLOR } from '@/constants/Colors';
import { useTheme } from '@/context/ThemeContext';
import { LeaderboardRow } from '@/components/leaderboard/LeaderboardRow';
import { LeaderboardEntry } from '@/types/database';

// Mock leaderboard data
const MOCK_GLOBAL: LeaderboardEntry[] = [
  { user_id: '1', full_name: 'Vijay Kumar', avatar_url: null, total_punches: 12450, total_power: 890500, total_sessions: 45, rank: 1 },
  { user_id: '2', full_name: 'Arjun Singh', avatar_url: null, total_punches: 11200, total_power: 780000, total_sessions: 42, rank: 2 },
  { user_id: '3', full_name: 'Priya Sharma', avatar_url: null, total_punches: 10800, total_power: 720000, total_sessions: 38, rank: 3 },
  { user_id: '4', full_name: 'Rahul Verma', avatar_url: null, total_punches: 9500, total_power: 650000, total_sessions: 35, rank: 4 },
  { user_id: '5', full_name: 'Ananya Patel', avatar_url: null, total_punches: 8900, total_power: 610000, total_sessions: 32, rank: 5 },
  { user_id: '6', full_name: 'Deepak Kumar', avatar_url: null, total_punches: 8200, total_power: 580000, total_sessions: 30, rank: 6 },
  { user_id: '7', full_name: 'Simran Kaur', avatar_url: null, total_punches: 7600, total_power: 520000, total_sessions: 28, rank: 7 },
  { user_id: '8', full_name: 'Ravi Prasad', avatar_url: null, total_punches: 7100, total_power: 490000, total_sessions: 26, rank: 8 },
];

const MOCK_CLUB: LeaderboardEntry[] = [
  { user_id: '2', full_name: 'Arjun Singh', avatar_url: null, total_punches: 11200, total_power: 780000, total_sessions: 42, rank: 1 },
  { user_id: '3', full_name: 'Priya Sharma', avatar_url: null, total_punches: 10800, total_power: 720000, total_sessions: 38, rank: 2 },
  { user_id: '4', full_name: 'Rahul Verma', avatar_url: null, total_punches: 9500, total_power: 650000, total_sessions: 35, rank: 3 },
  { user_id: '6', full_name: 'Deepak Kumar', avatar_url: null, total_punches: 8200, total_power: 580000, total_sessions: 30, rank: 4 },
];

export default function LeaderboardScreen() {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? Colors.dark : Colors.light;
  const [activeTab, setActiveTab] = useState<'global' | 'club'>('global');

  const data = activeTab === 'global' ? MOCK_GLOBAL : MOCK_CLUB;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText style={{ fontSize: 32, marginBottom: 4 }}>🏆</ThemedText>
        <ThemedText style={[styles.title, { color: theme.text }]}>Leaderboard</ThemedText>
      </View>

      {/* Tab Switcher */}
      <View style={[styles.tabBar, { backgroundColor: theme.surface }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'global' && styles.tabActive]}
          onPress={() => setActiveTab('global')}
        >
          <ThemedText style={[
            styles.tabText,
            { color: theme.secondary },
            activeTab === 'global' && { color: THEME_COLOR },
          ]}>
            🌍 Global
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'club' && styles.tabActive]}
          onPress={() => setActiveTab('club')}
        >
          <ThemedText style={[
            styles.tabText,
            { color: theme.secondary },
            activeTab === 'club' && { color: THEME_COLOR },
          ]}>
            🏟️ Club
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Top 3 Podium */}
      {data.length >= 3 && (
        <View style={styles.podium}>
          {/* 2nd Place */}
          <View style={styles.podiumItem}>
            <View style={[styles.podiumAvatar, { backgroundColor: Colors.medals.silver + '30', borderColor: Colors.medals.silver }]}>
              <ThemedText style={styles.podiumAvatarText}>
                {data[1].full_name.charAt(0)}
              </ThemedText>
            </View>
            <ThemedText style={{ fontSize: 18 }}>🥈</ThemedText>
            <ThemedText style={[styles.podiumName, { color: theme.text }]} numberOfLines={1}>
              {data[1].full_name.split(' ')[0]}
            </ThemedText>
            <ThemedText style={[styles.podiumPunches, { color: Colors.medals.silver }]}>
              {(data[1].total_punches / 1000).toFixed(1)}K
            </ThemedText>
          </View>

          {/* 1st Place */}
          <View style={[styles.podiumItem, styles.podiumFirst]}>
            <View style={[styles.podiumAvatar, styles.podiumAvatarFirst, { backgroundColor: Colors.medals.gold + '30', borderColor: Colors.medals.gold }]}>
              <ThemedText style={[styles.podiumAvatarText, { fontSize: 22 }]}>
                {data[0].full_name.charAt(0)}
              </ThemedText>
            </View>
            <ThemedText style={{ fontSize: 24 }}>🥇</ThemedText>
            <ThemedText style={[styles.podiumName, { color: theme.text, fontWeight: '800' }]} numberOfLines={1}>
              {data[0].full_name.split(' ')[0]}
            </ThemedText>
            <ThemedText style={[styles.podiumPunches, { color: Colors.medals.gold }]}>
              {(data[0].total_punches / 1000).toFixed(1)}K
            </ThemedText>
          </View>

          {/* 3rd Place */}
          <View style={styles.podiumItem}>
            <View style={[styles.podiumAvatar, { backgroundColor: Colors.medals.bronze + '30', borderColor: Colors.medals.bronze }]}>
              <ThemedText style={styles.podiumAvatarText}>
                {data[2].full_name.charAt(0)}
              </ThemedText>
            </View>
            <ThemedText style={{ fontSize: 18 }}>🥉</ThemedText>
            <ThemedText style={[styles.podiumName, { color: theme.text }]} numberOfLines={1}>
              {data[2].full_name.split(' ')[0]}
            </ThemedText>
            <ThemedText style={[styles.podiumPunches, { color: Colors.medals.bronze }]}>
              {(data[2].total_punches / 1000).toFixed(1)}K
            </ThemedText>
          </View>
        </View>
      )}

      {/* Full Rankings */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
        {data.slice(3).map(entry => (
          <LeaderboardRow key={entry.user_id} entry={entry} isDarkMode={isDarkMode} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: 'center', paddingTop: 8 },
  title: { fontSize: 24, fontWeight: '800' },
  tabBar: { flexDirection: 'row', marginHorizontal: 20, borderRadius: 12, marginVertical: 12, padding: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  tabActive: { backgroundColor: 'rgba(255,59,48,0.1)' },
  tabText: { fontSize: 14, fontWeight: '600' },
  podium: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 20, marginBottom: 16 },
  podiumItem: { alignItems: 'center', flex: 1 },
  podiumFirst: { marginBottom: 12 },
  podiumAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2, marginBottom: 4 },
  podiumAvatarFirst: { width: 56, height: 56, borderRadius: 28 },
  podiumAvatarText: { fontSize: 18, fontWeight: '800' },
  podiumName: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  podiumPunches: { fontSize: 13, fontWeight: '800', marginTop: 1 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 30 },
});

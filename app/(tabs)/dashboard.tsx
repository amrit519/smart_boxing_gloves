import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, THEME_COLOR } from '@/constants/Colors';
import { useTheme } from '@/context/ThemeContext';
import { StudentCard } from '@/components/dashboard/StudentCard';
import { LiveStudentData } from '@/types/database';

// Mock data for prototype
const MOCK_STUDENTS: LiveStudentData[] = [
  { user_id: '1', full_name: 'Arjun Singh', avatar_url: null, is_live: true, current_round: 2, current_speed: 18.5, current_fatigue: 25, session_id: 's1' },
  { user_id: '2', full_name: 'Priya Sharma', avatar_url: null, is_live: true, current_round: 3, current_speed: 14.2, current_fatigue: 55, session_id: 's2' },
  { user_id: '3', full_name: 'Rahul Verma', avatar_url: null, is_live: false, current_round: 0, current_speed: 0, current_fatigue: 0, session_id: null },
  { user_id: '4', full_name: 'Ananya Patel', avatar_url: null, is_live: true, current_round: 1, current_speed: 21.0, current_fatigue: 10, session_id: 's3' },
  { user_id: '5', full_name: 'Vikram Reddy', avatar_url: null, is_live: false, current_round: 0, current_speed: 0, current_fatigue: 0, session_id: null },
  { user_id: '6', full_name: 'Deepak Kumar', avatar_url: null, is_live: true, current_round: 4, current_speed: 11.0, current_fatigue: 78, session_id: 's4' },
];

const MOCK_CLUBS = ['All Clubs', 'Mumbai Boxing Academy', 'Delhi Fight Club', 'Pune Warriors'];

export default function DashboardScreen() {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? Colors.dark : Colors.light;
  const [selectedClub, setSelectedClub] = useState(0);
  const [activeTab, setActiveTab] = useState<'students' | 'ranking'>('students');

  const liveCount = MOCK_STUDENTS.filter(s => s.is_live).length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText style={[styles.title, { color: theme.text }]}>Coach Dashboard</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.secondary }]}>
          {liveCount} athlete training now
        </ThemedText>
      </View>

      {/* Club Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.clubScroll} contentContainerStyle={styles.clubScrollContent}>
        {MOCK_CLUBS.map((club, idx) => (
          <TouchableOpacity
            key={club}
            style={[
              styles.clubChip,
              { borderColor: theme.border },
              selectedClub === idx && { backgroundColor: THEME_COLOR, borderColor: THEME_COLOR },
            ]}
            onPress={() => setSelectedClub(idx)}
          >
            <ThemedText style={[
              styles.clubChipText,
              { color: theme.secondary },
              selectedClub === idx && { color: '#fff' },
            ]}>
              {club}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab Switcher */}
      <View style={[styles.tabBar, { backgroundColor: theme.surface }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'students' && styles.tabActive]}
          onPress={() => setActiveTab('students')}
        >
          <ThemedText style={[
            styles.tabText,
            { color: theme.secondary },
            activeTab === 'students' && { color: THEME_COLOR },
          ]}>
            Athletes
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'ranking' && styles.tabActive]}
          onPress={() => setActiveTab('ranking')}
        >
          <ThemedText style={[
            styles.tabText,
            { color: theme.secondary },
            activeTab === 'ranking' && { color: THEME_COLOR },
          ]}>
            Club Ranking
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
        {activeTab === 'students' ? (
          <>
            {/* Live athletes first */}
            {MOCK_STUDENTS.filter(s => s.is_live).length > 0 && (
              <View style={styles.section}>
                <ThemedText style={[styles.sectionTitle, { color: theme.accent }]}>
                  🟢 Live Now
                </ThemedText>
                {MOCK_STUDENTS.filter(s => s.is_live).map(student => (
                  <StudentCard
                    key={student.user_id}
                    student={student}
                    isDarkMode={isDarkMode}
                  />
                ))}
              </View>
            )}
            {/* Offline athletes */}
            {MOCK_STUDENTS.filter(s => !s.is_live).length > 0 && (
              <View style={styles.section}>
                <ThemedText style={[styles.sectionTitle, { color: theme.secondary }]}>
                  Offline
                </ThemedText>
                {MOCK_STUDENTS.filter(s => !s.is_live).map(student => (
                  <StudentCard
                    key={student.user_id}
                    student={student}
                    isDarkMode={isDarkMode}
                  />
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              🏆 Club Rankings
            </ThemedText>
            {MOCK_STUDENTS
              .sort((a, b) => b.current_speed - a.current_speed)
              .map((student, idx) => (
                <View key={student.user_id} style={[styles.rankRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <ThemedText style={[styles.rankNum, { color: idx < 3 ? THEME_COLOR : theme.secondary }]}>
                    {idx < 3 ? ['🥇', '🥈', '🥉'][idx] : `#${idx + 1}`}
                  </ThemedText>
                  <ThemedText style={[styles.rankName, { color: theme.text }]}>
                    {student.full_name}
                  </ThemedText>
                  <ThemedText style={[styles.rankStat, { color: theme.accent }]}>
                    {student.current_speed} m/s
                  </ThemedText>
                </View>
              ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 2 },
  clubScroll: { maxHeight: 48, marginVertical: 8 },
  clubScrollContent: { paddingHorizontal: 16, gap: 8 },
  clubChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  clubChipText: { fontSize: 13, fontWeight: '600' },
  tabBar: { flexDirection: 'row', marginHorizontal: 20, borderRadius: 12, marginBottom: 12, padding: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  tabActive: { backgroundColor: 'rgba(255,59,48,0.1)' },
  tabText: { fontSize: 14, fontWeight: '600' },
  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 20, paddingBottom: 30 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10, letterSpacing: 0.5 },
  rankRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 6, borderWidth: 1 },
  rankNum: { width: 36, fontSize: 16, fontWeight: '700' },
  rankName: { flex: 1, fontSize: 14, fontWeight: '600' },
  rankStat: { fontSize: 14, fontWeight: '700' },
});

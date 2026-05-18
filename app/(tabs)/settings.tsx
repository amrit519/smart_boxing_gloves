import React from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, THEME_COLOR } from '@/constants/Colors';
import { useTheme } from '@/context/ThemeContext';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { logout } from '@/store/slices/authSlice';        

export default function ProfileScreen() {
  const { isDarkMode, toggleTheme } = useTheme();
  const theme = isDarkMode ? Colors.dark : Colors.light;
  const dispatch = useAppDispatch();
  const { profile, user } = useAppSelector(state => state.auth);
  const { isConnected, deviceName } = useAppSelector(state => state.connection);

  const displayName = profile?.full_name || 'Fighter';
  const role = profile?.role || 'player';

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => dispatch(logout()) },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={[styles.avatar, { backgroundColor: THEME_COLOR + '25' }]}>
            <ThemedText style={[styles.avatarText, { color: THEME_COLOR }]}>
              {displayName.charAt(0).toUpperCase()}
            </ThemedText>
          </View>
          <ThemedText style={[styles.name, { color: theme.text }]}>{displayName}</ThemedText>
          <View style={[styles.roleBadge, { backgroundColor: role === 'coach' ? '#FF9500' + '20' : THEME_COLOR + '20' }]}>
            <ThemedText style={[styles.roleText, { color: role === 'coach' ? '#FF9500' : THEME_COLOR }]}>
              {role === 'coach' ? '📋 Coach' : '🥊 Player'}
            </ThemedText>
          </View>
        </View>

        {/* Info Cards */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Account</ThemedText>
          <View style={styles.cardRow}>
            <ThemedText style={[styles.cardLabel, { color: theme.secondary }]}>Phone</ThemedText>
            <ThemedText style={[styles.cardValue, { color: theme.text }]}>{user?.phone || 'N/A'}</ThemedText>
          </View>
          <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />
          <View style={styles.cardRow}>
            <ThemedText style={[styles.cardLabel, { color: theme.secondary }]}>Role</ThemedText>
            <ThemedText style={[styles.cardValue, { color: theme.text }]}>{role}</ThemedText>
          </View>
          <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />
          <View style={styles.cardRow}>
            <ThemedText style={[styles.cardLabel, { color: theme.secondary }]}>IMEI</ThemedText>
            <ThemedText style={[styles.cardValue, { color: theme.text }]}>{profile?.imei_number || 'Not set'}</ThemedText>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Device</ThemedText>
          <View style={styles.cardRow}>
            <ThemedText style={[styles.cardLabel, { color: theme.secondary }]}>Status</ThemedText>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: isConnected ? theme.success : theme.secondary }]} />
              <ThemedText style={[styles.cardValue, { color: isConnected ? theme.success : theme.secondary }]}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </ThemedText>
            </View>
          </View>
          {isConnected && (
            <>
              <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />
              <View style={styles.cardRow}>
                <ThemedText style={[styles.cardLabel, { color: theme.secondary }]}>Device Name</ThemedText>
                <ThemedText style={[styles.cardValue, { color: theme.text }]}>{deviceName || 'Unknown'}</ThemedText>
              </View>
            </>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Preferences</ThemedText>
          <TouchableOpacity style={styles.cardRow} onPress={toggleTheme}>
            <ThemedText style={[styles.cardLabel, { color: theme.secondary }]}>Theme</ThemedText>
            <ThemedText style={[styles.cardValue, { color: theme.text }]}>
              {isDarkMode ? '🌙 Dark' : '☀️ Light'}
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={[styles.logoutButton, { borderColor: theme.danger }]} onPress={handleLogout}>
          <ThemedText style={[styles.logoutText, { color: theme.danger }]}>Logout</ThemedText>
        </TouchableOpacity>

        <ThemedText style={[styles.version, { color: theme.secondary }]}>FightApp v1.0.0 • Prototype</ThemedText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  profileHeader: { alignItems: 'center', marginBottom: 24, paddingTop: 8 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: '800' },
  name: { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  roleBadge: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 12 },
  roleText: { fontSize: 13, fontWeight: '700' },
  card: { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  cardLabel: { fontSize: 14 },
  cardValue: { fontSize: 14, fontWeight: '600' },
  cardDivider: { height: 1, marginVertical: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  logoutButton: { paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', marginTop: 8 },
  logoutText: { fontSize: 15, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: 12, marginTop: 16 },
});
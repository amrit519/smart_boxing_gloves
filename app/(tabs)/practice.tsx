import React, { useState, useEffect, useRef, useContext } from 'react';
import { StyleSheet, View, TouchableOpacity, Modal, Alert, TextInput, Button } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, THEME_COLOR } from '@/constants/Colors';
import { useTheme } from '@/context/ThemeContext';
import { CircularGauge } from '@/components/practice/CircularGauge';
import { FatigueBar } from '@/components/practice/FatigueBar';
import { RoundTimer } from '@/components/practice/RoundTimer';
import { usePracticeSession } from '@/hooks/usePracticeSession';
import { useMockGloveData } from '@/hooks/useMockGloveData';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { dismissFatigueAlert } from '@/store/slices/practiceSlice';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { useHardware } from "../../context/sethardware";




export default function PracticeScreen() {
  const { isDarkMode } = useTheme();    
  const theme = isDarkMode ? Colors.dark : Colors.light;
  const dispatch = useAppDispatch();

  const { hardwareData } = useHardware();
  const [useMockData, setUseMockData] = useState(true);

  // Stores the summary of the most recently completed session for display
  const [lastSessionSummary, setLastSessionSummary] = useState<{
    dataSource: string;
    totalPunches: number;
    peakSpeed: number;
    peakForce: number;
    avgSpeed: number;
    avgForce: number;
    totalReadings: number;
    roundStats: any[];
    timestamp: string;
  } | null>(null);
  const [rounds, setRounds] = useState(4);
  const [roundDuration, setRoundDuration] = useState(180);
  const [restDuration, setRestDuration] = useState(60);
  const formatSeconds = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }; 
 
  // --- LIVE BLE SESSION ACCUMULATOR ---
  // This ref stores running stats from real Bluetooth data during a session.
  // Using a ref means updates never cause re-renders (performance-safe).
  const liveBleAccumulator = useRef({
    totalPunches: 0,
    peakSpeed: 0,
    peakForce: 0,
    totalSpeed: 0,
    totalForce: 0,
    readingCount: 0,
    punchTypes: {} as Record<string, number>, // e.g. { hook: 5, jab: 3 }
    dataPoints: [] as Array<{ speed: number; force: number; punch: number; timestamp: string }>,
  });

  const {
    isSessionActive,
    currentRound,
    totalRounds,
    formattedTime,
    isResting,
    totalPunches,
    currentSpeed,
    currentPower,
    averageSpeed,
    fatigueLevel,
    showFatigueAlert,
    roundStats,
    startSession,
    endSession,
  } = usePracticeSession();

  // Mock data generator – enable during session (only when useMockData is ON)
  useMockGloveData(useMockData && isSessionActive);

  // --- ACCUMULATE REAL BLE DATA WHILE SESSION IS ACTIVE ---
  // Every time hardwareData changes (new BLE packet arrives) during a live
  // session with mock data OFF, we update our running totals in the ref.
  useEffect(() => {
    if (!isSessionActive || useMockData) return;

    const { speed, punch, power } = hardwareData;

    // Only record if we got a real, non-zero reading
    if (punch === 0 && power === 0) return;

    const acc = liveBleAccumulator.current;

    // Detect a new punch: punch count only ever increases from the ESP32`
    if (punch > acc.totalPunches) {
      acc.totalPunches = punch;
    }

    acc.peakSpeed  = Math.max(acc.peakSpeed, speed);
    acc.peakForce  = Math.max(acc.peakForce, power);
    acc.totalSpeed += speed;
    acc.totalForce += power;
    acc.readingCount += 1;

    // Log a snapshot every reading for the detailed history
    acc.dataPoints.push({
      speed:speed,
      force: power,
      punch,
      timestamp: new Date().toISOString(),
    });
  }, [hardwareData, isSessionActive, useMockData]);

  // --- SAVE SESSION TO ASYNCSTORAGE (GROUPED BY DATE & DAY) ---
  const handleEndAndSaveSession = async () => {
    if (isSessionActive) {
      const dateObj = new Date();
      const dateString = dateObj.toISOString().split('T')[0]; // "2026-05-12"
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' }); // "Tuesday"

      const acc = liveBleAccumulator.current;
      const avgSpeed = acc.readingCount > 0 ? acc.totalSpeed / acc.readingCount : 0;
      const avgForce = acc.readingCount > 0 ? acc.totalForce / acc.readingCount : 0;

      // Build the session object with REAL BLE accumulated data
      const sessionToSave = {
        id: Date.now().toString(),
        timestamp: dateObj.toISOString(),
        dataSource: useMockData ? 'mock' : 'bluetooth', // Track where data came from

        // --- Real Bluetooth summary stats ---
        bluetoothStats: {
          totalPunches: acc.totalPunches,          // Final punch count from ESP32
          peakSpeed:    parseFloat(acc.peakSpeed.toFixed(2)),  // Fastest punch (m/s)
          peakForce:    parseFloat(acc.peakForce.toFixed(2)),  // Strongest punch (N)
          avgSpeed:     parseFloat(avgSpeed.toFixed(2)),
          avgForce:     parseFloat(avgForce.toFixed(2)),
          totalReadings: acc.readingCount,
          dataPoints:   acc.dataPoints,            // Full time-series for charts
        },

        // --- Redux/mock session stats (round-by-round) ---
        roundStats: roundStats,

        // Last BLE hardware snapshot
        finalHardwareState: {
          speed: hardwareData.speed,
          punch: hardwareData.punch,
          power: hardwareData.power,
        },
      };

      try {
        const existingData = await AsyncStorage.getItem('boxing_sessions_grouped');
        let sessionsList: any[] = existingData ? JSON.parse(existingData) : [];

        if (!Array.isArray(sessionsList)) sessionsList = [];

        // Find if there is already a group for today
        const existingDateIndex = sessionsList.findIndex((item: any) => item.date === dateString);

        if (existingDateIndex >= 0) {
          // Today's group exists → just append
          sessionsList[existingDateIndex].sessions.push(sessionToSave);
        } else {
          // New day → create a new date group
          sessionsList.push({
            date: dateString,
            day: dayName,
            sessions: [sessionToSave],
          });
        }

        await AsyncStorage.setItem('boxing_sessions_grouped', JSON.stringify(sessionsList));
        console.log(`[Session Saved] ${dayName} ${dateString} | Source: ${sessionToSave.dataSource} | Punches: ${acc.totalPunches}`);
      } catch (error) {
        console.error("Failed to save session to AsyncStorage", error);
      }

      // Snapshot the summary into state so the UI can display it
      setLastSessionSummary({
        dataSource: useMockData ? 'mock' : 'bluetooth',
        totalPunches: acc.totalPunches,
        peakSpeed: parseFloat(acc.peakSpeed.toFixed(2)),
        peakForce: parseFloat(acc.peakForce.toFixed(2)),
        avgSpeed: parseFloat(avgSpeed.toFixed(2)),
        avgForce: parseFloat(avgForce.toFixed(2)),
        totalReadings: acc.readingCount,
        roundStats: roundStats,
        timestamp: dateObj.toISOString(),
      });

      // Reset the accumulator for the next session
      liveBleAccumulator.current = {
        totalPunches: 0,
        peakSpeed: 0,
        peakForce: 0,
        totalSpeed: 0,
        totalForce: 0,
        readingCount: 0,
        punchTypes: {},
        dataPoints: [],
      };
    }
    endSession();
  };


  const handleStart = () => {
    // Reset accumulator fresh every time a new session starts
    liveBleAccumulator.current = {
      totalPunches: 0,
      peakSpeed: 0,
      peakForce: 0,
      totalSpeed: 0,
      totalForce: 0,
      readingCount: 0,
      punchTypes: {},
      dataPoints: [],
    };
    startSession({ totalRounds: rounds, roundDuration, restDuration });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {!isSessionActive ? (
        /* Pre-session screen */
        <View style={styles.preSession}>
          <ThemedText style={{ fontSize: 56, marginBottom: 16 }}>🥊</ThemedText>
          <ThemedText style={[styles.preTitle, { color: theme.text }]}>
            Ready to Train?
          </ThemedText>
          {/* Session Config */}
          <View style={{ marginBottom: 20, alignItems: 'center' }}>
            <ThemedText style={{ color: theme.secondary, fontSize: 14 }}>Live Hardware Stats</ThemedText>
            <ThemedText style={{ color: theme.text, fontWeight: '700' }}>
              Speed: {hardwareData.speed}
            </ThemedText>
          </View>
          
          <View style={[styles.configCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.configRow, styles.stepperRow]}>
              <ThemedText style={[styles.configLabel, { color: theme.secondary }]}>Rounds</ThemedText>
              <View style={styles.stepperControls}>
                <TouchableOpacity style={[styles.stepperButton, { borderColor: theme.border }]} onPress={() => setRounds(r => Math.max(1, r - 1))} disabled={rounds <= 1}>
                  <ThemedText style={[styles.stepperButtonText, { color: rounds <= 1 ? theme.secondary : theme.text }]}>-</ThemedText>
                </TouchableOpacity>
                <ThemedText style={[styles.configValue, { color: theme.text }]}>{rounds}</ThemedText>
                <TouchableOpacity style={[styles.stepperButton, { borderColor: theme.border }]} onPress={() => setRounds(r => Math.min(20, r + 1))}>
                  <ThemedText style={[styles.stepperButtonText, { color: theme.text }]}>+</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
            <View style={[styles.configDivider, { backgroundColor: theme.border }]} />
            <View style={[styles.configRow, styles.stepperRow]}>
              <ThemedText style={[styles.configLabel, { color: theme.secondary }]}>Round Duration</ThemedText>
              <View style={styles.stepperControls}>
                <TouchableOpacity style={[styles.stepperButton, { borderColor: theme.border }]} onPress={() => setRoundDuration(d => Math.max(30, d - 30))} disabled={roundDuration <= 30}>
                  <ThemedText style={[styles.stepperButtonText, { color: roundDuration <= 30 ? theme.secondary : theme.text }]}>-</ThemedText>
                </TouchableOpacity>
                <ThemedText style={[styles.configValue, { color: theme.text }]}>{formatSeconds(roundDuration)}</ThemedText>
                <TouchableOpacity style={[styles.stepperButton, { borderColor: theme.border }]} onPress={() => setRoundDuration(d => Math.min(600, d + 30))}>
                  <ThemedText style={[styles.stepperButtonText, { color: theme.text }]}>+</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
            <View style={[styles.configDivider, { backgroundColor: theme.border }]} />
            <View style={[styles.configRow, styles.stepperRow]}>
              <ThemedText style={[styles.configLabel, { color: theme.secondary }]}>Rest Period</ThemedText>
              <View style={styles.stepperControls}>
                <TouchableOpacity style={[styles.stepperButton, { borderColor: theme.border }]} onPress={() => setRestDuration(d => Math.max(10, d - 10))} disabled={restDuration <= 10}>
                  <ThemedText style={[styles.stepperButtonText, { color: restDuration <= 10 ? theme.secondary : theme.text }]}>-</ThemedText>
                </TouchableOpacity>
                <ThemedText style={[styles.configValue, { color: theme.text }]}>{formatSeconds(restDuration)}</ThemedText>
                <TouchableOpacity style={[styles.stepperButton, { borderColor: theme.border }]} onPress={() => setRestDuration(d => Math.min(300, d + 10))}>
                  <ThemedText style={[styles.stepperButtonText, { color: theme.text }]}>+</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Mock data toggle */}
          <TouchableOpacity
            style={[styles.mockToggle, { borderColor: theme.border }]}
            onPress={() => setUseMockData(!useMockData)}
          >
            <ThemedText style={[styles.mockToggleText, { color: theme.secondary }]}>
              {useMockData ? '🔄 Mock Data: ON' : '📡 Real Bluetooth Data'}
            </ThemedText>
          </TouchableOpacity>

         


          <TouchableOpacity style={styles.startButton} onPress={handleStart}>
            <ThemedText style={styles.startButtonText}> 🔔 START SESSION</ThemedText>
          </TouchableOpacity>

          {/* Last Session Summary — shows after any session ends */}
          {lastSessionSummary && (
            <View style={[styles.historyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>

              {/* Header row: title + data source badge */}
              <View style={styles.summaryHeader}>
                <ThemedText style={[styles.historyTitle, { color: theme.text }]}>Last Session Summary</ThemedText>
                <View style={[
                  styles.sourceBadge,
                  { backgroundColor: lastSessionSummary.dataSource === 'bluetooth' ? '#1a3a2a' : '#2a2a1a' }
                ]}>
                  <ThemedText style={[styles.sourceBadgeText, { color: lastSessionSummary.dataSource === 'bluetooth' ? '#4ade80' : '#facc15' }]}>
                    {lastSessionSummary.dataSource === 'bluetooth' ? '📡 Bluetooth' : '🔄 Mock'}
                  </ThemedText>
                </View>
              </View>

              {/* Timestamp */}
              <ThemedText style={[styles.summaryTimestamp, { color: theme.secondary }]}>
                {new Date(lastSessionSummary.timestamp).toLocaleString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit'
                })}
              </ThemedText>

              {/* BLE Stats grid — only meaningful when real bluetooth was used */}
              {lastSessionSummary.dataSource === 'bluetooth' && lastSessionSummary.totalReadings > 0 && (
                <>
                  <View style={[styles.statsDivider, { backgroundColor: theme.border }]} />
                  <ThemedText style={[styles.statsSectionLabel, { color: theme.secondary }]}>📊 BLUETOOTH STATS</ThemedText>
                  <View style={styles.statsGrid}>
                    <View style={[styles.statBox, { backgroundColor: theme.surfaceContainer }]}>
                      <ThemedText style={[styles.statBoxValue, { color: THEME_COLOR }]}>{lastSessionSummary.totalPunches}</ThemedText>
                      <ThemedText style={[styles.statBoxLabel, { color: theme.secondary }]}>Total Punches</ThemedText>
                    </View>
                    <View style={[styles.statBox, { backgroundColor: theme.surfaceContainer }]}>
                      <ThemedText style={[styles.statBoxValue, { color: '#FF9500' }]}>{lastSessionSummary.peakSpeed} m/s</ThemedText>
                      <ThemedText style={[styles.statBoxLabel, { color: theme.secondary }]}>Peak Speed</ThemedText>
                    </View>
                    <View style={[styles.statBox, { backgroundColor: theme.surfaceContainer }]}>
                      <ThemedText style={[styles.statBoxValue, { color: '#5856D6' }]}>{lastSessionSummary.peakForce} N</ThemedText>
                      <ThemedText style={[styles.statBoxLabel, { color: theme.secondary }]}>Peak Force</ThemedText>
                    </View>
                    <View style={[styles.statBox, { backgroundColor: theme.surfaceContainer }]}>
                      <ThemedText style={[styles.statBoxValue, { color: '#FF9500' }]}>{lastSessionSummary.avgSpeed} m/s</ThemedText>
                      <ThemedText style={[styles.statBoxLabel, { color: theme.secondary }]}>Avg Speed</ThemedText>
                    </View>
                    <View style={[styles.statBox, { backgroundColor: theme.surfaceContainer }]}>
                      <ThemedText style={[styles.statBoxValue, { color: '#5856D6' }]}>{lastSessionSummary.avgForce} N</ThemedText>
                      <ThemedText style={[styles.statBoxLabel, { color: theme.secondary }]}>Avg Force</ThemedText>
                    </View>
                    <View style={[styles.statBox, { backgroundColor: theme.surfaceContainer }]}>
                      <ThemedText style={[styles.statBoxValue, { color: theme.text }]}>{lastSessionSummary.totalReadings}</ThemedText>
                      <ThemedText style={[styles.statBoxLabel, { color: theme.secondary }]}>BLE Readings</ThemedText>
                    </View>
                  </View>
                </>
              )}

              {/* Round-by-round breakdown */}
              {lastSessionSummary.roundStats.length > 0 && (
                <>
                  <View style={[styles.statsDivider, { backgroundColor: theme.border }]} />
                  <ThemedText style={[styles.statsSectionLabel, { color: theme.secondary }]}>🥊 ROUND BREAKDOWN</ThemedText>
                  <View style={styles.roundHeaderRow}>
                    <ThemedText style={[styles.roundHeaderCell, { color: theme.secondary }]}>RND</ThemedText>
                    <ThemedText style={[styles.roundHeaderCell, { color: theme.secondary }]}>PUNCHES</ThemedText>
                    <ThemedText style={[styles.roundHeaderCell, { color: theme.secondary }]}>SPD</ThemedText>
                    <ThemedText style={[styles.roundHeaderCell, { color: theme.secondary }]}>FATIGUE</ThemedText>
                  </View>
                  {lastSessionSummary.roundStats.map((round: any) => (
                    <View key={round.id} style={[styles.historyRow, { borderTopWidth: 1, borderTopColor: theme.border + '40' }]}>
                      <ThemedText style={[styles.historyRound, { color: THEME_COLOR }]}>R{round.round_number}</ThemedText>
                      <ThemedText style={[styles.historyStat, { color: theme.text }]}>{round.punch_count}</ThemedText>
                      <ThemedText style={[styles.historyStat, { color: '#FF9500' }]}>{round.avg_speed} m/s</ThemedText>
                      <ThemedText style={[styles.historyStat, { color: '#5856D6' }]}>{round.fatigue_level}%</ThemedText>
                    </View>
                  ))}
                </>
              )}
            </View>
          )}
        </View>
      ) : (
        /* Active session HUD */
        <View style={styles.hud}>
          {/* Round Timer */}
          <RoundTimer
            currentRound={currentRound}
            totalRounds={totalRounds}
            formattedTime={formattedTime}
            isResting={isResting}
          />

          {/* Gauges */}
          <View style={styles.gaugesRow}>
            <CircularGauge
              value={hardwareData.speed || currentSpeed }
              maxValue={30}
              label="Speed"
              unit="m/s"
              color="#FF9500"
            />
            <CircularGauge
              value={hardwareData.punch || totalPunches}
              maxValue={500}
              label="Punches"
              unit="total"
              color={THEME_COLOR}
              size={130}
            />
            <CircularGauge
              value={hardwareData.power || currentPower}
              maxValue={120}
              label="Power"
              unit="kg"
              color="#5856D6"
            />
          </View>

          {/* Average speed indicator */}
          <View style={styles.avgRow}>
            <ThemedText style={[styles.avgLabel, { color: theme.secondary }]}>
              AVG SPEED
            </ThemedText>
            <ThemedText style={[styles.avgValue, { color: '#FF9500' }]}>
              {averageSpeed.toFixed(1)} m/s
            </ThemedText>
          </View>

          {/* Fatigue Bar */}
          <FatigueBar fatigue={fatigueLevel} />

          {/* End Session Button */}
          <View style={styles.hudFooter}>
            <TouchableOpacity
              style={[styles.endButton, { borderColor: theme.danger }]}
              onPress={handleEndAndSaveSession}
            >
              <ThemedText style={[styles.endButtonText, { color: theme.danger }]}>
                ⏹ END SESSION
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Fatigue Alert Modal */}
      <Modal visible={showFatigueAlert} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.alertCard, { backgroundColor: theme.surfaceContainer }]}>
            <ThemedText style={{ fontSize: 44, marginBottom: 8 }}>⚠️</ThemedText>
            <ThemedText style={[styles.alertTitle, { color: theme.danger }]}>
              Performance Dropping!
            </ThemedText>
            <ThemedText style={[styles.alertMessage, { color: theme.text }]}>
              Your fatigue level has exceeded 80%.{'\n'}Consider taking a rest.
            </ThemedText>
            <TouchableOpacity
              style={[styles.alertButton, { backgroundColor: theme.primary }]}
              onPress={() => dispatch(dismissFatigueAlert())}
            >
              <ThemedText style={styles.alertButtonText}>Got it, Keep Going 💪</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Pre-session
  preSession: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
  preTitle: { fontSize: 26, lineHeight: 34, fontWeight: '800', marginBottom: 8, letterSpacing: -0.5, paddingVertical: 4 },
  preSubtitle: { fontSize: 15, textAlign: 'center', marginBottom: 28 },
  configCard: { width: '100%', borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 16 },
  configRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  stepperRow: { paddingVertical: 8 },
  configLabel: { fontSize: 16, fontWeight: '500' },
  configValue: { fontSize: 16, fontWeight: '700', minWidth: 44, textAlign: 'center' },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperButton: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  stepperButtonText: { fontSize: 18, fontWeight: '500', lineHeight: 20 },
  configDivider: { height: 1 },
  mockToggle: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, marginBottom: 20 },
  mockToggleText: { fontSize: 12, fontWeight: '600' },
  startButton: {
    backgroundColor: THEME_COLOR,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 16,
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  startButtonText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 2 },
  historyCard: { width: '100%', borderRadius: 16, padding: 16, borderWidth: 1, marginTop: 24 },
  historyTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  historyRound: { width: 30, fontWeight: '700' },
  historyStat: { fontSize: 13, fontWeight: '600' },
  // HUD
  hud: { flex: 1, paddingTop: 8 },
  gaugesRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 10, marginVertical: 16 },
  avgRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 },
  avgLabel: { fontSize: 11, letterSpacing: 1.5, fontWeight: '600' },
  avgValue: { fontSize: 11, fontWeight: '800' },
  hudFooter: { paddingHorizontal: 20, paddingBottom: 20, marginTop: 'auto' },
  endButton: { paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, alignItems: 'center' },
  endButtonText: { fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  alertCard: { borderRadius: 24, padding: 28, alignItems: 'center', width: '100%' },
  alertTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  alertMessage: { fontSize: 15, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  alertButton: { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14 },
  alertButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  // Last Session Summary card
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  summaryTimestamp: { fontSize: 11, marginBottom: 8 },
  sourceBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  sourceBadgeText: { fontSize: 11, fontWeight: '700' },
  statsDivider: { height: 1, marginVertical: 12 },
  statsSectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  statBox: { flex: 1, minWidth: '30%', borderRadius: 12, padding: 10, alignItems: 'center' },
  statBoxValue: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  statBoxLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  roundHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  roundHeaderCell: { fontSize: 10, fontWeight: '700', letterSpacing: 1, flex: 1, textAlign: 'center' },
});


// import React, { useState, useEffect } from 'react';
// import { StyleSheet, View, TouchableOpacity, Modal, Alert } from 'react-native';
// import { ThemedText } from '@/components/ThemedText';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { Colors, THEME_COLOR } from '@/constants/Colors';
// import { useTheme } from '@/context/ThemeContext';
// import { CircularGauge } from '@/components/practice/CircularGauge';
// import { FatigueBar } from '@/components/practice/FatigueBar';
// import { RoundTimer } from '@/components/practice/RoundTimer';
// import { usePracticeSession } from '@/hooks/usePracticeSession';
// import { useMockGloveData } from '@/hooks/useMockGloveData';
// import { useAppDispatch, useAppSelector } from '@/store/hooks';
// import { dismissFatigueAlert } from '@/store/slices/practiceSlice';
// import { BleManager } from 'react-native-ble-plx';

// const ESP_SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
// const ESP_SENSOR_CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8"; 

// const bleManager = new BleManager();

// export default function PracticeScreen() {
//   const { isDarkMode } = useTheme();
//   const theme = isDarkMode ? Colors.dark : Colors.light;
//   const dispatch = useAppDispatch();
  
//   const { isConnected, deviceId } = useAppSelector(state => state.connection);
//   const [useMockData, setUseMockData] = useState(true);

//   // New State: Tab Selection & Individual Glove Stats
//   const [viewMode, setViewMode] = useState<'left' | 'both' | 'right'>('both');
//   const [leftStats, setLeftStats] = useState({ speed: 0, power: 0, punches: 0 });
//   const [rightStats, setRightStats] = useState({ speed: 0, power: 0, punches: 0 });

//   const [rounds, setRounds] = useState(4);
//   const [roundDuration, setRoundDuration] = useState(180);
//   const [restDuration, setRestDuration] = useState(60);

//   const formatSeconds = (totalSeconds: number) => {
//     const m = Math.floor(totalSeconds / 60);
//     const s = totalSeconds % 60;
//     return `${m}:${s.toString().padStart(2, '0')}`;
//   };

//   const {
//     isSessionActive,
//     currentRound,
//     totalRounds,
//     formattedTime,
//     isResting,
//     totalPunches,
//     currentSpeed,
//     currentPower,
//     averageSpeed,
//     fatigueLevel,
//     showFatigueAlert,
//     roundStats,
//     startSession,
//     endSession,
//   } = usePracticeSession();

//   useMockGloveData(useMockData && isSessionActive);

//   // --- LIVE BLUETOOTH DATA STREAMING ---
//   useEffect(() => {
//     let subscription: any = null;

//     if (isSessionActive && !useMockData && isConnected && deviceId) {
//       subscription = bleManager.monitorCharacteristicForDevice(
//         deviceId,
//         ESP_SERVICE_UUID,
//         ESP_SENSOR_CHARACTERISTIC_UUID,
//         (error, characteristic) => {
//           if (error) return;

//           if (characteristic?.value) {
//             try {
//               const decodedData = atob(characteristic.value).trim();
              
//               // Expected ESP32 format: "HAND,SPEED,POWER,PUNCH_DETECTED" 
//               // Example Left: "L,15.2,80.5,1" | Example Right: "R,14.8,75.0,0"
//               const [hand, speedStr, powerStr, punchStr] = decodedData.split(',');
              
//               const speed = parseFloat(speedStr) || 0;
//               const power = parseFloat(powerStr) || 0;
//               const isPunch = punchStr === '1';

//               if (hand === 'L') {
//                 setLeftStats(prev => ({
//                   speed, 
//                   power, 
//                   punches: isPunch ? prev.punches + 1 : prev.punches
//                 }));
//               } else if (hand === 'R') {
//                 setRightStats(prev => ({
//                   speed, 
//                   power, 
//                   punches: isPunch ? prev.punches + 1 : prev.punches
//                 }));
//               }

//               // TODO: Continue dispatching aggregated stats to Redux 
//               // so your global hooks (usePracticeSession) stay up to date.
              
//             } catch (parseError) {
//               console.error("Failed to parse ESP32 data:", parseError);
//             }
//           }
//         }
//       );
//     }

//     return () => {
//       if (subscription) subscription.remove();
//     };
//   }, [isSessionActive, useMockData, isConnected, deviceId, dispatch]);

//   const handleStart = () => {
//     if (!useMockData && !isConnected) {
//       Alert.alert("Gloves Not Connected", "Please connect your gloves or switch to Mock Data.");
//       return;
//     }
//     // Reset local stats on new session
//     setLeftStats({ speed: 0, power: 0, punches: 0 });
//     setRightStats({ speed: 0, power: 0, punches: 0 });
//     setViewMode('both');
    
//     startSession({ totalRounds: rounds, roundDuration, restDuration });
//   };

//   // Determine which data to show on the gauges based on the selected tab
//   const displaySpeed = viewMode === 'left' ? leftStats.speed : viewMode === 'right' ? rightStats.speed : currentSpeed;
//   const displayPower = viewMode === 'left' ? leftStats.power : viewMode === 'right' ? rightStats.power : currentPower;
//   const displayPunches = viewMode === 'left' ? leftStats.punches : viewMode === 'right' ? rightStats.punches : totalPunches;

//   return (
//     <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
//       {!isSessionActive ? (
//         /* Pre-session screen (Unchanged) */
//         <View style={styles.preSession}>
//            {/* ... Keep your existing Pre-session UI here ... */}
//            <ThemedText style={{ fontSize: 56, marginBottom: 16 }}>🥊</ThemedText>
//            <ThemedText style={[styles.preTitle, { color: theme.text }]}>Ready to Train?</ThemedText>
//            <TouchableOpacity style={styles.startButton} onPress={handleStart}>
//             <ThemedText style={styles.startButtonText}>🔔 START SESSION</ThemedText>
//           </TouchableOpacity>
//         </View>
//       ) : (
//         /* Active session HUD */
//         <View style={styles.hud}>
//           <RoundTimer
//             currentRound={currentRound}
//             totalRounds={totalRounds}
//             formattedTime={formattedTime}
//             isResting={isResting}
//           />

//           {/* Glove Tab Selector */}
//           <View style={[styles.tabContainer, { backgroundColor: theme.surfaceContainer }]}>
//             {(['left', 'both', 'right'] as const).map((mode) => (
//               <TouchableOpacity
//                 key={mode}
//                 style={[
//                   styles.tabButton,
//                   viewMode === mode && { backgroundColor: THEME_COLOR }
//                 ]}
//                 onPress={() => setViewMode(mode)}
//               >
//                 <ThemedText style={[
//                   styles.tabText, 
//                   viewMode === mode ? { color: '#fff' } : { color: theme.secondary }
//                 ]}>
//                   {mode.toUpperCase()}
//                 </ThemedText>
//               </TouchableOpacity>
//             ))}
//           </View>

//           {/* Dynamic Gauges based on selected Tab */}
//           <View style={styles.gaugesRow}>
//             <CircularGauge
//               value={displaySpeed}
//               maxValue={30}
//               label="Speed"
//               unit="m/s"
//               color="#FF9500"
//             />
//             <CircularGauge
//               value={displayPunches}
//               maxValue={500}
//               label="Punches"
//               unit="total"
//               color={THEME_COLOR}
//               size={130}
//             />
//             <CircularGauge
//               value={displayPower}
//               maxValue={120}
//               label="Power"
//               unit="kg"
//               color="#5856D6"
//             />
//           </View>

//           <View style={styles.avgRow}>
//             <ThemedText style={[styles.avgLabel, { color: theme.secondary }]}>
//               AVG SPEED ({viewMode.toUpperCase()})
//             </ThemedText>
//             <ThemedText style={[styles.avgValue, { color: '#FF9500' }]}>
//               {/* Note: Average logic would need to be separated for L/R in your hook if desired */}
//               {averageSpeed.toFixed(1)} m/s
//             </ThemedText>
//           </View>

//           <FatigueBar fatigue={fatigueLevel} />

//           <View style={styles.hudFooter}>
//             <TouchableOpacity
//               style={[styles.endButton, { borderColor: theme.danger }]}
//               onPress={endSession}
//             >
//               <ThemedText style={[styles.endButtonText, { color: theme.danger }]}>
//                 ⏹ END SESSION
//               </ThemedText>
//             </TouchableOpacity>
//           </View>
//         </View>
//       )}
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   // ... Keep all your existing styles ...
//   container: { flex: 1 },
//   preSession: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
//   preTitle: { fontSize: 26, lineHeight: 34, fontWeight: '800', marginBottom: 8 },
//   startButton: { backgroundColor: THEME_COLOR, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 16, marginTop: 20 },
//   startButtonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
//   hud: { flex: 1, paddingTop: 8 },
//   gaugesRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 10, marginVertical: 16 },
//   avgRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 },
//   avgLabel: { fontSize: 11, letterSpacing: 1.5, fontWeight: '600' },
//   avgValue: { fontSize: 11, fontWeight: '800' },
//   hudFooter: { paddingHorizontal: 20, paddingBottom: 20, marginTop: 'auto' },
//   endButton: { paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, alignItems: 'center' },
//   endButtonText: { fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  
//   // New Styles for Tabs
//   tabContainer: {
//     flexDirection: 'row',
//     marginHorizontal: 20,
//     marginTop: 10,
//     marginBottom: 20,
//     borderRadius: 12,
//     padding: 4,
//   },
//   tabButton: {
//     flex: 1,
//     paddingVertical: 10,
//     alignItems: 'center',
//     borderRadius: 8,
//   },
//   tabText: {
//     fontSize: 13,
//     fontWeight: '700',
//     letterSpacing: 1,
//   },
// });
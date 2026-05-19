// import React, { useState, useEffect, useRef, useContext } from 'react';
// import { StyleSheet, View, TouchableOpacity, Modal, Alert, TextInput, Button } from 'react-native';
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
// import AsyncStorage from '@react-native-async-storage/async-storage'; 
// import { useHardware } from "../../context/sethardware";




// export default function PracticeScreen() {
//   const { isDarkMode } = useTheme();    
//   const theme = isDarkMode ? Colors.dark : Colors.light;
//   const dispatch = useAppDispatch();

//   const { hardwareData } = useHardware();
//   const [useMockData, setUseMockData] = useState(true);

//   // Stores the summary of the most recently completed session for display
//   const [lastSessionSummary, setLastSessionSummary] = useState<{
//     dataSource: string;
//     totalPunches: number;
//     peakSpeed: number;
//     peakForce: number;
//     avgSpeed: number;
//     avgForce: number;
//     totalReadings: number;
//     roundStats: any[];
//     timestamp: string;
//   } | null>(null);
//   const [rounds, setRounds] = useState(4);
//   const [roundDuration, setRoundDuration] = useState(180);
//   const [restDuration, setRestDuration] = useState(60);
//   const formatSeconds = (totalSeconds: number) => {
//     const m = Math.floor(totalSeconds / 60);
//     const s = totalSeconds % 60;
//     return `${m}:${s.toString().padStart(2, '0')}`;
//   }; 
 
//   // --- LIVE BLE SESSION ACCUMULATOR ---
//   // This ref stores running stats from real Bluetooth data during a session.
//   // Using a ref means updates never cause re-renders (performance-safe).
//   const liveBleAccumulator = useRef({
//     totalPunches: 0,
//     peakSpeed: 0,
//     peakForce: 0,
//     totalSpeed: 0,
//     totalForce: 0,
//     readingCount: 0,
//     punchTypes: {} as Record<string, number>, // e.g. { hook: 5, jab: 3 }
//     dataPoints: [] as Array<{ speed: number; force: number; punch: number; timestamp: string }>,
//   });

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

//   // Mock data generator – enable during session (only when useMockData is ON)
//   useMockGloveData(useMockData && isSessionActive);

//   // --- ACCUMULATE REAL BLE DATA WHILE SESSION IS ACTIVE ---
//   // Every time hardwareData changes (new BLE packet arrives) during a live
//   // session with mock data OFF, we update our running totals in the ref.
//   useEffect(() => {
//     if (!isSessionActive || useMockData) return;

//     const { speed, punch, power } = hardwareData;

//     // Only record if we got a real, non-zero reading
//     if (punch === 0 && power === 0) return;

//     const acc = liveBleAccumulator.current;

//     // Detect a new punch: punch count only ever increases from the ESP32`
//     if (punch > acc.totalPunches) {
//       acc.totalPunches = punch;
//     }

//     acc.peakSpeed  = Math.max(acc.peakSpeed, speed);
//     acc.peakForce  = Math.max(acc.peakForce, power);
//     acc.totalSpeed += speed;
//     acc.totalForce += power;
//     acc.readingCount += 1;

//     // Log a snapshot every reading for the detailed history
//     acc.dataPoints.push({
//       speed:speed,
//       force: power,
//       punch,
//       timestamp: new Date().toISOString(),
//     });
//   }, [hardwareData, isSessionActive, useMockData]);

//   // --- SAVE SESSION TO ASYNCSTORAGE (GROUPED BY DATE & DAY) ---
//   const handleEndAndSaveSession = async () => {
//     if (isSessionActive) {
//       const dateObj = new Date();
//       const dateString = dateObj.toISOString().split('T')[0]; // "2026-05-12"
//       const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' }); // "Tuesday"

//       const acc = liveBleAccumulator.current;
//       const avgSpeed = acc.readingCount > 0 ? acc.totalSpeed / acc.readingCount : 0;
//       const avgForce = acc.readingCount > 0 ? acc.totalForce / acc.readingCount : 0;

//       // Build the session object with REAL BLE accumulated data
//       const sessionToSave = {
//         id: Date.now().toString(),
//         timestamp: dateObj.toISOString(),
//         dataSource: useMockData ? 'mock' : 'bluetooth', // Track where data came from

//         // --- Real Bluetooth summary stats ---
//         bluetoothStats: {
//           totalPunches: acc.totalPunches,          // Final punch count from ESP32
//           peakSpeed:    parseFloat(acc.peakSpeed.toFixed(2)),  // Fastest punch (m/s)
//           peakForce:    parseFloat(acc.peakForce.toFixed(2)),  // Strongest punch (N)
//           avgSpeed:     parseFloat(avgSpeed.toFixed(2)),
//           avgForce:     parseFloat(avgForce.toFixed(2)),
//           totalReadings: acc.readingCount,
//           dataPoints:   acc.dataPoints,            // Full time-series for charts
//         },

//         // --- Redux/mock session stats (round-by-round) ---
//         roundStats: roundStats,

//         // Last BLE hardware snapshot
//         finalHardwareState: {
//           speed: hardwareData.speed,
//           punch: hardwareData.punch,
//           power: hardwareData.power,
//         },
//       };

//       try {
//         const existingData = await AsyncStorage.getItem('boxing_sessions_grouped');
//         let sessionsList: any[] = existingData ? JSON.parse(existingData) : [];

//         if (!Array.isArray(sessionsList)) sessionsList = [];

//         // Find if there is already a group for today
//         const existingDateIndex = sessionsList.findIndex((item: any) => item.date === dateString);

//         if (existingDateIndex >= 0) {
//           // Today's group exists → just append
//           sessionsList[existingDateIndex].sessions.push(sessionToSave);
//         } else {
//           // New day → create a new date group
//           sessionsList.push({
//             date: dateString,
//             day: dayName,
//             sessions: [sessionToSave],
//           });
//         }

//         await AsyncStorage.setItem('boxing_sessions_grouped', JSON.stringify(sessionsList));
//         console.log(`[Session Saved] ${dayName} ${dateString} | Source: ${sessionToSave.dataSource} | Punches: ${acc.totalPunches}`);
//       } catch (error) {
//         console.error("Failed to save session to AsyncStorage", error);
//       }

//       // Snapshot the summary into state so the UI can display it
//       setLastSessionSummary({
//         dataSource: useMockData ? 'mock' : 'bluetooth',
//         totalPunches: acc.totalPunches,
//         peakSpeed: parseFloat(acc.peakSpeed.toFixed(2)),
//         peakForce: parseFloat(acc.peakForce.toFixed(2)),
//         avgSpeed: parseFloat(avgSpeed.toFixed(2)),
//         avgForce: parseFloat(avgForce.toFixed(2)),
//         totalReadings: acc.readingCount,
//         roundStats: roundStats,
//         timestamp: dateObj.toISOString(),
//       });

//       // Reset the accumulator for the next session
//       liveBleAccumulator.current = {
//         totalPunches: 0,
//         peakSpeed: 0,
//         peakForce: 0,
//         totalSpeed: 0,
//         totalForce: 0,
//         readingCount: 0,
//         punchTypes: {},
//         dataPoints: [],
//       };
//     }
//     endSession();
//   };


//   const handleStart = () => {
//     // Reset accumulator fresh every time a new session starts
//     liveBleAccumulator.current = {
//       totalPunches: 0,
//       peakSpeed: 0,
//       peakForce: 0,
//       totalSpeed: 0,
//       totalForce: 0,
//       readingCount: 0,
//       punchTypes: {},
//       dataPoints: [],
//     };
//     startSession({ totalRounds: rounds, roundDuration, restDuration });
//   };

//   return (
//     <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
//       {!isSessionActive ? (
//         /* Pre-session screen */
//         <View style={styles.preSession}>
//           <ThemedText style={{ fontSize: 56, marginBottom: 16 }}>🥊</ThemedText>
//           <ThemedText style={[styles.preTitle, { color: theme.text }]}>
//             Ready to Train?
//           </ThemedText>
//           {/* Session Config */}
//           <View style={{ marginBottom: 20, alignItems: 'center' }}>
//             <ThemedText style={{ color: theme.secondary, fontSize: 14 }}>Live Hardware Stats</ThemedText>
//             <ThemedText style={{ color: theme.text, fontWeight: '700' }}>
//               Speed: {hardwareData.speed}
//             </ThemedText>
//           </View>
          
//           <View style={[styles.configCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
//             <View style={[styles.configRow, styles.stepperRow]}>
//               <ThemedText style={[styles.configLabel, { color: theme.secondary }]}>Rounds</ThemedText>
//               <View style={styles.stepperControls}>
//                 <TouchableOpacity style={[styles.stepperButton, { borderColor: theme.border }]} onPress={() => setRounds(r => Math.max(1, r - 1))} disabled={rounds <= 1}>
//                   <ThemedText style={[styles.stepperButtonText, { color: rounds <= 1 ? theme.secondary : theme.text }]}>-</ThemedText>
//                 </TouchableOpacity>
//                 <ThemedText style={[styles.configValue, { color: theme.text }]}>{rounds}</ThemedText>
//                 <TouchableOpacity style={[styles.stepperButton, { borderColor: theme.border }]} onPress={() => setRounds(r => Math.min(20, r + 1))}>
//                   <ThemedText style={[styles.stepperButtonText, { color: theme.text }]}>+</ThemedText>
//                 </TouchableOpacity>
//               </View>
//             </View>
//             <View style={[styles.configDivider, { backgroundColor: theme.border }]} />
//             <View style={[styles.configRow, styles.stepperRow]}>
//               <ThemedText style={[styles.configLabel, { color: theme.secondary }]}>Round Duration</ThemedText>
//               <View style={styles.stepperControls}>
//                 <TouchableOpacity style={[styles.stepperButton, { borderColor: theme.border }]} onPress={() => setRoundDuration(d => Math.max(30, d - 30))} disabled={roundDuration <= 30}>
//                   <ThemedText style={[styles.stepperButtonText, { color: roundDuration <= 30 ? theme.secondary : theme.text }]}>-</ThemedText>
//                 </TouchableOpacity>
//                 <ThemedText style={[styles.configValue, { color: theme.text }]}>{formatSeconds(roundDuration)}</ThemedText>
//                 <TouchableOpacity style={[styles.stepperButton, { borderColor: theme.border }]} onPress={() => setRoundDuration(d => Math.min(600, d + 30))}>
//                   <ThemedText style={[styles.stepperButtonText, { color: theme.text }]}>+</ThemedText>
//                 </TouchableOpacity>
//               </View>
//             </View>
//             <View style={[styles.configDivider, { backgroundColor: theme.border }]} />
//             <View style={[styles.configRow, styles.stepperRow]}>
//               <ThemedText style={[styles.configLabel, { color: theme.secondary }]}>Rest Period</ThemedText>
//               <View style={styles.stepperControls}>
//                 <TouchableOpacity style={[styles.stepperButton, { borderColor: theme.border }]} onPress={() => setRestDuration(d => Math.max(10, d - 10))} disabled={restDuration <= 10}>
//                   <ThemedText style={[styles.stepperButtonText, { color: restDuration <= 10 ? theme.secondary : theme.text }]}>-</ThemedText>
//                 </TouchableOpacity>
//                 <ThemedText style={[styles.configValue, { color: theme.text }]}>{formatSeconds(restDuration)}</ThemedText>
//                 <TouchableOpacity style={[styles.stepperButton, { borderColor: theme.border }]} onPress={() => setRestDuration(d => Math.min(300, d + 10))}>
//                   <ThemedText style={[styles.stepperButtonText, { color: theme.text }]}>+</ThemedText>
//                 </TouchableOpacity>
//               </View>
//             </View>
//           </View>

//           {/* Mock data toggle */}
//           <TouchableOpacity
//             style={[styles.mockToggle, { borderColor: theme.border }]}
//             onPress={() => setUseMockData(!useMockData)}
//           >
//             <ThemedText style={[styles.mockToggleText, { color: theme.secondary }]}>
//               {useMockData ? '🔄 Mock Data: ON' : '📡 Real Bluetooth Data'}
//             </ThemedText>
//           </TouchableOpacity>

         


//           <TouchableOpacity style={styles.startButton} onPress={handleStart}>
//             <ThemedText style={styles.startButtonText}> 🔔 START SESSION</ThemedText>
//           </TouchableOpacity>

//           {/* Last Session Summary — shows after any session ends */}
//           {lastSessionSummary && (
//             <View style={[styles.historyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>

//               {/* Header row: title + data source badge */}
//               <View style={styles.summaryHeader}>
//                 <ThemedText style={[styles.historyTitle, { color: theme.text }]}>Last Session Summary</ThemedText>
//                 <View style={[
//                   styles.sourceBadge,
//                   { backgroundColor: lastSessionSummary.dataSource === 'bluetooth' ? '#1a3a2a' : '#2a2a1a' }
//                 ]}>
//                   <ThemedText style={[styles.sourceBadgeText, { color: lastSessionSummary.dataSource === 'bluetooth' ? '#4ade80' : '#facc15' }]}>
//                     {lastSessionSummary.dataSource === 'bluetooth' ? '📡 Bluetooth' : '🔄 Mock'}
//                   </ThemedText>
//                 </View>
//               </View>

//               {/* Timestamp */}
//               <ThemedText style={[styles.summaryTimestamp, { color: theme.secondary }]}>
//                 {new Date(lastSessionSummary.timestamp).toLocaleString('en-US', {
//                   weekday: 'short', month: 'short', day: 'numeric',
//                   hour: '2-digit', minute: '2-digit'
//                 })}
//               </ThemedText>

//               {/* BLE Stats grid — only meaningful when real bluetooth was used */}
//               {lastSessionSummary.dataSource === 'bluetooth' && lastSessionSummary.totalReadings > 0 && (
//                 <>
//                   <View style={[styles.statsDivider, { backgroundColor: theme.border }]} />
//                   <ThemedText style={[styles.statsSectionLabel, { color: theme.secondary }]}>📊 BLUETOOTH STATS</ThemedText>
//                   <View style={styles.statsGrid}>
//                     <View style={[styles.statBox, { backgroundColor: theme.surfaceContainer }]}>
//                       <ThemedText style={[styles.statBoxValue, { color: THEME_COLOR }]}>{lastSessionSummary.totalPunches}</ThemedText>
//                       <ThemedText style={[styles.statBoxLabel, { color: theme.secondary }]}>Total Punches</ThemedText>
//                     </View>
//                     <View style={[styles.statBox, { backgroundColor: theme.surfaceContainer }]}>
//                       <ThemedText style={[styles.statBoxValue, { color: '#FF9500' }]}>{lastSessionSummary.peakSpeed} m/s</ThemedText>
//                       <ThemedText style={[styles.statBoxLabel, { color: theme.secondary }]}>Peak Speed</ThemedText>
//                     </View>
//                     <View style={[styles.statBox, { backgroundColor: theme.surfaceContainer }]}>
//                       <ThemedText style={[styles.statBoxValue, { color: '#5856D6' }]}>{lastSessionSummary.peakForce} N</ThemedText>
//                       <ThemedText style={[styles.statBoxLabel, { color: theme.secondary }]}>Peak Force</ThemedText>
//                     </View>
//                     <View style={[styles.statBox, { backgroundColor: theme.surfaceContainer }]}>
//                       <ThemedText style={[styles.statBoxValue, { color: '#FF9500' }]}>{lastSessionSummary.avgSpeed} m/s</ThemedText>
//                       <ThemedText style={[styles.statBoxLabel, { color: theme.secondary }]}>Avg Speed</ThemedText>
//                     </View>
//                     <View style={[styles.statBox, { backgroundColor: theme.surfaceContainer }]}>
//                       <ThemedText style={[styles.statBoxValue, { color: '#5856D6' }]}>{lastSessionSummary.avgForce} N</ThemedText>
//                       <ThemedText style={[styles.statBoxLabel, { color: theme.secondary }]}>Avg Force</ThemedText>
//                     </View>
//                     <View style={[styles.statBox, { backgroundColor: theme.surfaceContainer }]}>
//                       <ThemedText style={[styles.statBoxValue, { color: theme.text }]}>{lastSessionSummary.totalReadings}</ThemedText>
//                       <ThemedText style={[styles.statBoxLabel, { color: theme.secondary }]}>BLE Readings</ThemedText>
//                     </View>
//                   </View>
//                 </>
//               )}

//               {/* Round-by-round breakdown */}
//               {lastSessionSummary.roundStats.length > 0 && (
//                 <>
//                   <View style={[styles.statsDivider, { backgroundColor: theme.border }]} />
//                   <ThemedText style={[styles.statsSectionLabel, { color: theme.secondary }]}>🥊 ROUND BREAKDOWN</ThemedText>
//                   <View style={styles.roundHeaderRow}>
//                     <ThemedText style={[styles.roundHeaderCell, { color: theme.secondary }]}>RND</ThemedText>
//                     <ThemedText style={[styles.roundHeaderCell, { color: theme.secondary }]}>PUNCHES</ThemedText>
//                     <ThemedText style={[styles.roundHeaderCell, { color: theme.secondary }]}>SPD</ThemedText>
//                     <ThemedText style={[styles.roundHeaderCell, { color: theme.secondary }]}>FATIGUE</ThemedText>
//                   </View>
//                   {lastSessionSummary.roundStats.map((round: any) => (
//                     <View key={round.id} style={[styles.historyRow, { borderTopWidth: 1, borderTopColor: theme.border + '40' }]}>
//                       <ThemedText style={[styles.historyRound, { color: THEME_COLOR }]}>R{round.round_number}</ThemedText>
//                       <ThemedText style={[styles.historyStat, { color: theme.text }]}>{round.punch_count}</ThemedText>
//                       <ThemedText style={[styles.historyStat, { color: '#FF9500' }]}>{round.avg_speed} m/s</ThemedText>
//                       <ThemedText style={[styles.historyStat, { color: '#5856D6' }]}>{round.fatigue_level}%</ThemedText>
//                     </View>
//                   ))}
//                 </>
//               )}
//             </View>
//           )}
//         </View>
//       ) : (
//         /* Active session HUD */
//         <View style={styles.hud}>
//           {/* Round Timer */}
//           <RoundTimer
//             currentRound={currentRound}
//             totalRounds={totalRounds}
//             formattedTime={formattedTime}
//             isResting={isResting}
//           />

//           {/* Gauges */}
//           <View style={styles.gaugesRow}>
//             <CircularGauge
//               value={hardwareData.speed || currentSpeed }
//               maxValue={30}
//               label="Speed"
//               unit="m/s"
//               color="#FF9500"
//             />
//             <CircularGauge
//               value={hardwareData.punch || totalPunches}
//               maxValue={500}
//               label="Punches"
//               unit="total"
//               color={THEME_COLOR}
//               size={130}
//             />
//             <CircularGauge
//               value={hardwareData.power || currentPower}
//               maxValue={120}
//               label="Power"
//               unit="kg"
//               color="#5856D6"
//             />
//           </View>

//           {/* Average speed indicator */}
//           <View style={styles.avgRow}>
//             <ThemedText style={[styles.avgLabel, { color: theme.secondary }]}>
//               AVG SPEED
//             </ThemedText>
//             <ThemedText style={[styles.avgValue, { color: '#FF9500' }]}>
//               {averageSpeed.toFixed(1)} m/s
//             </ThemedText>
//           </View>

//           {/* Fatigue Bar */}
//           <FatigueBar fatigue={fatigueLevel} />

//           {/* End Session Button */}
//           <View style={styles.hudFooter}>
//             <TouchableOpacity
//               style={[styles.endButton, { borderColor: theme.danger }]}
//               onPress={handleEndAndSaveSession}
//             >
//               <ThemedText style={[styles.endButtonText, { color: theme.danger }]}>
//                 ⏹ END SESSION
//               </ThemedText>
//             </TouchableOpacity>
//           </View>
//         </View>
//       )}

//       {/* Fatigue Alert Modal */}
//       <Modal visible={showFatigueAlert} transparent animationType="fade">
//         <View style={styles.modalOverlay}>
//           <View style={[styles.alertCard, { backgroundColor: theme.surfaceContainer }]}>
//             <ThemedText style={{ fontSize: 44, marginBottom: 8 }}>⚠️</ThemedText>
//             <ThemedText style={[styles.alertTitle, { color: theme.danger }]}>
//               Performance Dropping!
//             </ThemedText>
//             <ThemedText style={[styles.alertMessage, { color: theme.text }]}>
//               Your fatigue level has exceeded 80%.{'\n'}Consider taking a rest.
//             </ThemedText>
//             <TouchableOpacity
//               style={[styles.alertButton, { backgroundColor: theme.primary }]}
//               onPress={() => dispatch(dismissFatigueAlert())}
//             >
//               <ThemedText style={styles.alertButtonText}>Got it, Keep Going 💪</ThemedText>
//             </TouchableOpacity>
//           </View>
//         </View>
//       </Modal>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1 },
//   // Pre-session
//   preSession: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
//   preTitle: { fontSize: 26, lineHeight: 34, fontWeight: '800', marginBottom: 8, letterSpacing: -0.5, paddingVertical: 4 },
//   preSubtitle: { fontSize: 15, textAlign: 'center', marginBottom: 28 },
//   configCard: { width: '100%', borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 16 },
//   configRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
//   stepperRow: { paddingVertical: 8 },
//   configLabel: { fontSize: 16, fontWeight: '500' },
//   configValue: { fontSize: 16, fontWeight: '700', minWidth: 44, textAlign: 'center' },
//   stepperControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
//   stepperButton: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
//   stepperButtonText: { fontSize: 18, fontWeight: '500', lineHeight: 20 },
//   configDivider: { height: 1 },
//   mockToggle: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, marginBottom: 20 },
//   mockToggleText: { fontSize: 12, fontWeight: '600' },
//   startButton: {
//     backgroundColor: THEME_COLOR,
//     paddingVertical: 16,
//     paddingHorizontal: 40,
//     borderRadius: 16,
//     shadowColor: THEME_COLOR,
//     shadowOffset: { width: 0, height: 6 },
//     shadowOpacity: 0.4,
//     shadowRadius: 12,
//     elevation: 6,
//   },
//   startButtonText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 2 },
//   historyCard: { width: '100%', borderRadius: 16, padding: 16, borderWidth: 1, marginTop: 24 },
//   historyTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
//   historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
//   historyRound: { width: 30, fontWeight: '700' },
//   historyStat: { fontSize: 13, fontWeight: '600' },
//   // HUD
//   hud: { flex: 1, paddingTop: 8 },
//   gaugesRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 10, marginVertical: 16 },
//   avgRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 },
//   avgLabel: { fontSize: 11, letterSpacing: 1.5, fontWeight: '600' },
//   avgValue: { fontSize: 11, fontWeight: '800' },
//   hudFooter: { paddingHorizontal: 20, paddingBottom: 20, marginTop: 'auto' },
//   endButton: { paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, alignItems: 'center' },
//   endButtonText: { fontSize: 15, fontWeight: '700', letterSpacing: 1 },
//   // Modal
//   modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
//   alertCard: { borderRadius: 24, padding: 28, alignItems: 'center', width: '100%' },
//   alertTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
//   alertMessage: { fontSize: 15, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
//   alertButton: { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14 },
//   alertButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
//   // Last Session Summary card
//   summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
//   summaryTimestamp: { fontSize: 11, marginBottom: 8 },
//   sourceBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
//   sourceBadgeText: { fontSize: 11, fontWeight: '700' },
//   statsDivider: { height: 1, marginVertical: 12 },
//   statsSectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10 },
//   statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
//   statBox: { flex: 1, minWidth: '30%', borderRadius: 12, padding: 10, alignItems: 'center' },
//   statBoxValue: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
//   statBoxLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
//   roundHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
//   roundHeaderCell: { fontSize: 10, fontWeight: '700', letterSpacing: 1, flex: 1, textAlign: 'center' },
// });


// // import React, { useState, useEffect } from 'react';
// // import { StyleSheet, View, TouchableOpacity, Modal, Alert } from 'react-native';
// // import { ThemedText } from '@/components/ThemedText';
// // import { SafeAreaView } from 'react-native-safe-area-context';
// // import { Colors, THEME_COLOR } from '@/constants/Colors';
// // import { useTheme } from '@/context/ThemeContext';
// // import { CircularGauge } from '@/components/practice/CircularGauge';
// // import { FatigueBar } from '@/components/practice/FatigueBar';
// // import { RoundTimer } from '@/components/practice/RoundTimer';
// // import { usePracticeSession } from '@/hooks/usePracticeSession';
// // import { useMockGloveData } from '@/hooks/useMockGloveData';
// // import { useAppDispatch, useAppSelector } from '@/store/hooks';
// // import { dismissFatigueAlert } from '@/store/slices/practiceSlice';
// // import { BleManager } from 'react-native-ble-plx';

// // const ESP_SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
// // const ESP_SENSOR_CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8"; 

// // const bleManager = new BleManager();

// // export default function PracticeScreen() {
// //   const { isDarkMode } = useTheme();
// //   const theme = isDarkMode ? Colors.dark : Colors.light;
// //   const dispatch = useAppDispatch();
  
// //   const { isConnected, deviceId } = useAppSelector(state => state.connection);
// //   const [useMockData, setUseMockData] = useState(true);

// //   // New State: Tab Selection & Individual Glove Stats
// //   const [viewMode, setViewMode] = useState<'left' | 'both' | 'right'>('both');
// //   const [leftStats, setLeftStats] = useState({ speed: 0, power: 0, punches: 0 });
// //   const [rightStats, setRightStats] = useState({ speed: 0, power: 0, punches: 0 });

// //   const [rounds, setRounds] = useState(4);
// //   const [roundDuration, setRoundDuration] = useState(180);
// //   const [restDuration, setRestDuration] = useState(60);

// //   const formatSeconds = (totalSeconds: number) => {
// //     const m = Math.floor(totalSeconds / 60);
// //     const s = totalSeconds % 60;
// //     return `${m}:${s.toString().padStart(2, '0')}`;
// //   };

// //   const {
// //     isSessionActive,
// //     currentRound,
// //     totalRounds,
// //     formattedTime,
// //     isResting,
// //     totalPunches,
// //     currentSpeed,
// //     currentPower,
// //     averageSpeed,
// //     fatigueLevel,
// //     showFatigueAlert,
// //     roundStats,
// //     startSession,
// //     endSession,
// //   } = usePracticeSession();

// //   useMockGloveData(useMockData && isSessionActive);

// //   // --- LIVE BLUETOOTH DATA STREAMING ---
// //   useEffect(() => {
// //     let subscription: any = null;

// //     if (isSessionActive && !useMockData && isConnected && deviceId) {
// //       subscription = bleManager.monitorCharacteristicForDevice(
// //         deviceId,
// //         ESP_SERVICE_UUID,
// //         ESP_SENSOR_CHARACTERISTIC_UUID,
// //         (error, characteristic) => {
// //           if (error) return;

// //           if (characteristic?.value) {
// //             try {
// //               const decodedData = atob(characteristic.value).trim();
              
// //               // Expected ESP32 format: "HAND,SPEED,POWER,PUNCH_DETECTED" 
// //               // Example Left: "L,15.2,80.5,1" | Example Right: "R,14.8,75.0,0"
// //               const [hand, speedStr, powerStr, punchStr] = decodedData.split(',');
              
// //               const speed = parseFloat(speedStr) || 0;
// //               const power = parseFloat(powerStr) || 0;
// //               const isPunch = punchStr === '1';

// //               if (hand === 'L') {
// //                 setLeftStats(prev => ({
// //                   speed, 
// //                   power, 
// //                   punches: isPunch ? prev.punches + 1 : prev.punches
// //                 }));
// //               } else if (hand === 'R') {
// //                 setRightStats(prev => ({
// //                   speed, 
// //                   power, 
// //                   punches: isPunch ? prev.punches + 1 : prev.punches
// //                 }));
// //               }

// //               // TODO: Continue dispatching aggregated stats to Redux 
// //               // so your global hooks (usePracticeSession) stay up to date.
              
// //             } catch (parseError) {
// //               console.error("Failed to parse ESP32 data:", parseError);
// //             }
// //           }
// //         }
// //       );
// //     }

// //     return () => {
// //       if (subscription) subscription.remove();
// //     };
// //   }, [isSessionActive, useMockData, isConnected, deviceId, dispatch]);

// //   const handleStart = () => {
// //     if (!useMockData && !isConnected) {
// //       Alert.alert("Gloves Not Connected", "Please connect your gloves or switch to Mock Data.");
// //       return;
// //     }
// //     // Reset local stats on new session
// //     setLeftStats({ speed: 0, power: 0, punches: 0 });
// //     setRightStats({ speed: 0, power: 0, punches: 0 });
// //     setViewMode('both');
    
// //     startSession({ totalRounds: rounds, roundDuration, restDuration });
// //   };

// //   // Determine which data to show on the gauges based on the selected tab
// //   const displaySpeed = viewMode === 'left' ? leftStats.speed : viewMode === 'right' ? rightStats.speed : currentSpeed;
// //   const displayPower = viewMode === 'left' ? leftStats.power : viewMode === 'right' ? rightStats.power : currentPower;
// //   const displayPunches = viewMode === 'left' ? leftStats.punches : viewMode === 'right' ? rightStats.punches : totalPunches;

// //   return (
// //     <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
// //       {!isSessionActive ? (
// //         /* Pre-session screen (Unchanged) */
// //         <View style={styles.preSession}>
// //            {/* ... Keep your existing Pre-session UI here ... */}
// //            <ThemedText style={{ fontSize: 56, marginBottom: 16 }}>🥊</ThemedText>
// //            <ThemedText style={[styles.preTitle, { color: theme.text }]}>Ready to Train?</ThemedText>
// //            <TouchableOpacity style={styles.startButton} onPress={handleStart}>
// //             <ThemedText style={styles.startButtonText}>🔔 START SESSION</ThemedText>
// //           </TouchableOpacity>
// //         </View>
// //       ) : (
// //         /* Active session HUD */
// //         <View style={styles.hud}>
// //           <RoundTimer
// //             currentRound={currentRound}
// //             totalRounds={totalRounds}
// //             formattedTime={formattedTime}
// //             isResting={isResting}
// //           />

// //           {/* Glove Tab Selector */}
// //           <View style={[styles.tabContainer, { backgroundColor: theme.surfaceContainer }]}>
// //             {(['left', 'both', 'right'] as const).map((mode) => (
// //               <TouchableOpacity
// //                 key={mode}
// //                 style={[
// //                   styles.tabButton,
// //                   viewMode === mode && { backgroundColor: THEME_COLOR }
// //                 ]}
// //                 onPress={() => setViewMode(mode)}
// //               >
// //                 <ThemedText style={[
// //                   styles.tabText, 
// //                   viewMode === mode ? { color: '#fff' } : { color: theme.secondary }
// //                 ]}>
// //                   {mode.toUpperCase()}
// //                 </ThemedText>
// //               </TouchableOpacity>
// //             ))}
// //           </View>

// //           {/* Dynamic Gauges based on selected Tab */}
// //           <View style={styles.gaugesRow}>
// //             <CircularGauge
// //               value={displaySpeed}
// //               maxValue={30}
// //               label="Speed"
// //               unit="m/s"
// //               color="#FF9500"
// //             />
// //             <CircularGauge
// //               value={displayPunches}
// //               maxValue={500}
// //               label="Punches"
// //               unit="total"
// //               color={THEME_COLOR}
// //               size={130}
// //             />
// //             <CircularGauge
// //               value={displayPower}
// //               maxValue={120}
// //               label="Power"
// //               unit="kg"
// //               color="#5856D6"
// //             />
// //           </View>

// //           <View style={styles.avgRow}>
// //             <ThemedText style={[styles.avgLabel, { color: theme.secondary }]}>
// //               AVG SPEED ({viewMode.toUpperCase()})
// //             </ThemedText>
// //             <ThemedText style={[styles.avgValue, { color: '#FF9500' }]}>
// //               {/* Note: Average logic would need to be separated for L/R in your hook if desired */}
// //               {averageSpeed.toFixed(1)} m/s
// //             </ThemedText>
// //           </View>

// //           <FatigueBar fatigue={fatigueLevel} />

// //           <View style={styles.hudFooter}>
// //             <TouchableOpacity
// //               style={[styles.endButton, { borderColor: theme.danger }]}
// //               onPress={endSession}
// //             >
// //               <ThemedText style={[styles.endButtonText, { color: theme.danger }]}>
// //                 ⏹ END SESSION
// //               </ThemedText>
// //             </TouchableOpacity>
// //           </View>
// //         </View>
// //       )}
// //     </SafeAreaView>
// //   );
// // }

// // const styles = StyleSheet.create({
// //   // ... Keep all your existing styles ...
// //   container: { flex: 1 },
// //   preSession: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
// //   preTitle: { fontSize: 26, lineHeight: 34, fontWeight: '800', marginBottom: 8 },
// //   startButton: { backgroundColor: THEME_COLOR, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 16, marginTop: 20 },
// //   startButtonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
// //   hud: { flex: 1, paddingTop: 8 },
// //   gaugesRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 10, marginVertical: 16 },
// //   avgRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 },
// //   avgLabel: { fontSize: 11, letterSpacing: 1.5, fontWeight: '600' },
// //   avgValue: { fontSize: 11, fontWeight: '800' },
// //   hudFooter: { paddingHorizontal: 20, paddingBottom: 20, marginTop: 'auto' },
// //   endButton: { paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, alignItems: 'center' },
// //   endButtonText: { fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  
// //   // New Styles for Tabs
// //   tabContainer: {
// //     flexDirection: 'row',
// //     marginHorizontal: 20,
// //     marginTop: 10,
// //     marginBottom: 20,
// //     borderRadius: 12,
// //     padding: 4,
// //   },
// //   tabButton: {
// //     flex: 1,
// //     paddingVertical: 10,
// //     alignItems: 'center',
// //     borderRadius: 8,
// //   },
// //   tabText: {
// //     fontSize: 13,
// //     fontWeight: '700',
// //     letterSpacing: 1,
// //   },
// // });


import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, View, TouchableOpacity, Modal,
  ScrollView, Alert,
} from 'react-native';
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
import { useHardware } from '../../context/sethardware';

// ─── Types ────────────────────────────────────────────────────────────────────

type GloveStats = {
  speed:     number;
  force:     number;
  punchCnt:  number;
  bestSpd:   number;
  bestFrc:   number;
  punchType: string;
};

type RoundRecord = {
  roundNumber:  number;
  startedAt:    string;   // ISO
  endedAt:      string;   // ISO
  durationSec:  number;   // actual seconds of fighting (not rest)
  restSec:      number;
  left:  GloveStats;
  right: GloveStats;
  totalPunches: number;
  peakSpeedMs:  number;
  peakForceN:   number;
  avgSpeedMs:   number;
  avgForceN:    number;
  readings:     number;
};

type SessionRecord = {
  id:          string;
  date:        string;   // "2026-05-19"
  day:         string;   // "Monday"
  startedAt:   string;   // ISO
  endedAt:     string;   // ISO
  dataSource:  'bluetooth' | 'mock';
  totalRounds: number;
  rounds:      RoundRecord[];
  // session-level bests (across all rounds)
  totalPunches: number;
  peakSpeedMs:  number;
  peakForceN:   number;
  avgSpeedMs:   number;
  avgForceN:    number;
};

// ─── Round accumulator (lives in a ref — zero re-renders) ─────────────────────

type RoundAcc = {
  startedAt:   Date;
  totalSpeed:  number;
  totalForce:  number;
  readings:    number;
  peakSpeed:   number;
  peakForce:   number;
  leftSnap:    GloveStats;
  rightSnap:   GloveStats;
  totalPunches: number;
};

function emptyAcc(now: Date): RoundAcc {
  return {
    startedAt:    now,
    totalSpeed:   0,
    totalForce:   0,
    readings:     0,
    peakSpeed:    0,
    peakForce:    0,
    totalPunches: 0,
    leftSnap:  { speed: 0, force: 0, punchCnt: 0, bestSpd: 0, bestFrc: 0, punchType: '' },
    rightSnap: { speed: 0, force: 0, punchCnt: 0, bestSpd: 0, bestFrc: 0, punchType: '' },
  };
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'boxing_sessions_grouped_v2';

type DayGroup = {
  date:     string;
  day:      string;
  sessions: SessionRecord[];
};

async function saveSessionToStorage(session: SessionRecord): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const groups: DayGroup[] = raw ? JSON.parse(raw) : [];

    const idx = groups.findIndex(g => g.date === session.date);
    if (idx >= 0) {
      groups[idx].sessions.push(session);
    } else {
      groups.push({ date: session.date, day: session.day, sessions: [session] });
    }

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
    console.log(`✅ Session saved — ${session.date} | rounds: ${session.totalRounds}`);
  } catch (e) {
    console.error('Failed to save session:', e);
  }
}

async function loadSessions(): Promise<DayGroup[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

// ═════════════════════════════════════════════════════════════════════════════
//  Component
// ═════════════════════════════════════════════════════════════════════════════

export default function PracticeScreen() {
  const { isDarkMode } = useTheme();
  const theme       = isDarkMode ? Colors.dark : Colors.light;
  const dispatch    = useAppDispatch();

  const { hardwareData } = useHardware();
  const [useMockData, setUseMockData] = useState(true);

  // ── Config ────────────────────────────────────────────────────────────────
  const [rounds,        setRounds]        = useState(4);
  const [roundDuration, setRoundDuration] = useState(180);
  const [restDuration,  setRestDuration]  = useState(60);

  // ── View ──────────────────────────────────────────────────────────────────
  const [gloveView,     setGloveView]     = useState<'left' | 'both' | 'right'>('both');
  const [showHistory,   setShowHistory]   = useState(false);
  const [historyGroups, setHistoryGroups] = useState<DayGroup[]>([]);
  const [lastSession,   setLastSession]   = useState<SessionRecord | null>(null);

  // ── Session state ─────────────────────────────────────────────────────────
  const sessionStartRef  = useRef<Date | null>(null);
  const roundsRecorded   = useRef<RoundRecord[]>([]);
  const currentRoundAcc  = useRef<RoundAcc>(emptyAcc(new Date()));
  const prevRoundRef     = useRef<number>(0);  // tracks when round number changes
  const restStartRef     = useRef<Date | null>(null);

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

  useMockGloveData(useMockData && isSessionActive);

  // ── Load history on mount ─────────────────────────────────────────────────
  useEffect(() => {
    loadSessions().then(setHistoryGroups);
  }, []);

  // ── Detect round change → seal previous round record ─────────────────────
  useEffect(() => {
    if (!isSessionActive) return;

    // Round just changed (e.g. 1 → 2)
    if (currentRound !== prevRoundRef.current && prevRoundRef.current !== 0) {
      sealCurrentRound(prevRoundRef.current, true /* completed */);
    }

    // Detect start of rest
    if (isResting && restStartRef.current === null) {
      restStartRef.current = new Date();
    }
    // Detect end of rest
    if (!isResting && restStartRef.current !== null) {
      restStartRef.current = null;
      // Fresh accumulator for the new round
      currentRoundAcc.current = emptyAcc(new Date());
    }

    prevRoundRef.current = currentRound;
  }, [currentRound, isResting, isSessionActive]);

  // ── Accumulate live BLE/mock data ─────────────────────────────────────────
  useEffect(() => {
    if (!isSessionActive || isResting) return;

    const L = hardwareData as any;  // your context shape
    const speedVal = L.l_speed  ?? L.speed  ?? 0;
    const forceVal = L.l_force_n ?? L.power  ?? 0;
    const lPunchCnt = L.l_punch_cnt ?? 0;
    const rPunchCnt = L.r_punch_cnt ?? 0;

    if (speedVal === 0 && forceVal === 0) return;  // skip idle packets

    const acc = currentRoundAcc.current;
    acc.totalSpeed  += speedVal;
    acc.totalForce  += forceVal;
    acc.readings    += 1;
    acc.peakSpeed    = Math.max(acc.peakSpeed, speedVal);
    acc.peakForce    = Math.max(acc.peakForce, forceVal);
    acc.totalPunches = Math.max(lPunchCnt, rPunchCnt, acc.totalPunches);

    // Snapshot latest glove values for the round record
    acc.leftSnap = {
      speed:     L.l_speed     ?? 0,
      force:     L.l_force_n   ?? 0,
      punchCnt:  L.l_punch_cnt ?? 0,
      bestSpd:   L.l_best_spd  ?? 0,
      bestFrc:   L.l_best_frc  ?? 0,
      punchType: L.l_punch_type ?? '',
    };
    acc.rightSnap = {
      speed:     L.r_speed     ?? 0,
      force:     L.r_force_n   ?? 0,
      punchCnt:  L.r_punch_cnt ?? 0,
      bestSpd:   L.r_best_spd  ?? 0,
      bestFrc:   L.r_best_frc  ?? 0,
      punchType: L.r_punch_type ?? '',
    };
  }, [hardwareData, isSessionActive, isResting]);

  // ── Seal a round into roundsRecorded ─────────────────────────────────────
  const sealCurrentRound = useCallback((roundNumber: number, _completed: boolean) => {
    const acc    = currentRoundAcc.current;
    const now    = new Date();
    const durSec = Math.round((now.getTime() - acc.startedAt.getTime()) / 1000);
    const restSec = restStartRef.current
      ? Math.round((now.getTime() - restStartRef.current.getTime()) / 1000)
      : restDuration;

    const record: RoundRecord = {
      roundNumber,
      startedAt:    acc.startedAt.toISOString(),
      endedAt:      now.toISOString(),
      durationSec:  Math.min(durSec, roundDuration),
      restSec,
      left:         acc.leftSnap,
      right:        acc.rightSnap,
      totalPunches: acc.totalPunches,
      peakSpeedMs:  parseFloat(acc.peakSpeed.toFixed(2)),
      peakForceN:   parseFloat(acc.peakForce.toFixed(2)),
      avgSpeedMs:   acc.readings > 0 ? parseFloat((acc.totalSpeed / acc.readings).toFixed(2)) : 0,
      avgForceN:    acc.readings > 0 ? parseFloat((acc.totalForce / acc.readings).toFixed(2)) : 0,
      readings:     acc.readings,
    };

    roundsRecorded.current.push(record);
    console.log(`📦 Round ${roundNumber} sealed — punches: ${record.totalPunches}, readings: ${record.readings}`);
  }, [roundDuration, restDuration]);

  // ── Start session ─────────────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    sessionStartRef.current  = new Date();
    roundsRecorded.current   = [];
    prevRoundRef.current     = 1;
    restStartRef.current     = null;
    currentRoundAcc.current  = emptyAcc(new Date());

    startSession({ totalRounds: rounds, roundDuration, restDuration });
  }, [rounds, roundDuration, restDuration, startSession]);

  // ── End session ───────────────────────────────────────────────────────────
  const handleEnd = useCallback(async () => {
    if (!isSessionActive) return;

    // Seal whatever round is currently in progress
    sealCurrentRound(currentRound, false);

    const now      = new Date();
    const allRounds = roundsRecorded.current;

    // Aggregate across all rounds
    let totPunches = 0, peakSpd = 0, peakFrc = 0, sumSpd = 0, sumFrc = 0, sumReadings = 0;
    for (const r of allRounds) {
      totPunches  = Math.max(totPunches, r.totalPunches);
      peakSpd     = Math.max(peakSpd, r.peakSpeedMs);
      peakFrc     = Math.max(peakFrc, r.peakForceN);
      sumSpd     += r.avgSpeedMs * r.readings;
      sumFrc     += r.avgForceN  * r.readings;
      sumReadings += r.readings;
    }

    const sessionRecord: SessionRecord = {
      id:           now.getTime().toString(),
      date:         now.toISOString().split('T')[0],
      day:          now.toLocaleDateString('en-US', { weekday: 'long' }),
      startedAt:    sessionStartRef.current?.toISOString() ?? now.toISOString(),
      endedAt:      now.toISOString(),
      dataSource:   useMockData ? 'mock' : 'bluetooth',
      totalRounds:  allRounds.length,
      rounds:       allRounds,
      totalPunches: totPunches,
      peakSpeedMs:  parseFloat(peakSpd.toFixed(2)),
      peakForceN:   parseFloat(peakFrc.toFixed(2)),
      avgSpeedMs:   sumReadings > 0 ? parseFloat((sumSpd / sumReadings).toFixed(2)) : 0,
      avgForceN:    sumReadings > 0 ? parseFloat((sumFrc / sumReadings).toFixed(2)) : 0,
    };

    await saveSessionToStorage(sessionRecord);
    setLastSession(sessionRecord);

    // Refresh history
    const updated = await loadSessions();
    setHistoryGroups(updated);

    endSession();
  }, [isSessionActive, currentRound, useMockData, sealCurrentRound, endSession]);

  // ── Live display values based on glove view ───────────────────────────────
  const hw = hardwareData as any;
  const dispLeft: GloveStats = {
    speed:     hw.l_speed     ?? 0,
    force:     hw.l_force_n   ?? 0,
    punchCnt:  hw.l_punch_cnt ?? 0,
    bestSpd:   hw.l_best_spd  ?? 0,
    bestFrc:   hw.l_best_frc  ?? 0,
    punchType: hw.l_punch_type ?? '',
  };
  const dispRight: GloveStats = {
    speed:     hw.r_speed     ?? 0,
    force:     hw.r_force_n   ?? 0,
    punchCnt:  hw.r_punch_cnt ?? 0,
    bestSpd:   hw.r_best_spd  ?? 0,
    bestFrc:   hw.r_best_frc  ?? 0,
    punchType: hw.r_punch_type ?? '',
  };

  const gaugeSpeed  = gloveView === 'left'  ? dispLeft.speed
                    : gloveView === 'right' ? dispRight.speed
                    : Math.max(dispLeft.speed, dispRight.speed);

  const gaugePunches = gloveView === 'left'  ? dispLeft.punchCnt
                     : gloveView === 'right' ? dispRight.punchCnt
                     : dispLeft.punchCnt + dispRight.punchCnt;

  const gaugeForce  = gloveView === 'left'  ? dispLeft.force
                    : gloveView === 'right' ? dispRight.force
                    : Math.max(dispLeft.force, dispRight.force);

  // ─────────────────────────────────────────────────────────────────────────
  //  Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  const renderGloveCard = (label: string, g: GloveStats, color: string) => (
    <View style={[styles.gloveCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <ThemedText style={[styles.gloveCardTitle, { color }]}>{label}</ThemedText>
      <View style={styles.gloveRow}>
        <View style={styles.gloveStat}>
          <ThemedText style={[styles.gloveVal, { color: theme.text }]}>{g.speed.toFixed(2)}</ThemedText>
          <ThemedText style={[styles.gloveKey, { color: theme.secondary }]}>m/s</ThemedText>
        </View>
        <View style={styles.gloveStat}>
          <ThemedText style={[styles.gloveVal, { color: theme.text }]}>{g.force.toFixed(1)}</ThemedText>
          <ThemedText style={[styles.gloveKey, { color: theme.secondary }]}>N</ThemedText>
        </View>
        <View style={styles.gloveStat}>
          <ThemedText style={[styles.gloveVal, { color: theme.text }]}>{g.punchCnt}</ThemedText>
          <ThemedText style={[styles.gloveKey, { color: theme.secondary }]}>punches</ThemedText>
        </View>
      </View>
      <View style={styles.gloveRow}>
        <View style={styles.gloveStat}>
          <ThemedText style={[styles.gloveVal, { color: '#FF9500' }]}>{g.bestSpd.toFixed(2)}</ThemedText>
          <ThemedText style={[styles.gloveKey, { color: theme.secondary }]}>best spd</ThemedText>
        </View>
        <View style={styles.gloveStat}>
          <ThemedText style={[styles.gloveVal, { color: '#5856D6' }]}>{g.bestFrc.toFixed(1)}</ThemedText>
          <ThemedText style={[styles.gloveKey, { color: theme.secondary }]}>best frc N</ThemedText>
        </View>
        {g.punchType !== '' && (
          <View style={styles.gloveStat}>
            <ThemedText style={[styles.gloveVal, { color: THEME_COLOR, fontSize: 11 }]}>{g.punchType}</ThemedText>
            <ThemedText style={[styles.gloveKey, { color: theme.secondary }]}>type</ThemedText>
          </View>
        )}
      </View>
    </View>
  );

  const renderRoundCard = (r: RoundRecord) => (
    <View key={r.roundNumber} style={[styles.roundCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {/* Round header */}
      <View style={styles.roundCardHeader}>
        <ThemedText style={[styles.roundCardTitle, { color: THEME_COLOR }]}>
          Round {r.roundNumber}
        </ThemedText>
        <ThemedText style={[styles.roundCardTime, { color: theme.secondary }]}>
          {fmtTime(r.startedAt)} → {fmtTime(r.endedAt)}
        </ThemedText>
        <View style={styles.roundDurationBadge}>
          <ThemedText style={styles.roundDurationText}>
            ⏱ {fmt(r.durationSec)}  💤 {fmt(r.restSec)}
          </ThemedText>
        </View>
      </View>

      {/* Stats grid */}
      <View style={styles.roundGrid}>
        {[
          { label: 'Punches',   value: r.totalPunches,           color: THEME_COLOR },
          { label: 'Peak spd',  value: `${r.peakSpeedMs} m/s`,   color: '#FF9500' },
          { label: 'Peak frc',  value: `${r.peakForceN} N`,      color: '#5856D6' },
          { label: 'Avg spd',   value: `${r.avgSpeedMs} m/s`,    color: '#FF9500' },
          { label: 'Avg frc',   value: `${r.avgForceN} N`,       color: '#5856D6' },
          { label: 'Readings',  value: r.readings,               color: theme.text },
        ].map(item => (
          <View key={item.label} style={[styles.roundGridCell, { backgroundColor: theme.surfaceContainer }]}>
            <ThemedText style={[styles.roundGridVal, { color: item.color as string }]}>
              {item.value}
            </ThemedText>
            <ThemedText style={[styles.roundGridKey, { color: theme.secondary }]}>
              {item.label}
            </ThemedText>
          </View>
        ))}
      </View>

      {/* Left / Right breakdown */}
      <View style={styles.gloveBreakdown}>
        {[
          { label: '🟢 LEFT',  g: r.left  },
          { label: '🔵 RIGHT', g: r.right },
        ].map(({ label, g }) => (
          <View key={label} style={[styles.gloveBreakdownCol, { backgroundColor: theme.surfaceContainer }]}>
            <ThemedText style={[styles.gloveBreakdownTitle, { color: theme.text }]}>{label}</ThemedText>
            <ThemedText style={[styles.gloveBreakdownStat, { color: theme.secondary }]}>
              Punches: <ThemedText style={{ color: theme.text }}>{g.punchCnt}</ThemedText>
            </ThemedText>
            <ThemedText style={[styles.gloveBreakdownStat, { color: theme.secondary }]}>
              Speed:   <ThemedText style={{ color: '#FF9500' }}>{g.speed.toFixed(2)} m/s</ThemedText>
            </ThemedText>
            <ThemedText style={[styles.gloveBreakdownStat, { color: theme.secondary }]}>
              Force:   <ThemedText style={{ color: '#5856D6' }}>{g.force.toFixed(1)} N</ThemedText>
            </ThemedText>
            <ThemedText style={[styles.gloveBreakdownStat, { color: theme.secondary }]}>
              Best spd: <ThemedText style={{ color: '#FF9500' }}>{g.bestSpd.toFixed(2)}</ThemedText>
            </ThemedText>
            <ThemedText style={[styles.gloveBreakdownStat, { color: theme.secondary }]}>
              Best frc: <ThemedText style={{ color: '#5856D6' }}>{g.bestFrc.toFixed(1)} N</ThemedText>
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );

  const renderSessionCard = (session: SessionRecord) => (
    <View key={session.id} style={[styles.sessionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {/* Session header */}
      <View style={styles.sessionCardHeader}>
        <View>
          <ThemedText style={[styles.sessionCardDate, { color: theme.text }]}>
            {session.day}, {session.date}
          </ThemedText>
          <ThemedText style={[styles.sessionCardTime, { color: theme.secondary }]}>
            {fmtDateTime(session.startedAt)} → {fmtTime(session.endedAt)}
          </ThemedText>
        </View>
        <View style={[
          styles.sourceBadge,
          { backgroundColor: session.dataSource === 'bluetooth' ? '#1a3a2a' : '#2a2a1a' }
        ]}>
          <ThemedText style={[
            styles.sourceBadgeText,
            { color: session.dataSource === 'bluetooth' ? '#4ade80' : '#facc15' }
          ]}>
            {session.dataSource === 'bluetooth' ? '📡 BT' : '🔄 Mock'}
          </ThemedText>
        </View>
      </View>

      {/* Session-level bests */}
      <View style={styles.roundGrid}>
        {[
          { label: 'Rounds',    value: session.totalRounds,            color: THEME_COLOR },
          { label: 'Punches',   value: session.totalPunches,           color: THEME_COLOR },
          { label: 'Peak spd',  value: `${session.peakSpeedMs} m/s`,   color: '#FF9500' },
          { label: 'Peak frc',  value: `${session.peakForceN} N`,      color: '#5856D6' },
          { label: 'Avg spd',   value: `${session.avgSpeedMs} m/s`,    color: '#FF9500' },
          { label: 'Avg frc',   value: `${session.avgForceN} N`,       color: '#5856D6' },
        ].map(item => (
          <View key={item.label} style={[styles.roundGridCell, { backgroundColor: theme.surfaceContainer }]}>
            <ThemedText style={[styles.roundGridVal, { color: item.color as string }]}>
              {item.value}
            </ThemedText>
            <ThemedText style={[styles.roundGridKey, { color: theme.secondary }]}>
              {item.label}
            </ThemedText>
          </View>
        ))}
      </View>

      {/* Per-round breakdown inside session */}
      {session.rounds.map(r => renderRoundCard(r))}
    </View>
  );

  // ═════════════════════════════════════════════════════════════════════════
  //  JSX
  // ═════════════════════════════════════════════════════════════════════════

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>

      {/* ── HISTORY MODAL ────────────────────────────────────────────────── */}
      <Modal visible={showHistory} animationType="slide" onRequestClose={() => setShowHistory(false)}>
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeader}>
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>Session History</ThemedText>
            <TouchableOpacity onPress={() => setShowHistory(false)}>
              <ThemedText style={{ color: THEME_COLOR, fontSize: 16, fontWeight: '700' }}>Close</ThemedText>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {historyGroups.length === 0 ? (
              <ThemedText style={[styles.emptyText, { color: theme.secondary }]}>
                No sessions recorded yet.
              </ThemedText>
            ) : (
              [...historyGroups].reverse().map(group => (
                <View key={group.date} style={{ marginBottom: 24 }}>
                  <View style={[styles.dateHeader, { borderBottomColor: theme.border }]}>
                    <ThemedText style={[styles.dateHeaderText, { color: THEME_COLOR }]}>
                      {group.day} · {group.date}
                    </ThemedText>
                    <ThemedText style={[styles.dateHeaderCount, { color: theme.secondary }]}>
                      {group.sessions.length} session{group.sessions.length !== 1 ? 's' : ''}
                    </ThemedText>
                  </View>
                  {[...group.sessions].reverse().map(s => renderSessionCard(s))}
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── FATIGUE ALERT ────────────────────────────────────────────────── */}
      <Modal visible={showFatigueAlert} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.alertCard, { backgroundColor: theme.surfaceContainer }]}>
            <ThemedText style={{ fontSize: 44, marginBottom: 8 }}>⚠️</ThemedText>
            <ThemedText style={[styles.alertTitle, { color: theme.danger }]}>Performance Dropping!</ThemedText>
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

      {!isSessionActive ? (
        /* ── PRE-SESSION ───────────────────────────────────────────────── */
        <ScrollView contentContainerStyle={styles.preSession}>

          <ThemedText style={{ fontSize: 56, marginBottom: 8 }}>🥊</ThemedText>
          <ThemedText style={[styles.preTitle, { color: theme.text }]}>Ready to Train?</ThemedText>

          {/* Live hardware preview */}
          <View style={[styles.livePreview, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ThemedText style={[styles.livePreviewTitle, { color: theme.secondary }]}>
              Live Hardware Preview
            </ThemedText>
            <View style={styles.livePreviewRow}>
              {renderGloveCard('LEFT  🟢', dispLeft,  '#4ade80')}
              {renderGloveCard('RIGHT 🔵', dispRight, '#60a5fa')}
            </View>
          </View>

          {/* Config card */}
          <View style={[styles.configCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {[
              { label: 'Rounds',         val: rounds,        set: setRounds,        min: 1,  max: 20,  step: 1,  display: String(rounds) },
              { label: 'Round Duration', val: roundDuration, set: setRoundDuration, min: 30, max: 600, step: 30, display: fmt(roundDuration) },
              { label: 'Rest Period',    val: restDuration,  set: setRestDuration,  min: 10, max: 300, step: 10, display: fmt(restDuration) },
            ].map((cfg, i, arr) => (
              <View key={cfg.label}>
                <View style={[styles.configRow, styles.stepperRow]}>
                  <ThemedText style={[styles.configLabel, { color: theme.secondary }]}>{cfg.label}</ThemedText>
                  <View style={styles.stepperControls}>
                    <TouchableOpacity
                      style={[styles.stepperButton, { borderColor: theme.border }]}
                      onPress={() => cfg.set((v: number) => Math.max(cfg.min, v - cfg.step))}
                      disabled={cfg.val <= cfg.min}
                    >
                      <ThemedText style={[styles.stepperButtonText, { color: cfg.val <= cfg.min ? theme.secondary : theme.text }]}>−</ThemedText>
                    </TouchableOpacity>
                    <ThemedText style={[styles.configValue, { color: theme.text }]}>{cfg.display}</ThemedText>
                    <TouchableOpacity
                      style={[styles.stepperButton, { borderColor: theme.border }]}
                      onPress={() => cfg.set((v: number) => Math.min(cfg.max, v + cfg.step))}
                      disabled={cfg.val >= cfg.max}
                    >
                      <ThemedText style={[styles.stepperButtonText, { color: theme.text }]}>+</ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
                {i < arr.length - 1 && <View style={[styles.configDivider, { backgroundColor: theme.border }]} />}
              </View>
            ))}
          </View>

          {/* Mock toggle */}
          <TouchableOpacity
            style={[styles.mockToggle, { borderColor: theme.border }]}
            onPress={() => setUseMockData(v => !v)}
          >
            <ThemedText style={[styles.mockToggleText, { color: theme.secondary }]}>
              {useMockData ? '🔄 Mock Data: ON' : '📡 Real Bluetooth Data'}
            </ThemedText>
          </TouchableOpacity>

          {/* History button */}
          <TouchableOpacity
            style={[styles.historyButton, { borderColor: theme.border }]}
            onPress={() => setShowHistory(true)}
          >
            <ThemedText style={[styles.historyButtonText, { color: theme.text }]}>
              📋 View Session History
            </ThemedText>
          </TouchableOpacity>

          {/* Start */}
          <TouchableOpacity style={styles.startButton} onPress={handleStart}>
            <ThemedText style={styles.startButtonText}>🔔 START SESSION</ThemedText>
          </TouchableOpacity>

          {/* Last session summary */}
          {lastSession && (
            <View style={{ width: '100%', marginTop: 24 }}>
              <ThemedText style={[styles.sectionLabel, { color: theme.secondary }]}>
                LAST SESSION SUMMARY
              </ThemedText>
              {renderSessionCard(lastSession)}
            </View>
          )}
        </ScrollView>

      ) : (
        /* ── ACTIVE SESSION HUD ────────────────────────────────────────── */
        <View style={styles.hud}>

          <RoundTimer
            currentRound={currentRound}
            totalRounds={totalRounds}
            formattedTime={formattedTime}
            isResting={isResting}
          />

          {/* Glove selector tabs */}
          <View style={[styles.tabContainer, { backgroundColor: theme.surfaceContainer }]}>
            {(['left', 'both', 'right'] as const).map(mode => (
              <TouchableOpacity
                key={mode}
                style={[styles.tabButton, gloveView === mode && { backgroundColor: THEME_COLOR }]}
                onPress={() => setGloveView(mode)}
              >
                <ThemedText style={[
                  styles.tabText,
                  { color: gloveView === mode ? '#fff' : theme.secondary },
                ]}>
                  {mode === 'left' ? '🟢 L' : mode === 'right' ? '🔵 R' : '⚡ BOTH'}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {/* Main gauges */}
          <View style={styles.gaugesRow}>
            <CircularGauge
              value={gaugeSpeed}
              maxValue={30}
              label="Speed"
              unit="m/s"
              color="#FF9500"
            />
            <CircularGauge
              value={gaugePunches}
              maxValue={500}
              label="Punches"
              unit="total"
              color={THEME_COLOR}
              size={130}
            />
            <CircularGauge
              value={gaugeForce}
              maxValue={120}
              label="Force"
              unit="N"
              color="#5856D6"
            />
          </View>

          {/* Per-glove live cards */}
          {(gloveView === 'both' || gloveView === 'left') && renderGloveCard('LEFT GLOVE  🟢', dispLeft,  '#4ade80')}
          {(gloveView === 'both' || gloveView === 'right') && renderGloveCard('RIGHT GLOVE 🔵', dispRight, '#60a5fa')}

          {/* Average */}
          <View style={styles.avgRow}>
            <ThemedText style={[styles.avgLabel, { color: theme.secondary }]}>AVG SPEED</ThemedText>
            <ThemedText style={[styles.avgValue, { color: '#FF9500' }]}>
              {averageSpeed.toFixed(1)} m/s
            </ThemedText>
          </View>

          <FatigueBar fatigue={fatigueLevel} />

          <View style={styles.hudFooter}>
            <TouchableOpacity
              style={[styles.endButton, { borderColor: theme.danger }]}
              onPress={handleEnd}
            >
              <ThemedText style={[styles.endButtonText, { color: theme.danger }]}>
                ⏹ END SESSION
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:       { flex: 1 },

  // Pre-session
  preSession:      { padding: 20, alignItems: 'center', paddingBottom: 40 },
  preTitle:        { fontSize: 26, fontWeight: '800', marginBottom: 16, letterSpacing: -0.5 },
  sectionLabel:    { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },

  // Live preview
  livePreview:     { width: '100%', borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 16 },
  livePreviewTitle:{ fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  livePreviewRow:  { flexDirection: 'row', gap: 8 },

  // Glove card
  gloveCard:       { flex: 1, borderRadius: 12, borderWidth: 1, padding: 10, marginBottom: 8 },
  gloveCardTitle:  { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  gloveRow:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  gloveStat:       { alignItems: 'center', flex: 1 },
  gloveVal:        { fontSize: 14, fontWeight: '700' },
  gloveKey:        { fontSize: 9,  fontWeight: '600' },

  // Config
  configCard:      { width: '100%', borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 16 },
  configRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepperRow:      { paddingVertical: 8 },
  configLabel:     { fontSize: 15, fontWeight: '500' },
  configValue:     { fontSize: 15, fontWeight: '700', minWidth: 52, textAlign: 'center' },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperButton:   { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepperButtonText:{ fontSize: 18, fontWeight: '500', lineHeight: 20 },
  configDivider:   { height: 1 },

  mockToggle:      { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, marginBottom: 12 },
  mockToggleText:  { fontSize: 12, fontWeight: '600' },

  historyButton:   { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 20, borderWidth: 1, marginBottom: 20 },
  historyButtonText:{ fontSize: 13, fontWeight: '600' },

  startButton:     { backgroundColor: THEME_COLOR, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 16, elevation: 6 },
  startButtonText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 2 },

  // Session & round cards
  sessionCard:     { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 16 },
  sessionCardHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  sessionCardDate: { fontSize: 14, fontWeight: '700' },
  sessionCardTime: { fontSize: 11, marginTop: 2 },
  sourceBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  sourceBadgeText: { fontSize: 10, fontWeight: '700' },

  roundCard:       { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 10 },
  roundCardHeader: { marginBottom: 8 },
  roundCardTitle:  { fontSize: 13, fontWeight: '800' },
  roundCardTime:   { fontSize: 11, marginTop: 2 },
  roundDurationBadge:{ marginTop: 4 },
  roundDurationText: { fontSize: 11, color: '#aaa' },

  roundGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  roundGridCell:   { borderRadius: 8, padding: 8, alignItems: 'center', minWidth: '30%', flex: 1 },
  roundGridVal:    { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  roundGridKey:    { fontSize: 9,  fontWeight: '600' },

  gloveBreakdown:  { flexDirection: 'row', gap: 8 },
  gloveBreakdownCol:{ flex: 1, borderRadius: 10, padding: 10 },
  gloveBreakdownTitle:{ fontSize: 11, fontWeight: '700', marginBottom: 6 },
  gloveBreakdownStat: { fontSize: 11, marginBottom: 3 },

  // History modal
  modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 8 },
  modalTitle:      { fontSize: 20, fontWeight: '800' },
  dateHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, paddingBottom: 6, marginBottom: 10 },
  dateHeaderText:  { fontSize: 13, fontWeight: '700' },
  dateHeaderCount: { fontSize: 11 },
  emptyText:       { textAlign: 'center', marginTop: 40, fontSize: 15 },

  // HUD
  hud:             { flex: 1, paddingTop: 4 },
  tabContainer:    { flexDirection: 'row', marginHorizontal: 16, marginVertical: 8, borderRadius: 12, padding: 4 },
  tabButton:       { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabText:         { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  gaugesRow:       { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 10, marginVertical: 8 },
  avgRow:          { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 6 },
  avgLabel:        { fontSize: 11, letterSpacing: 1.5, fontWeight: '600' },
  avgValue:        { fontSize: 11, fontWeight: '800' },
  hudFooter:       { paddingHorizontal: 20, paddingBottom: 20, marginTop: 'auto' },
  endButton:       { paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, alignItems: 'center' },
  endButtonText:   { fontSize: 15, fontWeight: '700', letterSpacing: 1 },

  // Fatigue modal
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  alertCard:       { borderRadius: 24, padding: 28, alignItems: 'center', width: '100%' },
  alertTitle:      { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  alertMessage:    { fontSize: 15, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  alertButton:     { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14 },
  alertButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
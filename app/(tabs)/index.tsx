import React, { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, THEME_COLOR } from '@/constants/Colors';
import { useTheme } from '@/context/ThemeContext';
import { useAppSelector } from '@/store/hooks';
import { useBluetooth } from '@/hooks/useBluetooth';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useHardware } from "../../context/sethardware";
import { bluetoothService } from '@/utils/bluetooth';
import { Subscription } from 'react-native-ble-plx';
import { initDatabase, startSession,savePunchEvent, endSession, saveBatch, SessionSummary }  from '../../types/db'
import { exportSession, shareSession } from '../../types/export';



// --- ESP32 CONFIGURATION ---
// Replace these with the actual UUIDs from your ESP32 code 
const ESP_SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const ESP_CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

// ---------------------------

const sensorBuffer: any[] = [];

// ── Hardware data shape ──────────────────────────────────────────────────────
type HardwareData = {
  rawJson:   string;
  punch:     number;
  power:     number;   // force_n
  speed:     number;   // speed_ms
  peak_g:    number;
  punchType: string;
  bestSpeed: number;
  bestForce: number;
};

const DEFAULT_HARDWARE: HardwareData = {
  rawJson:   '',
  punch:     0,
  power:     0,
  speed:     0,
  peak_g:    0,
  punchType: '',
  bestSpeed: 0,
  bestForce: 0,
};


export default function ConnectScreen() {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? Colors.dark : Colors.light;
  const [imeiInput, setImeiInput] = useState('');
  const { isConnected, deviceName } = useAppSelector(state => state.connection);
  const { devices: scannedDevices, connect, disconnect, scanDevices } = useBluetooth();

  const [isScanning, setIsScanning] = useState(false);
  const [imeiVerified, setImeiVerified] = useState<boolean | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(null);


   const subscriptionRef = useRef<Subscription | null>(null);
  const flushIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentSessionId = useRef<string | null>(null); // NOT state — no re-render needed

  const [isRecording, setIsRecording] = useState(false);
  const [hardwareData, setHardwareData] = useState<HardwareData>(DEFAULT_HARDWARE);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  

  // 1. Wrap the function in useCallback to stabilize it
  // const fetchEsp32Data = useCallback(async (deviceId: any) => {
  //   if (isFetchingRef.current) return; // Prevent overlapping calls

  //   try {
  //     isFetchingRef.current = true;

  //     // Read the characteristic value
  //     const value = await bluetoothService.readCharacteristic(
  //       deviceId,
  //       ESP_SERVICE_UUID,
  //       ESP_CHARACTERISTIC_UUID
  //     );

  //     if (!value) {
  //        console.log('No value returned from characteristic');
  //       return;
  //     };

  //     // BLE data comes as Base64, decode it
  //     const decodedData = atob(value).trim();
  //     console.log('Decoded raw:', decodedData)

  //     const parsed = JSON.parse(decodedData);

  //     // Safely extract data from the LEFT HAND

  //     setHardwareData({
  //       speed: parsed.best_speed || 0,
  //       punch: parsed.punch || 0,
  //       power: parsed.force_n || 0,
  //     }); // Auto-fill the input
      
  //   } catch (error: any) {
  //     // Don't spam console on every failed poll
  //     if (error?.message?.includes('rejected')) {
  //       console.warn('Read rejected — device may be busy');
  //     } else {
  //       console.error('Failed to read ESP32 data:', error);
  //     }
  //   } finally {
  //     isFetchingRef.current = false;
  //   }
  // }, []); // Dependencies

  // ── 1. Init DB once + pre-create first session ───────────────────────────
  useEffect(() => {
    initDatabase();
    const sessionId = startSession();
    currentSessionId.current = sessionId;
    console.log('DB ready. First session pre-created:', sessionId);
  }, []);


 useEffect(() => {
    if (!connectedDeviceId) return;

    console.log('Starting BLE monitor for device:', connectedDeviceId);

    // ── Start the 500ms flush interval ─────────────────────────────────────
    flushIntervalRef.current = setInterval(async () => {
      if (!currentSessionId.current)   return;
      if (sensorBuffer.length === 0)   return;

      const batch = [...sensorBuffer];
      sensorBuffer.length = 0;

      try {
        await saveBatch(batch, currentSessionId.current);
        console.log(`Flushed ${batch.length} rows → SQLite`);
      } catch (e) {
        console.error('Batch save failed:', e);
      }
    }, 500);

    // ── Subscribe to BLE notifications ─────────────────────────────────────
    subscriptionRef.current = bluetoothService.monitorCharacteristic(
      connectedDeviceId,
      ESP_SERVICE_UUID,
      ESP_CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error) {
          console.warn('Monitor error:', error);
          return;
        }
        if (!characteristic?.value) return;

        try {
          const decodedData = atob(characteristic.value).trim();
          const parsed      = JSON.parse(decodedData);

          const isPunchEvent = 'speed_ms' in parsed;
          const isRawStream  = 'L' in parsed && 'R' in parsed;

          // ── RAW IMU stream packet ─────────────────────────────────────
          if (isRawStream) {
            setHardwareData(prev => ({ ...prev, rawJson: decodedData }));

            if (currentSessionId.current) {
              sensorBuffer.push(parsed);
              // Safety cap — drop oldest if flush is stalling
              if (sensorBuffer.length > 500) sensorBuffer.shift();
            } else {
              console.warn('RAW: no session ID — skipping buffer');
            }

          // ── PUNCH EVENT packet ────────────────────────────────────────
          } else if (isPunchEvent) {
            console.log('🥊 PUNCH EVENT received:', parsed);

            setHardwareData(prev => ({
              ...prev,
              punch:     parsed.punch     ?? prev.punch,
              power:     parsed.force_n   ?? prev.power,
              speed:     parsed.speed_ms  ?? prev.speed,
              peak_g:    parsed.peak_g    ?? prev.peak_g,
              punchType: parsed.type      ?? prev.punchType,
              bestSpeed: parsed.best_speed ?? prev.bestSpeed,
              bestForce: parsed.best_force ?? prev.bestForce,
            }));

            if (currentSessionId.current) {
              savePunchEvent(currentSessionId.current, parsed)
                .then(() => console.log('Punch saved to DB ✓'))
                .catch(e  => console.error('Punch save FAILED:', e));
            } else {
              console.warn('PUNCH: no session ID — punch not saved!');
            }

          } else {
            console.warn('Unknown packet shape, keys:', Object.keys(parsed));
          }

        } catch (e) {
          console.log('JSON parse failed — waiting for valid packet');
        }
      }
    );
      // ── Cleanup when device disconnects or changes ────────────────────────
    return () => {
      console.log('Cleaning up BLE monitor');

      // Stop flush interval
      if (flushIntervalRef.current) {
        clearInterval(flushIntervalRef.current);
        flushIntervalRef.current = null;
      }

      // Final flush — save whatever is still in buffer
      if (sensorBuffer.length > 0 && currentSessionId.current) {
        saveBatch([...sensorBuffer], currentSessionId.current)
          .catch(e => console.error('Final flush failed:', e));
        sensorBuffer.length = 0;
      }

      // Stop BLE subscription
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, [connectedDeviceId]);


  const handleScan = async () => {
    setIsScanning(true);
    await scanDevices(5000);
    setIsScanning(false);
  };


  const handleConnect = async (device: { id: string; name: string }) => {
    setConnectingId(device.id);
    try {
      await connect(device);
      setConnectedDeviceId(device.id);
    } finally {
      setConnectingId(null);
    }
  };


  const handleVerifyIMEI = () => {
    // Prototype: accept any 15-digit IMEI or "demo"
    if (imeiInput.toLowerCase() === 'demo' || imeiInput.length === 15) {
      setImeiVerified(true);
    } else {
      setImeiVerified(false);
    }
  };

// Start Round button — just marks UI as recording
const handleStartRound = () => {
  sensorBuffer.length = 0; // clear any pre-session data
  setIsRecording(true);
  setSummary(null);
   console.log('Round started. Session:', currentSessionId.current);
};


    // ── End Round ─────────────────────────────────────────────────────────────
// End Round — exports and creates next session
 const handleEndRound = async () => {
    if (!currentSessionId.current) {
      console.warn('End round called but no session ID');
      return;
    }

    console.log('Ending round for session:', currentSessionId.current);

    // Stop flush interval
    if (flushIntervalRef.current) {
      clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = null;
    }

    // Final flush of remaining buffer
    if (sensorBuffer.length > 0) {
      await saveBatch([...sensorBuffer], currentSessionId.current)
        .catch(e => console.error('Final batch save failed:', e));
      sensorBuffer.length = 0;
    }

    // Verify what was saved — helps debug empty files
    console.log('=== SESSION SUMMARY ===');
    console.log('Session ID:', currentSessionId.current);
    console.log('=======================');

    // Close session in DB
    const sessionSummary = endSession(currentSessionId.current);
    setSummary(sessionSummary);

    // Export + share both CSV files
    try {
      await shareSession(currentSessionId.current);
    } catch (e) {
      console.error('Export failed:', e);
      Alert.alert('Export failed', String(e));
    }

    // Pre-create next session immediately so ref is never null
    const nextSessionId = startSession();
    currentSessionId.current = nextSessionId;
    console.log('Next session ready:', nextSessionId);

    // Restart flush interval for the new session
    flushIntervalRef.current = setInterval(async () => {
      if (!currentSessionId.current)  return;
      if (sensorBuffer.length === 0)  return;

      const batch = [...sensorBuffer];
      sensorBuffer.length = 0;

      await saveBatch(batch, currentSessionId.current)
        .catch(e => console.error('Batch save failed:', e));
    }, 500);

    setIsRecording(false);
  };


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.gloveEmoji}>🥊</ThemedText>
          <ThemedText style={[styles.title, { color: theme.text }]}>
            {isConnected ? 'Gloves Connected!' : 'Connect Your Gloves'}
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.secondary }]}>
            {isConnected
              ? `${deviceName || 'Glove'} is ready for action`
              : 'Pair your boxing gloves via Bluetooth'}
          </ThemedText>

          <ThemedText style={{ color: theme.text }}>
            {hardwareData.speed} | {hardwareData.power} | {hardwareData.punch}
          </ThemedText>
        </View>

        {/** ble provider */}



        {/* Connection Status */}
        {isConnected ? (
          <View style={[styles.connectedCard, { backgroundColor: theme.surface, borderColor: theme.success + '40' }]}>
            <View style={styles.connectedHeader}>
              <View style={[styles.statusDot, { backgroundColor: theme.success }]} />
              <ThemedText style={[styles.connectedLabel, { color: theme.success }]}>
                Connected
              </ThemedText>
            </View>
            <ThemedText style={styles.deviceNameLarge}>{deviceName || 'Boxing Glove'}</ThemedText>

            {/* IMEI Verification */}
            <View style={styles.imeiSection}>
              <View style={styles.imeiRowHeader}>
                <ThemedText style={[styles.imeiLabel, { color: theme.secondary }]}>
                  Hardware Verification (IMEI)
                </ThemedText>
                {/* New Button to manually fetch data again */}
                <TouchableOpacity
                  onPress={() => {
                    if (subscriptionRef.current) {
                      subscriptionRef.current.remove();
                      subscriptionRef.current = null;
                    }
                  }}
                  disabled={isFetching}
                >
                  <ThemedText style={[styles.fetchLink, { color: THEME_COLOR }]}>
                    {isFetching ? 'Reading...' : 'Re-read Hardware'}
                  </ThemedText>
                </TouchableOpacity>
              </View>

              <View style={styles.imeiRow}>
                <TextInput
                  style={[styles.imeiInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceContainer }]}
                  placeholder="IMEI or 'demo'"
                  placeholderTextColor={theme.secondary}
                  value={imeiInput}
                  onChangeText={setImeiInput}
                />
                <TouchableOpacity
                  style={[styles.verifyButton]}
                  onPress={handleVerifyIMEI}
                >
                  <ThemedText style={styles.verifyButtonText}>Verify</ThemedText>
                </TouchableOpacity>
              </View>
              {imeiVerified === true && (
                <View style={styles.verifiedBadge}>
                  <ThemedText style={styles.verifiedText}>✅ Hardware Verified</ThemedText>
                </View>
              )}
              {imeiVerified === false && (
                <View style={styles.failedBadge}>
                  <ThemedText style={styles.failedText}>❌ Hardware Not Verified</ThemedText>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.disconnectButton, { borderColor: theme.danger }]}
              onPress={() => disconnect()}
            >
              <ThemedText style={[styles.disconnectText, { color: theme.danger }]}>
                Disconnect Gloves
              </ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Scan Button */}
            <TouchableOpacity
              style={[styles.scanButton, isScanning && styles.scanButtonActive]}
              onPress={handleScan}
              disabled={isScanning}
            >
              <IconSymbol name="search" size={18} color="white" />
              <ThemedText style={styles.scanButtonText}>
                {isScanning ? 'Scanning...' : 'Scan for Gloves'}
              </ThemedText>
            </TouchableOpacity>

            {/* Discovered Devices */}
            {scannedDevices.length > 0 && (
              <View style={styles.devicesSection}>
                <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                  Nearby Devices
                </ThemedText>
                {scannedDevices.map(device => (
                  <View key={device.id} style={[styles.deviceItem, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={styles.deviceInfo}>
                      <View style={[styles.deviceIcon, { backgroundColor: THEME_COLOR + '20' }]}>
                        <ThemedText style={{ fontSize: 18 }}>🥊</ThemedText>
                      </View>
                      <View>
                        <ThemedText style={styles.deviceName}>{device.name}</ThemedText>
                        <ThemedText style={[styles.deviceId, { color: theme.secondary }]}>{device.id.slice(0, 17)}...</ThemedText>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.connectButton, connectingId === device.id && styles.connectButtonActive]}
                      onPress={() => handleConnect(device)}
                      disabled={!!connectingId}
                    >
                      <ThemedText style={styles.connectButtonText}>
                        {connectingId === device.id ? 'Connecting...' : 'Connect'}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {scannedDevices.length === 0 && !isScanning && (
              <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <ThemedText style={{ fontSize: 40, marginBottom: 12 }}>👆</ThemedText>
                <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
                  Tap 'Scan for Gloves'
                </ThemedText>
                <ThemedText style={[styles.emptySubtitle, { color: theme.secondary }]}>
                  Make sure your gloves are powered on and in pairing mode
                </ThemedText>
              </View>
            )}
          </>
        )}

           {/* Live sensor display */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <ThemedText style={[styles.label, { color: theme.secondary }]}>Left punch force</ThemedText>
        <ThemedText style={[styles.value, { color: theme.text }]}>{hardwareData.power.toFixed(2)} N</ThemedText>
      </View>

      {/* Start / End button */}
      <TouchableOpacity
        style={[styles.button, isRecording ? styles.buttonStop : styles.buttonStart]}
        onPress={isRecording ? handleEndRound : handleStartRound}
      >
        <ThemedText style={styles.buttonText}>
          {isRecording ? '⏹ End Round' : '▶ Start Round'}
        </ThemedText>
      </TouchableOpacity>

      {/* Post-session summary */}
      {summary && (
        <View style={styles.summary}>
          <ThemedText style={styles.summaryTitle}>Round complete</ThemedText>
          <ThemedText style={styles.summaryLine}>
            Duration: {(summary.durationMs / 1000).toFixed(1)}s
          </ThemedText>
          <ThemedText style={styles.summaryLine}>
            Readings saved: {summary.totalReadings}
          </ThemedText>
          <ThemedText style={styles.summaryLine}>
            Sample rate: {summary.samplesPerSecond} Hz
          </ThemedText>
        </View>
      )}


      </ScrollView>
    </SafeAreaView>

  );
};


// Styles
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 30 },
  gloveEmoji: { fontSize: 60, marginBottom: 10 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { fontSize: 16, textAlign: 'center', marginTop: 5 },
  scanButton: {
    flexDirection: 'row',
    backgroundColor: THEME_COLOR,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 10,
  },
  scanButtonActive: { opacity: 0.7 },
  scanButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  devicesSection: { gap: 15 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
  },
  deviceInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  deviceIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  deviceName: { fontSize: 16, fontWeight: '600' },
  deviceId: { fontSize: 12, marginTop: 2 },
  connectButton: {
    backgroundColor: THEME_COLOR,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  connectButtonActive: { backgroundColor: '#ccc' },
  connectButtonText: { color: 'white', fontWeight: '600', fontSize: 14 },
  emptyState: {
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginTop: 5 },
  connectedCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  connectedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  connectedLabel: { fontSize: 14, fontWeight: '600' },
  deviceNameLarge: { fontSize: 24, fontWeight: 'bold', marginBottom: 30 },
  imeiSection: { width: '100%', marginBottom: 20 },
  imeiRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  fetchLink: { fontSize: 12, fontWeight: '600' },
  imeiLabel: { fontSize: 14, marginBottom: 8 },
  imeiRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  imeiInput: {
    flex: 1,
    height: 100,
    fontSize: 14,
  },
  verifyButton: {
    backgroundColor: THEME_COLOR,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
  },
  verifyButtonText: { color: 'white', fontWeight: '600' },
  verifiedBadge: {
    backgroundColor: '#e8f5e9',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  verifiedText: { color: '#2e7d32', fontWeight: '600' },
  failedBadge: {
    backgroundColor: '#ffebee',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  failedText: { color: '#c62828', fontWeight: '600' },
  disconnectButton: {
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginTop: 10,
  },
  disconnectText: { fontWeight: '600' },

  card: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 20, marginBottom: 16 },
  label: { color: '#888', fontSize: 13, marginBottom: 4 },
  value: { color: '#fff', fontSize: 32, fontWeight: '600' },
  button: { borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 8 },
  buttonStart: { backgroundColor: '#22c55e' },
  buttonStop: { backgroundColor: '#ef4444' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  summary: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 20, marginTop: 24 },
  summaryTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 12 },
  summaryLine: { color: '#aaa', fontSize: 14, marginBottom: 6 },
});
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, View, TouchableOpacity,
  TextInput, Alert, ScrollView,
} from 'react-native';
import { useHardware } from '@/context/sethardware';
import { ThemedText } from '@/components/ThemedText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, THEME_COLOR } from '@/constants/Colors';
import { useTheme } from '@/context/ThemeContext';
import { useAppSelector } from '@/store/hooks';
import { useBluetooth } from '@/hooks/useBluetooth';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { bluetoothService } from '@/utils/bluetooth';
import { Subscription } from 'react-native-ble-plx';
import {
  initDatabase, startSession, endSession,
  saveBatch, SessionSummary, RawPacket,
} from '../../types/db';
import { shareSession } from '../../types/export';

const ESP_SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const ESP_CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
const TARGET_DEVICE_NAME = 'ESP32_RIGHT_RELAY';

export default function ConnectScreen() {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? Colors.dark : Colors.light;

  const { isConnected, deviceName } = useAppSelector(s => s.connection);
  const { devices: scannedDevices, connect, disconnect, scanDevices } = useBluetooth();

  const [imeiInput, setImeiInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [imeiVerified, setImeiVerified] = useState<boolean | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  // Live display values — read directly from ESP32 JSON
  const [liveData, setLiveData] = useState({
    l_speed: 0, l_force_n: 0, l_punch_cnt: 0,
    l_best_spd: 0, l_best_frc: 0, l_punch_type: '',
    r_speed: 0, r_force_n: 0, r_punch_cnt: 0,
    r_best_spd: 0, r_best_frc: 0, r_punch_type: '',
    ts: 0,
  });

  const subscriptionRef = useRef<Subscription | null>(null);
  const flushIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentSessionId = useRef<string | null>(null);
  const sensorBuffer = useRef<RawPacket[]>([]);
  const isFlushing = useRef(false);

  const { setHardwareData } = useHardware();

  // ── Init DB on mount ──────────────────────────────────────────────────────
  // useEffect(() => {
  //   initDatabase();
  //   currentSessionId.current = startSession();
  //   console.log('DB ready. Session:', currentSessionId.current);
  // }, []);

  // ── BLE monitor — starts when device connects ─────────────────────────────
  useEffect(() => {
    if (!connectedDeviceId) return;

    // Start 5000ms flush interval
    flushIntervalRef.current = setInterval(async () => {
      // 1. Guard: If we are already flushing, skip this tick to prevent overlap
      if (isFlushing.current) {
        console.log('⏳ Previous batch still saving, skipping this cycle...');
        return;
      }

      if (!currentSessionId.current) return;
      if (sensorBuffer.current.length === 0) return;

      // 2. Lock and prepare data
      isFlushing.current = true;
      const batch = [...sensorBuffer.current]; // Copy data
      sensorBuffer.current = []; // Clear buffer immediately

      try {
        saveBatch(batch, currentSessionId.current);
        // console.log(`✅ Flushed ${batch.length} rows`);
      } catch (e) {
        console.error('Batch save failed:', e);
        // Optional: If you want to retry failed data, you would push 'batch' back into sensorBuffer here
      } finally {
        // 3. Release lock
        isFlushing.current = false;
      }
    }, 5000);

    // Subscribe to BLE notifications
    subscriptionRef.current = bluetoothService.monitorCharacteristic(
      connectedDeviceId,
      ESP_SERVICE_UUID,
      ESP_CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error) { console.warn('BLE error:', error); return; }
        if (!characteristic?.value) return;

        try {
          const decoded = atob(characteristic.value).trim();
          const parsed = JSON.parse(decoded) as RawPacket;
          // Must have L and R keys — that's the only packet shape we expect now
          if (!('L' in parsed) || !('R' in parsed)) {
            console.warn('Unexpected packet shape:', Object.keys(parsed));
            return;
          }

          // ── Update shared context — Practice screen reads this ─────────
          setHardwareData({
            speed: parsed.L?.speed ?? 0,
            punch: (parsed.L?.punch_cnt ?? 0) + (parsed.R?.punch_cnt ?? 0),
            power: parsed.L?.force_n ?? 0,
            l_ax: parsed.L?.ax ?? 0,
            l_ay: parsed.L?.ay ?? 0,
            l_az: parsed.L?.az ?? 0,
            l_gx: parsed.L?.gx ?? 0,
            l_gy: parsed.L?.gy ?? 0,
            l_gz: parsed.L?.gz ?? 0,
            l_mag: parsed.L?.mag ?? 0,
            l_speed: parsed.L?.speed ?? 0,
            l_punch: parsed.L?.punch ?? 0,
            l_punch_cnt: parsed.L?.punch_cnt ?? 0,
            l_force_n: parsed.L?.force_n ?? 0,
            l_peak_g: parsed.L?.peak_g ?? 0,
            l_punch_type: parsed.L?.punch_type ?? '',
            l_best_spd: parsed.L?.best_spd ?? 0,
            l_best_frc: parsed.L?.best_frc ?? 0,
            r_ax: parsed.R?.ax ?? 0,
            r_ay: parsed.R?.ay ?? 0,
            r_az: parsed.R?.az ?? 0,
            r_gx: parsed.R?.gx ?? 0,
            r_gy: parsed.R?.gy ?? 0,
            r_gz: parsed.R?.gz ?? 0,
            r_mag: parsed.R?.mag ?? 0,
            r_speed: parsed.R?.speed ?? 0,
            r_punch: parsed.R?.punch ?? 0,
            r_punch_cnt: parsed.R?.punch_cnt ?? 0,
            r_force_n: parsed.R?.force_n ?? 0,
            r_peak_g: parsed.R?.peak_g ?? 0,
            r_punch_type: parsed.R?.punch_type ?? '',
            r_best_spd: parsed.R?.best_spd ?? 0,
            r_best_frc: parsed.R?.best_frc ?? 0,
            ts: parsed.ts ?? 0,
          });

          // ── Update local screen UI ─────────────────────────────────────
          setLiveData({
            l_speed: parsed.L?.speed ?? 0,
            l_force_n: parsed.L?.force_n ?? 0,
            l_punch_cnt: parsed.L?.punch_cnt ?? 0,
            l_best_spd: parsed.L?.best_spd ?? 0,
            l_best_frc: parsed.L?.best_frc ?? 0,
            l_punch_type: parsed.L?.punch_type ?? '',
            r_speed: parsed.R?.speed ?? 0,
            r_force_n: parsed.R?.force_n ?? 0,
            r_punch_cnt: parsed.R?.punch_cnt ?? 0,
            r_best_spd: parsed.R?.best_spd ?? 0,
            r_best_frc: parsed.R?.best_frc ?? 0,
            r_punch_type: parsed.R?.punch_type ?? '',
            ts: parsed.ts ?? 0,
          });

          // Push to buffer — always, session was pre-created on mount
          sensorBuffer.current.push(parsed);
          if (sensorBuffer.current.length > 500) {
            sensorBuffer.current.shift();
          }

        } catch {
          // Partial / malformed packet — wait for next one
        }
      }
    );

    return () => {
      if (flushIntervalRef.current) {
        clearInterval(flushIntervalRef.current);
        flushIntervalRef.current = null;
      }
      // Final flush before cleanup
      if (sensorBuffer.current.length > 0 && currentSessionId.current) {
        try {
          saveBatch([...sensorBuffer.current], currentSessionId.current)
        } catch (e) { console.error('Final flush failed:', e); }
        sensorBuffer.current = [];
      }
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;


      // Reset context so Practice shows zeros when glove disconnects
      setHardwareData({
        speed: 0, punch: 0, power: 0,
        l_ax: 0, l_ay: 0, l_az: 0, l_gx: 0, l_gy: 0, l_gz: 0,
        l_mag: 0, l_speed: 0, l_punch: 0, l_punch_cnt: 0,
        l_force_n: 0, l_peak_g: 0, l_punch_type: '',
        l_best_spd: 0, l_best_frc: 0,
        r_ax: 0, r_ay: 0, r_az: 0, r_gx: 0, r_gy: 0, r_gz: 0,
        r_mag: 0, r_speed: 0, r_punch: 0, r_punch_cnt: 0,
        r_force_n: 0, r_peak_g: 0, r_punch_type: '',
        r_best_spd: 0, r_best_frc: 0,
        ts: 0,
      });
    };
  }, [connectedDeviceId, setHardwareData]);

  const handleSendResetCommand = async () => {
    if (!connectedDeviceId) {
      console.warn('Cannot send reset command: No device connected');
      return;
    }
    const base64Value = btoa("r");
    const success = await bluetoothService.writeCharacteristic(
      connectedDeviceId,
      ESP_SERVICE_UUID,
      ESP_CHARACTERISTIC_UUID,
      base64Value
    );
    console.log('Reset command sent:', success);
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

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
    setImeiVerified(
      imeiInput.toLowerCase() === 'demo' || imeiInput.length === 15
    );
  };

  const handleStartRound = () => {
    sensorBuffer.current = [];   // discard pre-round data
    setIsRecording(true);
    setSummary(null);
    console.log('▶ Round started. Session:', currentSessionId.current);
  };

  const handleEndRound = async () => {
    if (!currentSessionId.current) return;

    // Stop flush interval
    if (flushIntervalRef.current) {
      clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = null;
    }

    // Final flush
    if (sensorBuffer.current.length > 0) {
      try {
        saveBatch([...sensorBuffer.current], currentSessionId.current)
      } catch (e) { console.error('Final batch failed:', e); }
      sensorBuffer.current = [];
    }

    // Close session + get summary
    const sessionSummary = endSession(currentSessionId.current);
    setSummary(sessionSummary);

    // Export CSV and share
    try {
      await shareSession(currentSessionId.current);
    } catch (e) {
      console.error('Export failed:', e);
      Alert.alert('Export failed', String(e));
    }

    //   // Pre-create next session so buffer never has a null sessionId
    currentSessionId.current = startSession();

    // Restart flush interval for next round
    flushIntervalRef.current = setInterval(async () => {
      if (!currentSessionId.current) return;
      if (sensorBuffer.current.length === 0) return;
      const batch = [...sensorBuffer.current];
      sensorBuffer.current = [];
      try {
        await saveBatch(batch, currentSessionId.current);
      } catch (e) {
        console.error('Batch save failed:', e);
      }
    }, 5000);

    setIsRecording(false);
  };

  // ── Filtered device list ──────────────────────────────────────────────────
  const targetDevices = scannedDevices.filter(d => d.name === TARGET_DEVICE_NAME);

  // ── UI ────────────────────────────────────────────────────────────────────
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
        </View>

        {/* Connection card / scan */}
        {isConnected ? (
          <View style={[styles.connectedCard, { backgroundColor: theme.surface, borderColor: theme.success + '40' }]}>
            <View style={styles.connectedHeader}>
              <View style={[styles.statusDot, { backgroundColor: theme.success }]} />
              <ThemedText style={[styles.connectedLabel, { color: theme.success }]}>Connected</ThemedText>
            </View>
            <ThemedText style={styles.deviceNameLarge}>{deviceName || 'Boxing Glove'}</ThemedText>

            {/* IMEI */}
            {/* <View style={styles.imeiSection}>
              <ThemedText style={[styles.imeiLabel, { color: theme.secondary }]}>
                Hardware Verification (IMEI)
              </ThemedText>
              <View style={styles.imeiRow}>
                <TextInput
                  style={[styles.imeiInput, {
                    color: theme.text,
                    borderColor: theme.border,
                    backgroundColor: theme.surfaceContainer,
                  }]}
                  placeholder="IMEI or 'demo'"
                  placeholderTextColor={theme.secondary}
                  value={imeiInput}
                  onChangeText={setImeiInput}
                />
                <TouchableOpacity style={styles.verifyButton} onPress={handleVerifyIMEI}>
                  <ThemedText style={styles.verifyButtonText}>Verify</ThemedText>
                </TouchableOpacity>
              </View>
              {imeiVerified === true && <View style={styles.verifiedBadge}><ThemedText style={styles.verifiedText}>✅ Hardware Verified</ThemedText></View>}
              {imeiVerified === false && <View style={styles.failedBadge}><ThemedText style={styles.failedText}>❌ Not Verified</ThemedText></View>}
            </View> */}
 
            <TouchableOpacity style={[styles.disconnectButton, { borderColor: theme.danger }]} onPress={() => disconnect()}>
              <ThemedText style={[styles.disconnectText, { color: theme.danger }]}>Disconnect Gloves</ThemedText>
            </TouchableOpacity>
            {/* <TouchableOpacity
              style={{
                width: 250,
                height: 40,
                backgroundColor: "#dc143c", // Crimson Red
                borderRadius: 20, // pill shape
                justifyContent: "center",
                alignItems: "center",
                alignSelf: "center",
                marginTop: 10,
                borderWidth: 1,
                borderColor: theme.danger,
              }}
              onPress={handleSendResetCommand}
              disabled={!connectedDeviceId}
            >
              <ThemedText style={{ color: theme.text }}>Reset Gloves</ThemedText>
            </TouchableOpacity> */}
          </View>
        ) : (
          <>
            <TouchableOpacity style={[styles.scanButton, isScanning && styles.scanButtonActive]} onPress={handleScan} disabled={isScanning}>
              <IconSymbol name="search" size={18} color="white" />
              <ThemedText style={styles.scanButtonText}>{isScanning ? 'Scanning...' : 'Scan for Gloves'}</ThemedText>
            </TouchableOpacity>

            {targetDevices.length > 0 && (
              <View style={styles.devicesSection}>
                <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Nearby Devices</ThemedText>
                {targetDevices.map(device => (
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

            {targetDevices.length === 0 && !isScanning && (
              <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <ThemedText style={{ fontSize: 40, marginBottom: 12 }}>👆</ThemedText>
                <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>Tap 'Scan for Gloves'</ThemedText>
                <ThemedText style={[styles.emptySubtitle, { color: theme.secondary }]}>
                  Make sure your gloves are powered on and in pairing mode
                </ThemedText>
              </View>
            )}
          </>
        )}

        {/* Live data card — values straight from ESP32, no calculations */}
        {/* <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Live Glove Data</ThemedText>

          <View style={styles.dataRow}>
            <ThemedText style={[styles.dataLabel, { color: theme.secondary }]}>LEFT</ThemedText>
            <ThemedText style={[styles.dataLabel, { color: theme.secondary }]}>RIGHT</ThemedText>
          </View>

          <View style={styles.dataRow}>
            <ThemedText style={[styles.dataValue, { color: theme.text }]}>
              Speed: {liveData.l_speed.toFixed(2)} m/s
            </ThemedText>
            <ThemedText style={[styles.dataValue, { color: theme.text }]}>
              Speed: {liveData.r_speed.toFixed(2)} m/s
            </ThemedText>
          </View>

          <View style={styles.dataRow}>
            <ThemedText style={[styles.dataValue, { color: theme.text }]}>
              Force: {liveData.l_force_n.toFixed(1)} N
            </ThemedText>
            <ThemedText style={[styles.dataValue, { color: theme.text }]}>
              Force: {liveData.r_force_n.toFixed(1)} N
            </ThemedText>
          </View>

          <View style={styles.dataRow}>
            <ThemedText style={[styles.dataValue, { color: theme.text }]}>
              Punches: {liveData.l_punch_cnt}
            </ThemedText>
            <ThemedText style={[styles.dataValue, { color: theme.text }]}>
              Punches: {liveData.r_punch_cnt}
            </ThemedText>
          </View>

          <View style={styles.dataRow}>
            <ThemedText style={[styles.dataValue, { color: theme.text }]}>
              Best: {liveData.l_best_spd.toFixed(2)} m/s
            </ThemedText>
            <ThemedText style={[styles.dataValue, { color: theme.text }]}>
              Best: {liveData.r_best_spd.toFixed(2)} m/s
            </ThemedText>
          </View>

          <View style={styles.dataRow}>
            <ThemedText style={[styles.dataValue, { color: theme.text }]}>
              Best force: {liveData.l_best_frc.toFixed(1)} N
            </ThemedText>
            <ThemedText style={[styles.dataValue, { color: theme.text }]}>
              Best force: {liveData.r_best_frc.toFixed(1)} N
            </ThemedText>
          </View>

          {liveData.l_punch_type !== '' && (
            <ThemedText style={[styles.punchType, { color: THEME_COLOR }]}>
              L: {liveData.l_punch_type}
            </ThemedText>
          )}
          {liveData.r_punch_type !== '' && (
            <ThemedText style={[styles.punchType, { color: THEME_COLOR }]}>
              R: {liveData.r_punch_type}
            </ThemedText>
          )}
        </View>   */}

        {/* Start / End Round */}
        {/* <TouchableOpacity
          style={[styles.button, isRecording ? styles.buttonStop : styles.buttonStart]}
          onPress={isRecording ? handleEndRound : handleStartRound}
        >
          <ThemedText style={styles.buttonText}>
            {isRecording ? '⏹ End Round' : '▶ Start Round'}
          </ThemedText>
        </TouchableOpacity> */}

        {/* Post-round summary */}
        {/* {summary && (
          <View style={[styles.summary, { backgroundColor: theme.surface }]}>
            <ThemedText style={[styles.summaryTitle, { color: theme.text }]}>Round complete ✅</ThemedText>
            <ThemedText style={[styles.summaryLine, { color: theme.secondary }]}>
              Duration: {(summary.durationMs / 1000).toFixed(1)}s
            </ThemedText>
            <ThemedText style={[styles.summaryLine, { color: theme.secondary }]}>
              Readings saved: {summary.totalReadings}
            </ThemedText>
            <ThemedText style={[styles.summaryLine, { color: theme.secondary }]}>
              Sample rate: {summary.samplesPerSecond} Hz
            </ThemedText>
          </View>
        )} */}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 30 },
  gloveEmoji: { fontSize: 60, marginBottom: 10 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { fontSize: 16, textAlign: 'center', marginTop: 5 },
  scanButton: { flexDirection: 'row', backgroundColor: THEME_COLOR, paddingVertical: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 20, gap: 10 },
  scanButtonActive: { opacity: 0.7 },
  scanButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  devicesSection: { gap: 15 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  deviceItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 12, borderWidth: 1 },
  deviceInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  deviceIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  deviceName: { fontSize: 16, fontWeight: '600' },
  deviceId: { fontSize: 12, marginTop: 2 },
  connectButton: { backgroundColor: THEME_COLOR, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  connectButtonActive: { backgroundColor: '#ccc' },
  connectButtonText: { color: 'white', fontWeight: '600', fontSize: 14 },
  emptyState: { padding: 40, borderRadius: 12, alignItems: 'center', borderWidth: 1, marginTop: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginTop: 5 },
  connectedCard: { padding: 20, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  connectedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  connectedLabel: { fontSize: 14, fontWeight: '600' },
  deviceNameLarge: { fontSize: 24, fontWeight: 'bold', marginBottom: 30 },
  imeiSection: { width: '100%', marginBottom: 20 },
  imeiRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  fetchLink: { fontSize: 12, fontWeight: '600' },
  imeiLabel: { fontSize: 14, marginBottom: 8 },
  imeiRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  imeiInput: { flex: 1, height: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 14 },
  verifyButton: { backgroundColor: THEME_COLOR, paddingHorizontal: 20, borderRadius: 8, justifyContent: 'center' },
  verifyButtonText: { color: 'white', fontWeight: '600' },
  verifiedBadge: { backgroundColor: '#e8f5e9', padding: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#c8e6c9' },
  verifiedText: { color: '#2e7d32', fontWeight: '600' },
  failedBadge: { backgroundColor: '#ffebee', padding: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#ffcdd2' },
  failedText: { color: '#c62828', fontWeight: '600' },
  disconnectButton: { borderWidth: 1, paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8, marginTop: 10 },
  disconnectText: { fontWeight: '600' },
  card: { borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 1, marginTop: 16 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  dataLabel: { fontSize: 12, fontWeight: '600', flex: 1 },
  dataValue: { fontSize: 13, flex: 1 },
  punchType: { fontSize: 14, fontWeight: '600', marginTop: 8 },
  button: { borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 8 },
  buttonStart: { backgroundColor: '#22c55e' },
  buttonStop: { backgroundColor: '#ef4444' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  summary: { borderRadius: 12, padding: 20, marginTop: 24, borderWidth: 1 },
  summaryTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  summaryLine: { fontSize: 14, marginBottom: 6 },
});
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, View, TouchableOpacity, Modal,
  ScrollView, Alert, TextInput
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
import { useAppDispatch } from '@/store/hooks';
import { dismissFatigueAlert } from '@/store/slices/practiceSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHardware } from '../../context/sethardware';
import RNFS from 'react-native-fs';

// ─── Types ────────────────────────────────────────────────────────────────────

type GloveStats = {
  speed: number;
  force: number;
  punchCnt: number;
  bestSpd: number;
  bestFrc: number;
  punchType: string;
};

type RoundRecord = {
  roundNumber: number;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  restSec: number;
  left: GloveStats;
  right: GloveStats;
  totalPunches: number;
  peakSpeedMs: number;
  peakForceN: number;
  avgSpeedMs: number;
  avgForceN: number;
  readings: number;
};

type SessionRecord = {
  id: string;
  date: string;
  day: string;
  startedAt: string;
  endedAt: string;
  dataSource: 'bluetooth' | 'mock';
  totalRounds: number;
  rounds: RoundRecord[];
  totalPunches: number;
  peakSpeedMs: number;
  peakForceN: number;
  avgSpeedMs: number;
  avgForceN: number;
};

type RoundAcc = {
  startedAt: Date;
  totalSpeed: number;
  totalForce: number;
  readings: number;
  peakSpeed: number;
  peakForce: number;
  leftSnap: GloveStats;
  rightSnap: GloveStats;
  totalPunches: number;
};

function emptyAcc(now: Date): RoundAcc {
  return {
    startedAt: now,
    totalSpeed: 0,
    totalForce: 0,
    readings: 0,
    peakSpeed: 0,
    peakForce: 0,
    totalPunches: 0,
    leftSnap: { speed: 0, force: 0, punchCnt: 0, bestSpd: 0, bestFrc: 0, punchType: '' },
    rightSnap: { speed: 0, force: 0, punchCnt: 0, bestSpd: 0, bestFrc: 0, punchType: '' },
  };
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'boxing_sessions_grouped_v2';

type DayGroup = { date: string; day: string; sessions: SessionRecord[] };

async function saveSessionToStorage(session: SessionRecord): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const groups: DayGroup[] = raw ? JSON.parse(raw) : [];
    const idx = groups.findIndex(g => g.date === session.date);
    if (idx >= 0) groups[idx].sessions.push(session);
    else groups.push({ date: session.date, day: session.day, sessions: [session] });
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
  } catch { return []; }
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

// ─── Raw data fields (used in loops for CSV) ─────────────────────────────────

const RAW_FIELDS = [
  'l_ax', 'l_ay', 'l_az', 'l_gx', 'l_gy', 'l_gz',
  'l_mag', 'l_speed', 'l_punch', 'l_punch_cnt',
  'l_force_n', 'l_peak_g', 'l_punch_type', 'l_best_spd', 'l_best_frc',
  'r_ax', 'r_ay', 'r_az', 'r_gx', 'r_gy', 'r_gz',
  'r_mag', 'r_speed', 'r_punch', 'r_punch_cnt',
  'r_force_n', 'r_peak_g', 'r_punch_type', 'r_best_spd', 'r_best_frc',
] as const;

const CSV_HEADER = ['ts', 'round', ...RAW_FIELDS, 'comment', 'rating'].join(',');

type RawReading = {
  ts: number;
  [key: string]: number | string;
};

type SavedCsvFile = {
  name: string;
  path: string;
  date: string;
};

// ═════════════════════════════════════════════════════════════════════════════
//  Component
// ═════════════════════════════════════════════════════════════════════════════

export default function PracticeScreen() {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? Colors.dark : Colors.light;
  const dispatch = useAppDispatch();
  const { hardwareData } = useHardware();
  const [useMockData, setUseMockData] = useState(false);

  // ── Config ────────────────────────────────────────────────────────────────
  const [rounds, setRounds] = useState(4);
  const [roundDuration, setRoundDuration] = useState(180);
  const [restDuration, setRestDuration] = useState(60);

  // ── View ──────────────────────────────────────────────────────────────────
  const [gloveView, setGloveView] = useState<'left' | 'both' | 'right'>('both');
  const [showHistory, setShowHistory] = useState(false);
  const [historyGroups, setHistoryGroups] = useState<DayGroup[]>([]);
  const [lastSession, setLastSession] = useState<SessionRecord | null>(null);

  // ── Session state ─────────────────────────────────────────────────────────
  const sessionStartRef = useRef<Date | null>(null);
  const roundsRecorded = useRef<RoundRecord[]>([]);
  const currentRoundAcc = useRef<RoundAcc>(emptyAcc(new Date()));
  const prevRoundRef = useRef<number>(0);
  const restStartRef = useRef<Date | null>(null);

  // ── Session flags ────────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);

  // ── CSV feedback & saved files (no database, direct in-memory) ────────────
  const roundReadingsRef = useRef<RawReading[]>([]);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [pendingRoundNum, setPendingRoundNum] = useState(0);
  const [pendingRoundReadings, setPendingRoundReadings] = useState<RawReading[]>([]);
  const [savedFiles, setSavedFiles] = useState<SavedCsvFile[]>([]);
  const [showFilesModal, setShowFilesModal] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // ═════════════════════════════════════════════════════════════════════════
  //  ⭐ KEY FIX: Refs for reading inside setInterval without stale closures
  //
  //  WHY: setInterval captures variables at creation time. If we read
  //  hardwareData, isResting, etc. directly, they'd be stale forever.
  //  Refs always point to the latest value.
  //
  //  latestHwRef is updated DURING RENDER (not in useEffect), so it
  //  captures the latest hardwareData on every re-render — even if
  //  hardwareData is the same object reference mutated in place by
  //  the BLE context.
  // ═════════════════════════════════════════════════════════════════════════
  const latestHwRef = useRef<any>(hardwareData);
  const isRestingRef = useRef(false);
  const isSessionActiveRef = useRef(false);
  const dataCollectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update refs on every render (BEFORE any effects run)
  latestHwRef.current = hardwareData;

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

  // Keep refs in sync with state
  isRestingRef.current = isResting;
  isSessionActiveRef.current = isSessionActive;
  // ═════════════════════════════════════════════════════════════════════════
  //  ⭐ KEY FIX: Data collection via setInterval, NOT useEffect
  //
  //  OLD (broken):
  //    useEffect(() => { buffer.push(data); }, [hardwareData]);
  //    → hardwareData reference doesn't change → effect fires once → buffer
  //      gets 1 item max → "0 readings" in DB
  //
  //  NEW (fixed):
  //  setInterval reads from latestHwRef.current, which is always
  //  up-to-date because it's assigned during render. The component
  //  re-renders at least once per second (from RoundTimer), so
  //  latestHwRef always has fresh data.
  //
  //  Two intervals:
  //    1. DATA COLLECTION (500ms) — reads latest HW, accumulates, buffers
  // ═════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isSessionActive) return;

    // ── Interval 1: Collect data every 500ms ──────────────────────────────
    dataCollectionIntervalRef.current = setInterval(() => {
      // Skip during rest
      if (isRestingRef.current) return;

      const hw = latestHwRef.current;
      if (!hw) return;

      const speedVal = hw.l_speed ?? hw.speed ?? 0;
      const forceVal = hw.l_force_n ?? hw.power ?? 0;
      const lPunchCnt = hw.l_punch_cnt ?? 0;
      const rPunchCnt = hw.r_punch_cnt ?? 0;

      // ⭐ Removed the aggressive "skip if speed AND force are 0" filter.
      // It was filtering out valid packets where only punch data changed.
      // Now we only skip if ALL glove values are truly zero (glove offline).
      const hasAnyData =
        speedVal > 0 || forceVal > 0 ||
        lPunchCnt > 0 || rPunchCnt > 0 ||
        (hw.r_speed ?? 0) > 0 || (hw.r_force_n ?? 0) > 0 ||
        (hw.l_ax ?? 0) !== 0 || (hw.r_ax ?? 0) !== 0;

      if (!hasAnyData) return;

      // ── Accumulate round stats ────────────────────────────────────────
      const acc = currentRoundAcc.current;
      acc.totalSpeed += speedVal;
      acc.totalForce += forceVal;
      acc.readings += 1;
      acc.peakSpeed = Math.max(acc.peakSpeed, speedVal, hw.l_best_spd ?? 0, hw.r_best_spd ?? 0);
      acc.peakForce = Math.max(acc.peakForce, forceVal, hw.l_best_frc ?? 0, hw.r_best_frc ?? 0);
      acc.totalPunches = Math.max(lPunchCnt, rPunchCnt, acc.totalPunches);

      acc.leftSnap = {
        speed: hw.l_speed ?? 0,
        force: hw.l_force_n ?? 0,
        punchCnt: hw.l_punch_cnt ?? 0,
        bestSpd: hw.l_best_spd ?? 0,
        bestFrc: hw.l_best_frc ?? 0,
        punchType: hw.l_punch_type ?? '',
      };
      acc.rightSnap = {
        speed: hw.r_speed ?? 0,
        force: hw.r_force_n ?? 0,
        punchCnt: hw.r_punch_cnt ?? 0,
        bestSpd: hw.r_best_spd ?? 0,
        bestFrc: hw.r_best_frc ?? 0,
        punchType: hw.r_punch_type ?? '',
      };

      // ── Collect raw reading for CSV (directly, no database) ────────
      const reading: RawReading = { ts: Date.now() };
      for (const field of RAW_FIELDS) {
        reading[field] = hw[field] ?? (field.includes('type') ? '' : 0);
      }
      roundReadingsRef.current.push(reading);

    }, 50); // Sample every 500ms = 2 rows/sec

    // ── Cleanup when session ends ────────────────────────────────────────
    return () => {
      if (dataCollectionIntervalRef.current) {
        clearInterval(dataCollectionIntervalRef.current);
        dataCollectionIntervalRef.current = null;
      }
    };
  }, [isSessionActive]);


  // ── Seal a round into roundsRecorded ─────────────────────────────────────
  const sealCurrentRound = useCallback((roundNumber: number, _completed: boolean) => {
    const acc = currentRoundAcc.current;
    const now = new Date();
    const durSec = Math.round((now.getTime() - acc.startedAt.getTime()) / 1000);
    const restSec = restStartRef.current
      ? Math.round((now.getTime() - restStartRef.current.getTime()) / 1000)
      : restDuration;

    const record: RoundRecord = {
      roundNumber,
      startedAt: acc.startedAt.toISOString(),
      endedAt: now.toISOString(),
      durationSec: Math.min(durSec, roundDuration),
      restSec,
      left: acc.leftSnap,
      right: acc.rightSnap,
      totalPunches: acc.totalPunches,
      peakSpeedMs: parseFloat(acc.peakSpeed.toFixed(2)),
      peakForceN: parseFloat(acc.peakForce.toFixed(2)),
      avgSpeedMs: acc.readings > 0 ? parseFloat((acc.totalSpeed / acc.readings).toFixed(2)) : 0,
      avgForceN: acc.readings > 0 ? parseFloat((acc.totalForce / acc.readings).toFixed(2)) : 0,
      readings: acc.readings,
    };

    roundsRecorded.current.push(record);
    console.log(`📦 Round ${roundNumber} sealed — punches: ${record.totalPunches}, readings: ${record.readings}`);
  }, [roundDuration, restDuration]);




  // ── Detect round transitions ──────────────────────────────────────────────
  // ── Detect round transitions ──────────────────────────────────────────────
  useEffect(() => {
    if (!isSessionActive) return;

    const prev = prevRoundRef.current;

    // Round changed (e.g. 1 → 2)
    if (currentRound !== prev && !isResting && prev !== 0) {
      console.log(`🔄 Round transition: ${prev} → ${currentRound}`);
      sealCurrentRound(prev, true);
      currentRoundAcc.current = emptyAcc(new Date());
      prevRoundRef.current = currentRound;
    }

    // ⭐ Rest started → round just ended
    if (isResting && restStartRef.current === null) {
      restStartRef.current = new Date();
      console.log(`😴 Rest started after Round ${prev} — showing feedback`);

      // Seal the round that just ended
      if (prev !== 0) {
        sealCurrentRound(prev, true);
      }

      // ── Show feedback modal for CSV (no database) ──────────────────
      if (roundReadingsRef.current.length > 0 && prev !== 0) {
        setPendingRoundNum(prev);
        setPendingRoundReadings([...roundReadingsRef.current]);
        roundReadingsRef.current = [];
        setShowFeedbackModal(true);
      }
    }

    // Rest ended → new round begins
    if (!isResting && restStartRef.current !== null) {
      console.log(`⚡ Rest ended — Round ${currentRound} collecting`);
      restStartRef.current = null;
      currentRoundAcc.current = emptyAcc(new Date());
      prevRoundRef.current = currentRound;
    }
  }, [currentRound, isResting, isSessionActive, sealCurrentRound]);

  // ── Start session ─────────────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    sessionStartRef.current = new Date();
    roundsRecorded.current = [];
    prevRoundRef.current = 1;
    restStartRef.current = null;
    currentRoundAcc.current = emptyAcc(new Date());
    roundReadingsRef.current = [];  // clear CSV readings for new session
    setIsRecording(true);

    startSession({ totalRounds: rounds, roundDuration, restDuration });
  }, [rounds, roundDuration, restDuration, startSession]);

  // ═════════════════════════════════════════════════════════════════════════
  //  ⭐ FIX: Clean handleEnd — no phantom session, proper final flush
  // ═════════════════════════════════════════════════════════════════════════
  const handleEnd = useCallback(async () => {
    if (!isSessionActive) return;

    // 1. Seal current round (if a round is in progress and not already sealed)
    const prev = prevRoundRef.current;
    if (prev !== 0 && !isResting) {
      sealCurrentRound(prev, false);
    }

    // ── Capture last round's readings for CSV feedback ────────────────
    if (roundReadingsRef.current.length > 0 && prev !== 0) {
      setPendingRoundNum(prev);
      setPendingRoundReadings([...roundReadingsRef.current]);
      roundReadingsRef.current = [];
      setShowFeedbackModal(true);
    }

    // 2. Stop interval
    if (dataCollectionIntervalRef.current) {
      clearInterval(dataCollectionIntervalRef.current);
      dataCollectionIntervalRef.current = null;
    }

    setIsRecording(false);

    // 4. Aggregate round stats
    const allRounds = roundsRecorded.current;
    const now = new Date();
    let totPunches = 0, peakSpd = 0, peakFrc = 0, sumSpd = 0, sumFrc = 0, sumReadings = 0;
    for (const r of allRounds) {
      totPunches = Math.max(totPunches, r.totalPunches);
      peakSpd = Math.max(peakSpd, r.peakSpeedMs);
      peakFrc = Math.max(peakFrc, r.peakForceN);
      sumSpd += r.avgSpeedMs * r.readings;
      sumFrc += r.avgForceN * r.readings;
      sumReadings += r.readings;
    }

    const sessionRecord: SessionRecord = {
      id: now.getTime().toString(),
      date: now.toISOString().split('T')[0],
      day: now.toLocaleDateString('en-US', { weekday: 'long' }),
      startedAt: sessionStartRef.current?.toISOString() ?? now.toISOString(),
      endedAt: now.toISOString(),
      dataSource: useMockData ? 'mock' : 'bluetooth',
      totalRounds: allRounds.length,
      rounds: allRounds,
      totalPunches: totPunches,
      peakSpeedMs: parseFloat(peakSpd.toFixed(2)),
      peakForceN: parseFloat(peakFrc.toFixed(2)),
      avgSpeedMs: sumReadings > 0 ? parseFloat((sumSpd / sumReadings).toFixed(2)) : 0,
      avgForceN: sumReadings > 0 ? parseFloat((sumFrc / sumReadings).toFixed(2)) : 0,
    };

    await saveSessionToStorage(sessionRecord);
    setLastSession(sessionRecord);

    const updated = await loadSessions();
    setHistoryGroups(updated);

    endSession();
  }, [isSessionActive, currentRound, isResting, useMockData, sealCurrentRound, endSession]);

  // ── Load saved CSV files from device ──────────────────────────────────────
  const loadSavedFiles = useCallback(async () => {
    try {
      const items = await RNFS.readDir(RNFS.DocumentDirectoryPath);
      const csvFiles: SavedCsvFile[] = [];
      for (const f of items) {
        if (f.isFile() && f.name.startsWith('practice_round_') && f.name.endsWith('.csv')) {
          csvFiles.push({
            name: f.name,
            path: f.path,
            date: f.mtime ? new Date(f.mtime).toISOString() : new Date().toISOString(),
          });
        }
      }
      csvFiles.reverse(); // newest first
      setSavedFiles(csvFiles);
    } catch (e) {
      console.error('Failed to load saved files:', e);
    }
  }, []);

  useEffect(() => { loadSavedFiles(); }, [loadSavedFiles]);

  // ── Save CSV for a round (directly, no database) ─────────────────────────
  const saveCsvForRound = useCallback(async (
    roundNum: number,
    readings: RawReading[],
    comment: string,
    rating: number,
  ) => {
    // Build CSV rows using loop over RAW_FIELDS (array method)
    const csvRows: string[] = [CSV_HEADER];
    for (const r of readings) {
      const vals: (string | number)[] = [r.ts, roundNum];
      for (const field of RAW_FIELDS) {
        const v = r[field];
        vals.push(typeof v === 'string' ? `"${v}"` : (v ?? 0));
      }
      vals.push(`"${comment.replace(/"/g, '""')}"`, rating);
      csvRows.push(vals.join(','));
    }
    const csvContent = csvRows.join('\n');

    const fileName = `practice_round_${roundNum}_${Date.now()}.csv`;
    const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
    await RNFS.writeFile(filePath, csvContent, 'utf8');
    console.log(`✅ CSV saved: ${filePath} (${readings.length} readings)`);

    setSavedFiles(prev => [{
      name: fileName,
      path: filePath,
      date: new Date().toISOString(),
    }, ...prev]);
  }, []);

  // ── Handle feedback submission ────────────────────────────────────────────
  const handleFeedbackSubmit = useCallback(async () => {
    if (pendingRoundReadings.length === 0) {
      setShowFeedbackModal(false);
      return;
    }
    try {
      await saveCsvForRound(pendingRoundNum, pendingRoundReadings, feedbackComment, feedbackRating);
      Alert.alert('Saved ✅', `Round ${pendingRoundNum} CSV saved to device (${pendingRoundReadings.length} readings).`);
    } catch (e) {
      console.error('CSV save failed:', e);
      Alert.alert('Error', 'Failed to save CSV file.');
    }
    setShowFeedbackModal(false);
    setFeedbackComment('');
    setFeedbackRating(5);
    setPendingRoundReadings([]);
  }, [pendingRoundNum, pendingRoundReadings, feedbackComment, feedbackRating, saveCsvForRound]);

  // ── Delete a saved CSV file ───────────────────────────────────────────────
  const handleDeleteFile = useCallback(async (filePath: string) => {
    try {
      await RNFS.unlink(filePath);
      setSavedFiles(prev => prev.filter(f => f.path !== filePath));
    } catch (e) {
      console.error('Failed to delete file:', e);
    }
  }, []);

  // ── Preview a saved CSV file ──────────────────────────────────────────────
  const handlePreviewFile = useCallback(async (file: SavedCsvFile) => {
    try {
      const content = await RNFS.readFile(file.path, 'utf8');
      // Truncate if too large to avoid lag
      const lines = content.split('\n');
      const previewText = lines.slice(0, 50).join('\n') + (lines.length > 50 ? '\n\n... (file truncated for preview, ' + lines.length + ' total lines)' : '');
      setPreviewContent(previewText);
      setShowPreviewModal(true);
    } catch (e) {
      console.error('Failed to preview file:', e);
      Alert.alert('Error', 'Could not read the file contents.');
    }
  }, []);
  // ── Live display values ───────────────────────────────────────────────────
  const hw = hardwareData as any;
  const dispLeft: GloveStats = {
    speed: hw.l_speed ?? 0,
    force: hw.l_force_n ?? 0,
    punchCnt: hw.l_punch_cnt ?? 0,
    bestSpd: hw.l_best_spd ?? 0,
    bestFrc: hw.l_best_frc ?? 0,
    punchType: hw.l_punch_type ?? '',
  };
  const dispRight: GloveStats = {
    speed: hw.r_speed ?? 0,
    force: hw.r_force_n ?? 0,
    punchCnt: hw.r_punch_cnt ?? 0,
    bestSpd: hw.r_best_spd ?? 0,
    bestFrc: hw.r_best_frc ?? 0,
    punchType: hw.r_punch_type ?? '',
  };

  const gaugeSpeed = gloveView === 'left' ? dispLeft.speed
    : gloveView === 'right' ? dispRight.speed
      : Math.max(dispLeft.speed, dispRight.speed);

  const gaugePunches = gloveView === 'left' ? dispLeft.punchCnt
    : gloveView === 'right' ? dispRight.punchCnt
      : dispLeft.punchCnt + dispRight.punchCnt;

  const gaugeForce = gloveView === 'left' ? dispLeft.force
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
      <View style={styles.roundCardHeader}>
        <ThemedText style={[styles.roundCardTitle, { color: THEME_COLOR }]}>Round {r.roundNumber}</ThemedText>
        <ThemedText style={[styles.roundCardTime, { color: theme.secondary }]}>
          {fmtTime(r.startedAt)} → {fmtTime(r.endedAt)}
        </ThemedText>
        <View style={styles.roundDurationBadge}>
          <ThemedText style={styles.roundDurationText}>⏱ {fmt(r.durationSec)}  💤 {fmt(r.restSec)}</ThemedText>
        </View>
      </View>
      <View style={styles.roundGrid}>
        {[
          { label: 'Punches', value: r.totalPunches, color: THEME_COLOR },
          { label: 'Peak spd', value: `${r.peakSpeedMs} m/s`, color: '#FF9500' },
          { label: 'Peak frc', value: `${r.peakForceN} N`, color: '#5856D6' },
          { label: 'Avg spd', value: `${r.avgSpeedMs} m/s`, color: '#FF9500' },
          { label: 'Avg frc', value: `${r.avgForceN} N`, color: '#5856D6' },
          { label: 'Readings', value: r.readings, color: theme.text },
        ].map(item => (
          <View key={item.label} style={[styles.roundGridCell, { backgroundColor: theme.surfaceContainer }]}>
            <ThemedText style={[styles.roundGridVal, { color: item.color as string }]}>{item.value}</ThemedText>
            <ThemedText style={[styles.roundGridKey, { color: theme.secondary }]}>{item.label}</ThemedText>
          </View>
        ))}
      </View>
      <View style={styles.gloveBreakdown}>
        {[
          { label: '🟢 LEFT', g: r.left },
          { label: '🔵 RIGHT', g: r.right },
        ].map(({ label, g }) => (
          <View key={label} style={[styles.gloveBreakdownCol, { backgroundColor: theme.surfaceContainer }]}>
            <ThemedText style={[styles.gloveBreakdownTitle, { color: theme.text }]}>{label}</ThemedText>
            <ThemedText style={[styles.gloveBreakdownStat, { color: theme.secondary }]}>
              Punches: <ThemedText style={{ color: theme.text }}>{g.punchCnt}</ThemedText>
            </ThemedText>
            <ThemedText style={[styles.gloveBreakdownStat, { color: theme.secondary }]}>
              Speed: <ThemedText style={{ color: '#FF9500' }}>{g.speed.toFixed(2)} m/s</ThemedText>
            </ThemedText>
            <ThemedText style={[styles.gloveBreakdownStat, { color: theme.secondary }]}>
              Force: <ThemedText style={{ color: '#5856D6' }}>{g.force.toFixed(1)} N</ThemedText>
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
      <View style={styles.sessionCardHeader}>
        <View>
          <ThemedText style={[styles.sessionCardDate, { color: theme.text }]}>{session.day}, {session.date}</ThemedText>
          <ThemedText style={[styles.sessionCardTime, { color: theme.secondary }]}>
            {fmtDateTime(session.startedAt)} → {fmtTime(session.endedAt)}
          </ThemedText>
        </View>
        <View style={[styles.sourceBadge, { backgroundColor: session.dataSource === 'bluetooth' ? '#1a3a2a' : '#2a2a1a' }]}>
          <ThemedText style={[styles.sourceBadgeText, { color: session.dataSource === 'bluetooth' ? '#4ade80' : '#facc15' }]}>
            {session.dataSource === 'bluetooth' ? '📡 BT' : '🔄 Mock'}
          </ThemedText>
        </View>
      </View>
      <View style={styles.roundGrid}>
        {[
          { label: 'Rounds', value: session.totalRounds, color: THEME_COLOR },
          { label: 'Punches', value: session.totalPunches, color: THEME_COLOR },
          { label: 'Peak spd', value: `${session.peakSpeedMs} m/s`, color: '#FF9500' },
          { label: 'Peak frc', value: `${session.peakForceN} N`, color: '#5856D6' },
          { label: 'Avg spd', value: `${session.avgSpeedMs} m/s`, color: '#FF9500' },
          { label: 'Avg frc', value: `${session.avgForceN} N`, color: '#5856D6' },
        ].map(item => (
          <View key={item.label} style={[styles.roundGridCell, { backgroundColor: theme.surfaceContainer }]}>
            <ThemedText style={[styles.roundGridVal, { color: item.color as string }]}>{item.value}</ThemedText>
            <ThemedText style={[styles.roundGridKey, { color: theme.secondary }]}>{item.label}</ThemedText>
          </View>
        ))}
      </View>
      {session.rounds.map(r => renderRoundCard(r))}
    </View>
  );
  // ═════════════════════════════════════════════════════════════════════════
  //  JSX
  // ═════════════════════════════════════════════════════════════════════════

  return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>

        {/* FEEDBACK MODAL */}
        <Modal visible={showFeedbackModal} animationType="slide" transparent>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 24 }}>
              <ThemedText style={{ fontSize: 20, fontWeight: '800', marginBottom: 16, color: theme.text }}>
                Round {pendingRoundNum} Feedback
              </ThemedText>

              <ThemedText style={{ marginBottom: 8, color: theme.secondary }}>Rating (1-10)</ThemedText>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                {[1, 3, 5, 7, 10].map(val => (
                  <TouchableOpacity
                    key={val}
                    style={{
                      paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8,
                      backgroundColor: feedbackRating === val ? THEME_COLOR : theme.surfaceContainer
                    }}
                    onPress={() => setFeedbackRating(val)}
                  >
                    <ThemedText style={{ color: feedbackRating === val ? '#fff' : theme.text }}>{val}</ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              <ThemedText style={{ marginBottom: 8, color: theme.secondary }}>Comment</ThemedText>
              <TextInput
                style={{
                  backgroundColor: theme.surfaceContainer, color: theme.text,
                  borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top', marginBottom: 24
                }}
                multiline
                placeholder="How did this round feel?"
                placeholderTextColor={theme.secondary}
                value={feedbackComment}
                onChangeText={setFeedbackComment}
              />

              <TouchableOpacity
                style={{ backgroundColor: THEME_COLOR, padding: 16, borderRadius: 12, alignItems: 'center' }}
                onPress={handleFeedbackSubmit}
              >
                <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>Save CSV & Continue</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ marginTop: 12, padding: 12, alignItems: 'center' }}
                onPress={() => {
                  setShowFeedbackModal(false);
                  setPendingRoundReadings([]);
                }}
              >
                <ThemedText style={{ color: theme.danger }}>Skip (Don't Save)</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* CSV FILES MODAL */}
        <Modal visible={showFilesModal} animationType="slide">
          <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <ThemedText style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>Saved CSV Files</ThemedText>
              <TouchableOpacity onPress={() => setShowFilesModal(false)}>
                <ThemedText style={{ color: THEME_COLOR, fontSize: 16, fontWeight: 'bold' }}>Close</ThemedText>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              {savedFiles.length === 0 ? (
                <ThemedText style={{ color: theme.secondary, textAlign: 'center', marginTop: 40 }}>No CSV files saved yet.</ThemedText>
              ) : (
                savedFiles.map(file => (
                  <View key={file.path} style={{ backgroundColor: theme.surface, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: theme.border }}>
                    <ThemedText style={{ fontWeight: 'bold', color: theme.text, marginBottom: 4 }}>{file.name}</ThemedText>
                    <ThemedText style={{ fontSize: 12, color: theme.secondary, marginBottom: 12 }}>{new Date(file.date).toLocaleString()}</ThemedText>

                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                      <TouchableOpacity onPress={() => handlePreviewFile(file)} style={{ paddingVertical: 6, paddingHorizontal: 12, backgroundColor: theme.surfaceContainer, borderRadius: 6 }}>
                        <ThemedText style={{ color: THEME_COLOR, fontSize: 13, fontWeight: '600' }}>Preview</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteFile(file.path)} style={{ paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#ffe4e6', borderRadius: 6 }}>
                        <ThemedText style={{ color: '#e11d48', fontSize: 13, fontWeight: '600' }}>Delete</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* PREVIEW MODAL */}
        <Modal visible={showPreviewModal} animationType="fade" transparent>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 20, flex: 0.8 }}>
              <ThemedText style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 12 }}>CSV Preview (First 50 lines)</ThemedText>
              <ScrollView style={{ backgroundColor: theme.surfaceContainer, borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <ThemedText style={{ fontSize: 10, fontFamily: 'monospace', color: theme.text }}>
                  {previewContent}
                </ThemedText>
              </ScrollView>
              <TouchableOpacity onPress={() => setShowPreviewModal(false)} style={{ backgroundColor: THEME_COLOR, padding: 14, borderRadius: 12, alignItems: 'center' }}>
                <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>Close Preview</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* HISTORY MODAL */}
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
                <ThemedText style={[styles.emptyText, { color: theme.secondary }]}>No sessions recorded yet.</ThemedText>
              ) : (
                [...historyGroups].reverse().map(group => (
                  <View key={group.date} style={{ marginBottom: 24 }}>
                    <View style={[styles.dateHeader, { borderBottomColor: theme.border }]}>
                      <ThemedText style={[styles.dateHeaderText, { color: THEME_COLOR }]}>{group.day} · {group.date}</ThemedText>
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

        {/* FATIGUE ALERT */}
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
          <ScrollView contentContainerStyle={styles.preSession}>
            <ThemedText style={{ fontSize: 56, marginBottom: 8 }}>🥊</ThemedText>
            <ThemedText style={[styles.preTitle, { color: theme.text }]}>Ready to Train?</ThemedText>

            <View style={[styles.livePreview, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <ThemedText style={[styles.livePreviewTitle, { color: theme.secondary }]}>Live Hardware Preview</ThemedText>
              <View style={styles.livePreviewRow}>
                {renderGloveCard('LEFT  🟢', dispLeft, '#4ade80')}
                {renderGloveCard('RIGHT 🔵', dispRight, '#60a5fa')}
              </View>
            </View>

            <View style={[styles.configCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {[
                { label: 'Rounds', val: rounds, set: setRounds, min: 1, max: 20, step: 1, display: String(rounds) },
                { label: 'Round Duration', val: roundDuration, set: setRoundDuration, min: 30, max: 600, step: 30, display: fmt(roundDuration) },
                { label: 'Rest Period', val: restDuration, set: setRestDuration, min: 10, max: 300, step: 10, display: fmt(restDuration) },
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

            <TouchableOpacity
              style={[styles.mockToggle, { borderColor: theme.border }]}
              onPress={() => setUseMockData(v => !v)}
            >
              <ThemedText style={[styles.mockToggleText, { color: theme.secondary }]}>
                {useMockData ? '🔄 Mock Data: ON' : '📡 Real Bluetooth Data'}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mockToggle, { borderColor: theme.border, marginTop: 10 }]}
              onPress={() => setShowFilesModal(true)}
            >
              <ThemedText style={[styles.mockToggleText, { color: THEME_COLOR }]}>
                📄 View Saved CSV Files ({savedFiles.length})
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
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
              onPress={isRecording ? handleEnd : handleStart}
            >
              <ThemedText >
                {isRecording ? '⏹ End Round' : '▶ Start Round'}
              </ThemedText>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <View style={styles.hud}>
            <RoundTimer currentRound={currentRound} totalRounds={totalRounds} formattedTime={formattedTime} isResting={isResting} />
            <View style={[styles.tabContainer, { backgroundColor: theme.surfaceContainer }]}>
              {(['left', 'both', 'right'] as const).map(mode => (
                <TouchableOpacity key={mode} style={[styles.tabButton, gloveView === mode && { backgroundColor: THEME_COLOR }]} onPress={() => setGloveView(mode)}>
                  <ThemedText style={[styles.tabText, { color: gloveView === mode ? '#fff' : theme.secondary }]}>
                    {mode === 'left' ? '🟢 L' : mode === 'right' ? '🔵 R' : '⚡ BOTH'}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.gaugesRow}>
              <CircularGauge value={gaugeSpeed} maxValue={30} label="Speed" unit="m/s" color="#FF9500" />
              <CircularGauge value={gaugePunches} maxValue={500} label="Punches" unit="total" color={THEME_COLOR} size={130} />
              <CircularGauge value={gaugeForce} maxValue={120} label="Force" unit="N" color="#5856D6" />
            </View>
            {(gloveView === 'both' || gloveView === 'left') && renderGloveCard('LEFT GLOVE  🟢', dispLeft, '#4ade80')}
            {(gloveView === 'both' || gloveView === 'right') && renderGloveCard('RIGHT GLOVE 🔵', dispRight, '#60a5fa')}
            <View style={styles.avgRow}>
              <ThemedText style={[styles.avgLabel, { color: theme.secondary }]}>AVG SPEED</ThemedText>
              <ThemedText style={[styles.avgValue, { color: '#FF9500' }]}>{averageSpeed.toFixed(2)} m/s</ThemedText>
            </View>
            {/* <FatigueBar fatigue={fatigueLevel} /> */}
            <View style={styles.hudFooter}>
              <TouchableOpacity style={[styles.endButton, { borderColor: theme.danger }]} onPress={isRecording ? handleEnd : handleStart}>
                <ThemedText style={[styles.endButtonText, { color: theme.danger }]}>⏹ END SESSION</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
  );

}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  preSession: { padding: 20, alignItems: 'center', paddingBottom: 40 },
  preTitle: { fontSize: 26, fontWeight: '800', marginBottom: 16, letterSpacing: -0.5 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  livePreview: { width: '100%', borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 16 },
  livePreviewTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  livePreviewRow: { flexDirection: 'row', gap: 8 },
  gloveCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 10, marginBottom: 8 },
  gloveCardTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  gloveRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  gloveStat: { alignItems: 'center', flex: 1 },
  gloveVal: { fontSize: 14, fontWeight: '700' },
  gloveKey: { fontSize: 9, fontWeight: '600' },
  configCard: { width: '100%', borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 16 },
  configRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepperRow: { paddingVertical: 8 },
  configLabel: { fontSize: 15, fontWeight: '500' },
  configValue: { fontSize: 15, fontWeight: '700', minWidth: 52, textAlign: 'center' },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperButton: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepperButtonText: { fontSize: 18, fontWeight: '500', lineHeight: 20 },
  configDivider: { height: 1 },
  mockToggle: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, marginBottom: 12 },
  mockToggleText: { fontSize: 12, fontWeight: '600' },
  startButton: { backgroundColor: THEME_COLOR, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 16, elevation: 6 },
  startButtonText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 2 },
  sessionCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 16 },
  sessionCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  sessionCardDate: { fontSize: 14, fontWeight: '700' },
  sessionCardTime: { fontSize: 11, marginTop: 2 },
  sourceBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  sourceBadgeText: { fontSize: 10, fontWeight: '700' },
  roundCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 10 },
  roundCardHeader: { marginBottom: 8 },
  roundCardTitle: { fontSize: 13, fontWeight: '800' },
  roundCardTime: { fontSize: 11, marginTop: 2 },
  roundDurationBadge: { marginTop: 4 },
  roundDurationText: { fontSize: 11, color: '#aaa' },
  roundGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  roundGridCell: { borderRadius: 8, padding: 8, alignItems: 'center', minWidth: '30%', flex: 1 },
  roundGridVal: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  roundGridKey: { fontSize: 9, fontWeight: '600' },
  gloveBreakdown: { flexDirection: 'row', gap: 8 },
  gloveBreakdownCol: { flex: 1, borderRadius: 10, padding: 10 },
  gloveBreakdownTitle: { fontSize: 11, fontWeight: '700', marginBottom: 6 },
  gloveBreakdownStat: { fontSize: 11, marginBottom: 3 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  dateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, paddingBottom: 6, marginBottom: 10 },
  dateHeaderText: { fontSize: 13, fontWeight: '700' },
  dateHeaderCount: { fontSize: 11 },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 15 },
  hud: { flex: 1, paddingTop: 4 },
  tabContainer: { flexDirection: 'row', marginHorizontal: 16, marginVertical: 8, borderRadius: 12, padding: 4 },
  tabButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  gaugesRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 10, marginVertical: 8 },
  avgRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 6 },
  avgLabel: { fontSize: 11, letterSpacing: 1.5, fontWeight: '600' },
  avgValue: { fontSize: 11, fontWeight: '800' },
  hudFooter: { paddingHorizontal: 20, paddingBottom: 20, marginTop: 'auto' },
  endButton: { paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, alignItems: 'center' },
  endButtonText: { fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  alertCard: { borderRadius: 24, padding: 28, alignItems: 'center', width: '100%' },
  alertTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  alertMessage: { fontSize: 15, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  alertButton: { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14 },
  alertButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
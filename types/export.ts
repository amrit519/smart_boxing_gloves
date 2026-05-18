// types/export.ts

import RNFS from 'react-native-fs';
import * as Sharing from 'expo-sharing';
import { db } from './db';

// ── Types ─────────────────────────────────────────────────────────────────────
type SensorRow = {
  id:         number;
  session_id: string;
  ts:         number;
  l_ax: number; l_ay: number; l_az: number;
  l_gx: number; l_gy: number; l_gz: number;
  r_ax: number; r_ay: number; r_az: number;
  r_gx: number; r_gy: number; r_gz: number;
};

type PunchRow = {
  id:           number;
  session_id:   string;
  ts:           number;
  punch_number: number;
  speed_ms:     number;
  force_n:      number;
  peak_g:       number;
  punch_type:   string;
  best_speed_ms: number;
  best_force_n:  number;
  session_s:    number;
};

// ── Build raw IMU CSV string ──────────────────────────────────────────────────
function buildRawCsv(rows: SensorRow[]): string {
  const header = [
    'ts',
    'l_ax','l_ay','l_az','l_gx','l_gy','l_gz',
    'r_ax','r_ay','r_az','r_gx','r_gy','r_gz',
    'l_accel_mag_g',
    'r_accel_mag_g',
  ].join(',');

  if (rows.length === 0) return header;

  const lines = rows.map(r => {
    const lMag = Math.sqrt(r.l_ax**2 + r.l_ay**2 + (r.l_az - 1)**2);
    const rMag = Math.sqrt(r.r_ax**2 + r.r_ay**2 + (r.r_az - 1)**2);
    return [
      r.ts,
      r.l_ax.toFixed(6), r.l_ay.toFixed(6), r.l_az.toFixed(6),
      r.l_gx.toFixed(6), r.l_gy.toFixed(6), r.l_gz.toFixed(6),
      r.r_ax.toFixed(6), r.r_ay.toFixed(6), r.r_az.toFixed(6),
      r.r_gx.toFixed(6), r.r_gy.toFixed(6), r.r_gz.toFixed(6),
      lMag.toFixed(6),
      rMag.toFixed(6),
    ].join(',');
  });

  return [header, ...lines].join('\n');
}

// ── Build punch events CSV string ─────────────────────────────────────────────
function buildPunchCsv(rows: PunchRow[]): string {
  const header = [
    'punch_number',
    'ts',
    'punch_type',
    'speed_ms',
    'force_n',
    'peak_g',
    'speed_kmh',
    'force_kg',
    'best_speed_ms',
    'best_force_n',
    'session_s',
  ].join(',');

  if (rows.length === 0) return header;

  const lines = rows.map(r => [
    r.punch_number,
    r.ts,
    r.punch_type   || '',
    r.speed_ms     != null ? r.speed_ms.toFixed(3)      : '0',
    r.force_n      != null ? r.force_n.toFixed(2)       : '0',
    r.peak_g       != null ? r.peak_g.toFixed(3)        : '0',
    r.speed_ms     != null ? (r.speed_ms * 3.6).toFixed(2) : '0',
    r.force_n      != null ? (r.force_n / 9.80665).toFixed(2) : '0',
    r.best_speed_ms != null ? r.best_speed_ms.toFixed(3) : '0',
    r.best_force_n  != null ? r.best_force_n.toFixed(2)  : '0',
    r.session_s    || 0,
  ].join(','));

  return [header, ...lines].join('\n');
}

// ── Core export function — writes both files, returns paths ───────────────────
export async function exportSession(sessionId: string): Promise<{
  rawPath:   string;
  punchPath: string;
}> {
  // ── Validate RNFS is available ────────────────────────────────────────────
  const baseDir = RNFS.DocumentDirectoryPath;
  if (!baseDir) {
    throw new Error('RNFS.DocumentDirectoryPath is null — RNFS not installed correctly');
  }

  console.log('Export base directory:', baseDir);

  // ── Query DB ──────────────────────────────────────────────────────────────
  const rawRows = db.getAllSync<SensorRow>(
    'SELECT * FROM sensor_readings WHERE session_id = ? ORDER BY ts ASC',
    [sessionId]
  );

  const punchRows = db.getAllSync<PunchRow>(
    'SELECT * FROM punch_events WHERE session_id = ? ORDER BY punch_number ASC',
    [sessionId]
  );

  console.log(`Export: ${rawRows.length} IMU rows, ${punchRows.length} punch events`);

  // ── Build CSV content ─────────────────────────────────────────────────────
  const rawCsv   = buildRawCsv(rawRows);
  const punchCsv = buildPunchCsv(punchRows);

  // ── Build file paths — use timestamp to avoid collisions ─────────────────
  const timestamp = Date.now();
  const rawPath   = `${baseDir}/${sessionId}_raw_imu_${timestamp}.csv`;
  const punchPath = `${baseDir}/${sessionId}_punches_${timestamp}.csv`;

  console.log('Writing raw IMU file to:', rawPath);
  console.log('Writing punch file to:',  punchPath);

  // ── Write files ───────────────────────────────────────────────────────────
  await RNFS.writeFile(rawPath,   rawCsv,   'utf8');
  await RNFS.writeFile(punchPath, punchCsv, 'utf8');

  // ── Verify files were actually written ───────────────────────────────────
  const rawExists   = await RNFS.exists(rawPath);
  const punchExists = await RNFS.exists(punchPath);

  console.log('Raw file exists after write:',   rawExists);
  console.log('Punch file exists after write:', punchExists);

  if (!rawExists || !punchExists) {
    throw new Error('File write succeeded but files not found on disk');
  }

  return { rawPath, punchPath };
}

// ── Share both files via native share sheet ───────────────────────────────────
export async function shareSession(sessionId: string): Promise<void> {
  // ── Step 1: export files first ────────────────────────────────────────────
  const { rawPath, punchPath } = await exportSession(sessionId);

  // ── Step 2: validate paths before sharing ────────────────────────────────
  if (!rawPath || !punchPath) {
    throw new Error(`File path is null. rawPath: ${rawPath}, punchPath: ${punchPath}`);
  }

  // ── Step 3: confirm sharing is available on this device ──────────────────
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sharing is not available on this device');
  }

  // ── Step 4: add 'file://' prefix — THIS was the root cause ───────────────
  // expo-sharing on Android requires 'file://' prefix
  // RNFS gives paths WITHOUT the prefix e.g. '/data/user/0/.../files/x.csv'
  // Sharing.shareAsync needs    'file:///data/user/0/.../files/x.csv'

  const toFileUri = (path: string): string => {
    if (path.startsWith('file://')) return path;   // already correct
    return `file://${path}`;                        // add prefix
  };

  const rawUri   = toFileUri(rawPath);
  const punchUri = toFileUri(punchPath);

  console.log('Sharing punch file:', punchUri);
  console.log('Sharing raw file:',  rawUri);

  // ── Share punch summary first ─────────────────────────────────────────────
  await Sharing.shareAsync(punchUri, {
    mimeType:    'text/csv',
    dialogTitle: 'Save punch summary CSV',
    UTI:         'public.comma-separated-values-text',
  });

  // ── Share raw IMU data second ─────────────────────────────────────────────
  await Sharing.shareAsync(rawUri, {
    mimeType:    'text/csv',
    dialogTitle: 'Save raw IMU data CSV',
    UTI:         'public.comma-separated-values-text',
  });
}
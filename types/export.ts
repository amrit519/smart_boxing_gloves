import RNFS from 'react-native-fs';
import * as Sharing from 'expo-sharing';
import { db } from './db';

// Every column in the same order as sensor_readings table
const CSV_HEADER = [
  'ts',
  'l_ax','l_ay','l_az','l_gx','l_gy','l_gz',
  'l_mag','l_speed','l_punch','l_punch_cnt',
  'l_force_n','l_peak_g','l_punch_type','l_best_spd','l_best_frc',
  'r_ax','r_ay','r_az','r_gx','r_gy','r_gz',
  'r_mag','r_speed','r_punch','r_punch_cnt',
  'r_force_n','r_peak_g','r_punch_type','r_best_spd','r_best_frc',
].join(',');

type SensorRow = {
  ts: number;
  l_ax: number; l_ay: number; l_az: number;
  l_gx: number; l_gy: number; l_gz: number;
  l_mag: number; l_speed: number;
  l_punch: number; l_punch_cnt: number;
  l_force_n: number; l_peak_g: number;
  l_punch_type: string;
  l_best_spd: number; l_best_frc: number;
  r_ax: number; r_ay: number; r_az: number;
  r_gx: number; r_gy: number; r_gz: number;
  r_mag: number; r_speed: number;
  r_punch: number; r_punch_cnt: number;
  r_force_n: number; r_peak_g: number;
  r_punch_type: string;
  r_best_spd: number; r_best_frc: number;
};

function rowToCsvLine(r: SensorRow): string {
  return [
    r.ts,
    r.l_ax, r.l_ay, r.l_az,
    r.l_gx, r.l_gy, r.l_gz,
    r.l_mag, r.l_speed,
    r.l_punch, r.l_punch_cnt,
    r.l_force_n, r.l_peak_g,
    r.l_punch_type ?? '',
    r.l_best_spd, r.l_best_frc,
    r.r_ax, r.r_ay, r.r_az,
    r.r_gx, r.r_gy, r.r_gz,
    r.r_mag, r.r_speed,
    r.r_punch, r.r_punch_cnt,
    r.r_force_n, r.r_peak_g,
    r.r_punch_type ?? '',
    r.r_best_spd, r.r_best_frc,
  ].join(',');
}

export async function shareSession(sessionId: string): Promise<void> {
  // 1. Read all rows for this session
  const rows = db.getAllSync<SensorRow>(
    'SELECT * FROM sensor_readings WHERE session_id = ? ORDER BY ts ASC',
    [sessionId]
  );

  console.log(`Exporting ${rows.length} rows for session ${sessionId}`);

  // 2. Build CSV string
  const csv = rows.length === 0
    ? CSV_HEADER                                          // empty file — just header
    : [CSV_HEADER, ...rows.map(rowToCsvLine)].join('\n');

  // 3. Write to DocumentDirectoryPath (private, always writable)
  const fileName = `boxing_${sessionId}_${Date.now()}.csv`;
  const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;

  await RNFS.writeFile(filePath, csv, 'utf8');

  // 4. Verify file exists
  const exists = await RNFS.exists(filePath);
  if (!exists) throw new Error(`File not found after write: ${filePath}`);

  console.log(`✅ CSV written: ${filePath} (${rows.length} rows)`);

  // 5. Share via native share sheet
  // expo-sharing requires file:// prefix on Android
  const fileUri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing not available on this device');

  await Sharing.shareAsync(fileUri, {
    mimeType:    'text/csv',
    dialogTitle: `Save boxing session — ${rows.length} readings`,
    UTI:         'public.comma-separated-values-text',
  });
}
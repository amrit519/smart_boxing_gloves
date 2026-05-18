// types/db.ts — single source of truth, replaces both files

import * as SQLite from 'expo-sqlite';

// ── One database file, one schema ─────────────────────────────────────────────
export const db = SQLite.openDatabaseSync('boxing.db');

// ── Physics constants (from your ESP32 code) ──────────────────────────────────
const G_TO_MS2      = 9.80665;   // 1g in m/s²
const GLOVE_MASS_KG = 0.5;       // must match ESP32 GLOVE_MASS_KG

// ── Init — call once in App.tsx ───────────────────────────────────────────────
export function initDatabase(): void {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS sessions (
      id             TEXT    PRIMARY KEY,
      started_at     INTEGER NOT NULL,
      ended_at       INTEGER,
      total_readings INTEGER DEFAULT 0,
      total_punches  INTEGER DEFAULT 0,
      best_speed_ms  REAL    DEFAULT 0,
      best_force_n   REAL    DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sensor_readings (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  TEXT    NOT NULL,
      ts          INTEGER NOT NULL,
      l_ax REAL DEFAULT 0, l_ay REAL DEFAULT 0, l_az REAL DEFAULT 0,
      l_gx REAL DEFAULT 0, l_gy REAL DEFAULT 0, l_gz REAL DEFAULT 0,
      r_ax REAL DEFAULT 0, r_ay REAL DEFAULT 0, r_az REAL DEFAULT 0,
      r_gx REAL DEFAULT 0, r_gy REAL DEFAULT 0, r_gz REAL DEFAULT 0,
      l_accel_mag_g REAL DEFAULT 0,
      r_accel_mag_g REAL DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_readings_session_ts
      ON sensor_readings(session_id, ts);

    CREATE TABLE IF NOT EXISTS punch_events (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id     TEXT    NOT NULL,
      ts             INTEGER NOT NULL,
      punch_number   INTEGER NOT NULL,
      speed_ms       REAL    DEFAULT 0,
      force_n        REAL    DEFAULT 0,
      peak_g         REAL    DEFAULT 0,
      punch_type     TEXT    DEFAULT 'unknown',
      speed_kmh      REAL    DEFAULT 0,
      force_kg       REAL    DEFAULT 0,
      power_watts    REAL    DEFAULT 0,
      best_speed_ms  REAL    DEFAULT 0,
      best_force_n   REAL    DEFAULT 0,
      session_s      INTEGER DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );
  `);

  // ── Migration — add new columns to existing tables if they don't exist ──
  // SQLite doesn't support IF NOT EXISTS on ALTER TABLE
  // so we try each column and silently ignore the error if it already exists
  const migrations = [
    'ALTER TABLE sensor_readings ADD COLUMN l_accel_mag_g REAL DEFAULT 0',
    'ALTER TABLE sensor_readings ADD COLUMN r_accel_mag_g REAL DEFAULT 0',
    'ALTER TABLE sessions ADD COLUMN total_readings INTEGER DEFAULT 0',
    'ALTER TABLE sessions ADD COLUMN total_punches  INTEGER DEFAULT 0',
    'ALTER TABLE sessions ADD COLUMN best_speed_ms  REAL    DEFAULT 0',
    'ALTER TABLE sessions ADD COLUMN best_force_n   REAL    DEFAULT 0',
    'ALTER TABLE punch_events ADD COLUMN speed_kmh    REAL DEFAULT 0',
    'ALTER TABLE punch_events ADD COLUMN force_kg     REAL DEFAULT 0',
    'ALTER TABLE punch_events ADD COLUMN power_watts  REAL DEFAULT 0',
  ];

  for (const migration of migrations) {
    try {
      db.execSync(migration);
      console.log('✅ Migration applied:', migration);
    } catch {
      // Column already exists — this is expected, not an error
    }
  }

  console.log('✅ Database ready');
}

// ═════════════════════════════════════════════════════════════════════════════
//  PHYSICS FORMULAS
//  These mirror what your ESP32 does so phone-side values match device values
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Gravity-compensated acceleration magnitude (in g)
 * Same formula as ESP32: sqrt(ax² + ay² + (az-1)²)
 * Subtracts 1g from Z because gravity always pulls ~1g on Z at rest
 *
 * @param ax - X acceleration in g
 * @param ay - Y acceleration in g
 * @param az - Z acceleration in g (has ~1g gravity component at rest)
 * @returns magnitude in g, gravity removed
 */
export function accelMagnitude(ax: number, ay: number, az: number): number {
  return Math.sqrt(ax * ax + ay * ay + (az - 1) * (az - 1));
}

/**
 * Punch force using Newton's second law: F = m × a
 * peak_g is the max acceleration magnitude during the punch (in g units)
 * Convert to m/s² first: peak_g × 9.80665
 *
 * @param peak_g - peak acceleration in g (from ESP32 peakMag)
 * @returns force in Newtons
 */
export function calcForce(peak_g: number): number {
  return GLOVE_MASS_KG * peak_g * G_TO_MS2;
}

/**
 * Punch power: P = F × v
 * Instantaneous power at the moment of peak impact
 *
 * @param force_n  - impact force in Newtons
 * @param speed_ms - glove speed in m/s at peak G moment
 * @returns power in Watts
 */
export function calcPower(force_n: number, speed_ms: number): number {
  return force_n * speed_ms;
}

/**
 * Speed in km/h from m/s
 */
export function msToKmh(speed_ms: number): number {
  return speed_ms * 3.6;
}

/**
 * Force in kg-force from Newtons (easier to understand for boxers)
 * 1 kgf = 9.80665 N
 */
export function nToKgf(force_n: number): number {
  return force_n / G_TO_MS2;
}

// ═════════════════════════════════════════════════════════════════════════════
//  SESSION MANAGEMENT
// ═════════════════════════════════════════════════════════════════════════════

export function startSession(): string {
  const sessionId = `session_${Date.now()}`;
  db.runSync(
    'INSERT INTO sessions (id, started_at) VALUES (?, ?)',
    [sessionId, Date.now()]
  );
  console.log('▶ Session started:', sessionId);
  return sessionId;
}

export function endSession(sessionId: string): SessionSummary {
  const endTime = Date.now();

  // Count saved readings
  const readingResult = db.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM sensor_readings WHERE session_id = ?',
    [sessionId]
  );

  // Count punch events
  const punchResult = db.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM punch_events WHERE session_id = ?',
    [sessionId]
  );

  // Get best speed and force achieved
  const bests = db.getFirstSync<{ best_speed: number; best_force: number }>(
    `SELECT 
       MAX(speed_ms) as best_speed,
       MAX(force_n)  as best_force
     FROM punch_events WHERE session_id = ?`,
    [sessionId]
  );

  const totalReadings = readingResult?.count    ?? 0;
  const totalPunches  = punchResult?.count      ?? 0;
  const bestSpeed     = bests?.best_speed       ?? 0;
  const bestForce     = bests?.best_force       ?? 0;

  // Get session start for duration
  const session = db.getFirstSync<{ started_at: number }>(
    'SELECT started_at FROM sessions WHERE id = ?',
    [sessionId]
  );

  const durationMs = endTime - (session?.started_at ?? endTime);

  // Write final stats to sessions table
  db.runSync(
    `UPDATE sessions SET
       ended_at       = ?,
       total_readings = ?,
       total_punches  = ?,
       best_speed_ms  = ?,
       best_force_n   = ?
     WHERE id = ?`,
    [endTime, totalReadings, totalPunches, bestSpeed, bestForce, sessionId]
  );

  console.log(`⏹ Session ended: ${totalReadings} readings, ${totalPunches} punches`);

  return {
    sessionId,
    durationMs,
    totalReadings,
    totalPunches,
    samplesPerSecond: durationMs > 0
      ? Math.round(totalReadings / (durationMs / 1000))
      : 0,
    bestSpeedMs:  bestSpeed,
    bestForceN:   bestForce,
    bestSpeedKmh: msToKmh(bestSpeed),
    bestForceKgf: nToKgf(bestForce),
    bestPowerW:   calcPower(bestForce, bestSpeed),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
//  SENSOR READINGS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Batch insert raw IMU rows into sensor_readings
 * Called every 500ms by the flush interval in your component
 * Computes accel magnitude at insert time so CSV has it pre-calculated
 */
export async function saveBatch(
  rows: RawPacket[],
  sessionId: string
): Promise<void> {
  if (rows.length === 0) return;

  // Use a transaction — inserts 10 rows in one commit instead of 10 commits
  await db.withTransactionAsync(async () => {
    for (const r of rows) {
      // Compute gravity-compensated magnitude for both gloves
      // This mirrors ESP32's rawMag = sqrtf(ax*ax + ay*ay + daz*daz)
      const lMag = accelMagnitude(
        r.L?.ax ?? 0,
        r.L?.ay ?? 0,
        r.L?.az ?? 0
      );
      const rMag = accelMagnitude(
        r.R?.ax ?? 0,
        r.R?.ay ?? 0,
        r.R?.az ?? 0
      );

      await db.runAsync(
        `INSERT INTO sensor_readings
          (session_id, ts,
           l_ax, l_ay, l_az, l_gx, l_gy, l_gz,
           r_ax, r_ay, r_az, r_gx, r_gy, r_gz,
           l_accel_mag_g, r_accel_mag_g)
         VALUES (?,?, ?,?,?,?,?,?, ?,?,?,?,?,?, ?,?)`,
        [
          sessionId,
          r.ts ?? Date.now(),
          r.L?.ax ?? 0, r.L?.ay ?? 0, r.L?.az ?? 0,
          r.L?.gx ?? 0, r.L?.gy ?? 0, r.L?.gz ?? 0,
          r.R?.ax ?? 0, r.R?.ay ?? 0, r.R?.az ?? 0,
          r.R?.gx ?? 0, r.R?.gy ?? 0, r.R?.gz ?? 0,
          lMag,
          rMag,
        ]
      );
    }
  });
}

// ═════════════════════════════════════════════════════════════════════════════
//  PUNCH EVENTS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Save a confirmed punch event from ESP32
 * ESP32 already computed speed_ms, force_n, peak_g
 * We add derived values (kmh, kgf, watts) here for the CSV
 */
export async function savePunchEvent(
  sessionId: string,
  punch: PunchEvent
): Promise<void> {
  // Derived values — computed here so CSV is analysis-ready
  const speed_kmh   = msToKmh(punch.speed_ms);
  const force_kg    = nToKgf(punch.force_n);
  const power_watts = calcPower(punch.force_n, punch.speed_ms);

  await db.runAsync(
    `INSERT INTO punch_events
      (session_id, ts, punch_number,
       speed_ms, force_n, peak_g, punch_type,
       speed_kmh, force_kg, power_watts,
       best_speed_ms, best_force_n, session_s)
     VALUES (?,?,?, ?,?,?,?, ?,?,?, ?,?,?)`,
    [
      sessionId,
      Date.now(),
      punch.punch,
      punch.speed_ms,
      punch.force_n,
      punch.peak_g,
      punch.type      ?? 'unknown',
      speed_kmh,
      force_kg,
      power_watts,
      punch.best_speed ?? 0,
      punch.best_force ?? 0,
      punch.session_s  ?? 0,
    ]
  );

  // Update session best values live
  db.runSync(
    `UPDATE sessions SET
       total_punches = ?,
       best_speed_ms = MAX(best_speed_ms, ?),
       best_force_n  = MAX(best_force_n,  ?)
     WHERE id = ?`,
    [punch.punch, punch.speed_ms, punch.force_n, sessionId]
  );

  console.log(
    `🥊 Punch #${punch.punch} saved — ` +
    `${punch.type} | ` +
    `${punch.speed_ms.toFixed(2)} m/s (${speed_kmh.toFixed(1)} km/h) | ` +
    `${punch.force_n.toFixed(1)} N (${force_kg.toFixed(2)} kg) | ` +
    `${power_watts.toFixed(1)} W`
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  QUERY HELPERS
// ═════════════════════════════════════════════════════════════════════════════

export function getSessionReadings(sessionId: string): SensorRow[] {
  return db.getAllSync<SensorRow>(
    'SELECT * FROM sensor_readings WHERE session_id = ? ORDER BY ts ASC',
    [sessionId]
  );
}

export function getSessionPunches(sessionId: string): PunchRow[] {
  return db.getAllSync<PunchRow>(
    'SELECT * FROM punch_events WHERE session_id = ? ORDER BY punch_number ASC',
    [sessionId]
  );
}

export function getAllSessions(): SessionRow[] {
  return db.getAllSync<SessionRow>(
    'SELECT * FROM sessions ORDER BY started_at DESC'
  );
}

export function getSessionStats(sessionId: string) {
  return db.getFirstSync(
    `SELECT
       COUNT(*)               as total_readings,
       MIN(ts)                as first_ts,
       MAX(ts)                as last_ts,
       AVG(l_accel_mag_g)    as avg_l_mag,
       AVG(r_accel_mag_g)    as avg_r_mag,
       MAX(l_accel_mag_g)    as peak_l_mag,
       MAX(r_accel_mag_g)    as peak_r_mag
     FROM sensor_readings WHERE session_id = ?`,
    [sessionId]
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  TYPES
// ═════════════════════════════════════════════════════════════════════════════

export type RawPacket = {
  L?: { ax: number; ay: number; az: number; gx: number; gy: number; gz: number };
  R?: { ax: number; ay: number; az: number; gx: number; gy: number; gz: number };
  ts?: number;
};

export type PunchEvent = {
  punch:      number;
  speed_ms:   number;
  force_n:    number;
  peak_g:     number;
  type:       string;
  best_speed: number;
  best_force: number;
  session_s:  number;
};

export type SessionSummary = {
  sessionId:        string;
  durationMs:       number;
  totalReadings:    number;
  totalPunches:     number;
  samplesPerSecond: number;
  bestSpeedMs:      number;
  bestForceN:       number;
  bestSpeedKmh:     number;
  bestForceKgf:     number;
  bestPowerW:       number;
};

export type SensorRow = {
  id:            number;
  session_id:    string;
  ts:            number;
  l_ax: number; l_ay: number; l_az: number;
  l_gx: number; l_gy: number; l_gz: number;
  r_ax: number; r_ay: number; r_az: number;
  r_gx: number; r_gy: number; r_gz: number;
  l_accel_mag_g: number;
  r_accel_mag_g: number;
};

export type PunchRow = {
  id:            number;
  session_id:    string;
  ts:            number;
  punch_number:  number;
  speed_ms:      number;
  force_n:       number;
  peak_g:        number;
  punch_type:    string;
  speed_kmh:     number;
  force_kg:      number;
  power_watts:   number;
  best_speed_ms: number;
  best_force_n:  number;
  session_s:     number;
};

export type SessionRow = {
  id:             string;
  started_at:     number;
  ended_at:       number | null;
  total_readings: number;
  total_punches:  number;
  best_speed_ms:  number;
  best_force_n:   number;
};
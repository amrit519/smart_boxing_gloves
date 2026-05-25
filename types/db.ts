import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('boxing.db');

export function initDatabase(): void {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT    PRIMARY KEY,
      started_at INTEGER NOT NULL,
      ended_at   INTEGER
    );

    CREATE TABLE IF NOT EXISTS sensor_readings (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT    NOT NULL,
      ts         INTEGER NOT NULL,
      l_ax       REAL DEFAULT 0,
      l_ay       REAL DEFAULT 0,
      l_az       REAL DEFAULT 0,
      l_gx       REAL DEFAULT 0,
      l_gy       REAL DEFAULT 0,
      l_gz       REAL DEFAULT 0,
      l_mag      REAL DEFAULT 0,
      l_speed    REAL DEFAULT 0,
      l_punch    INTEGER DEFAULT 0,
      l_punch_cnt INTEGER DEFAULT 0,
      l_force_n  REAL DEFAULT 0,
      l_peak_g   REAL DEFAULT 0,
      l_punch_type TEXT DEFAULT '',
      l_best_spd REAL DEFAULT 0,
      l_best_frc REAL DEFAULT 0,
      r_ax       REAL DEFAULT 0,
      r_ay       REAL DEFAULT 0,
      r_az       REAL DEFAULT 0,
      r_gx       REAL DEFAULT 0,
      r_gy       REAL DEFAULT 0,
      r_gz       REAL DEFAULT 0,
      r_mag      REAL DEFAULT 0,
      r_speed    REAL DEFAULT 0,
      r_punch    INTEGER DEFAULT 0,
      r_punch_cnt INTEGER DEFAULT 0,
      r_force_n  REAL DEFAULT 0,
      r_peak_g   REAL DEFAULT 0,
      r_punch_type TEXT DEFAULT '',
      r_best_spd REAL DEFAULT 0,
      r_best_frc REAL DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_session_ts
      ON sensor_readings(session_id, ts);
  `);

  const migrations = [
    'ALTER TABLE sensor_readings ADD COLUMN l_mag       REAL DEFAULT 0',
    'ALTER TABLE sensor_readings ADD COLUMN l_speed     REAL DEFAULT 0',
    'ALTER TABLE sensor_readings ADD COLUMN l_punch     INTEGER DEFAULT 0',
    'ALTER TABLE sensor_readings ADD COLUMN l_punch_cnt INTEGER DEFAULT 0',
    'ALTER TABLE sensor_readings ADD COLUMN l_force_n   REAL DEFAULT 0',
    'ALTER TABLE sensor_readings ADD COLUMN l_peak_g    REAL DEFAULT 0',
    "ALTER TABLE sensor_readings ADD COLUMN l_punch_type TEXT DEFAULT ''",
    'ALTER TABLE sensor_readings ADD COLUMN l_best_spd  REAL DEFAULT 0',
    'ALTER TABLE sensor_readings ADD COLUMN l_best_frc  REAL DEFAULT 0',
    'ALTER TABLE sensor_readings ADD COLUMN r_mag       REAL DEFAULT 0',
    'ALTER TABLE sensor_readings ADD COLUMN r_speed     REAL DEFAULT 0',
    'ALTER TABLE sensor_readings ADD COLUMN r_punch     INTEGER DEFAULT 0',
    'ALTER TABLE sensor_readings ADD COLUMN r_punch_cnt INTEGER DEFAULT 0',
    'ALTER TABLE sensor_readings ADD COLUMN r_force_n   REAL DEFAULT 0',
    'ALTER TABLE sensor_readings ADD COLUMN r_peak_g    REAL DEFAULT 0',
    "ALTER TABLE sensor_readings ADD COLUMN r_punch_type TEXT DEFAULT ''",
    'ALTER TABLE sensor_readings ADD COLUMN r_best_spd  REAL DEFAULT 0',
    'ALTER TABLE sensor_readings ADD COLUMN r_best_frc  REAL DEFAULT 0',
  ];

  for (const sql of migrations) {
    try { db.execSync(sql); } catch { /* column already exists */ }
  }

  console.log('✅ DB ready');
}

// ── Session ───────────────────────────────────────────────────────────────────

export function startSession(): string {
  const id = `session_${Date.now()}`;
  db.runSync('INSERT INTO sessions (id, started_at) VALUES (?, ?)', [id, Date.now()]);
  console.log('▶ Session started:', id);
  return id;
}

export function endSession(sessionId: string): SessionSummary {
  const endTime = Date.now();

  const session = db.getFirstSync<{ started_at: number }>(
    'SELECT started_at FROM sessions WHERE id = ?', [sessionId]
  );
  const count = db.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM sensor_readings WHERE session_id = ?', [sessionId]
  );

  db.runSync(
    'UPDATE sessions SET ended_at = ? WHERE id = ?',
    [endTime, sessionId]
  );

  const durationMs    = endTime - (session?.started_at ?? endTime);
  const totalReadings = count?.count ?? 0;

  console.log(`⏹ Session ended: ${totalReadings} readings, ${(durationMs/1000).toFixed(1)}s`);

  return {
    sessionId,
    durationMs,
    totalReadings,
    samplesPerSecond: durationMs > 0
      ? Math.round(totalReadings / (durationMs / 1000))
      : 0,
  };
}

// ── Batch insert — called every 500ms ─────────────────────────────────────────
//
// ⭐ KEY FIX: Changed from async (withTransactionAsync + runAsync) to
//    sync (withTransactionSync + runSync).
//
//    The old async version released the JS thread during each await,
//    allowing sync calls (startSession, endSession) to run while the
//    transaction still held the SQLite write lock → "database is locked".
//
//    The sync version blocks the JS thread until the entire transaction
//    finishes, so no other DB call can interleave → no lock conflict.
// ──────────────────────────────────────────────────────────────────────────────

export function saveBatch(rows: RawPacket[], sessionId: string): void {
  if (rows.length === 0) return;

  db.withTransactionSync(() => {
    for (const r of rows) {
      try {
        db.runSync(
          `INSERT INTO sensor_readings (
            session_id, ts,
            l_ax, l_ay, l_az, l_gx, l_gy, l_gz,
            l_mag, l_speed, l_punch, l_punch_cnt,
            l_force_n, l_peak_g, l_punch_type, l_best_spd, l_best_frc,
            r_ax, r_ay, r_az, r_gx, r_gy, r_gz,
            r_mag, r_speed, r_punch, r_punch_cnt,
            r_force_n, r_peak_g, r_punch_type, r_best_spd, r_best_frc
          ) VALUES (
            ?,?,
            ?,?,?,?,?,?,
            ?,?,?,?,
            ?,?,?,?,?,
            ?,?,?,?,?,?,
            ?,?,?,?,
            ?,?,?,?,?
          )`,
          [
            sessionId,
            r.ts ?? Date.now(),
            // Left
            r.L?.ax ?? 0,         r.L?.ay ?? 0,         r.L?.az ?? 0,
            r.L?.gx ?? 0,         r.L?.gy ?? 0,         r.L?.gz ?? 0,
            r.L?.mag ?? 0,        r.L?.speed ?? 0,
            r.L?.punch ?? 0,      r.L?.punch_cnt ?? 0,
            r.L?.force_n ?? 0,    r.L?.peak_g ?? 0,
            r.L?.punch_type ?? '', r.L?.best_spd ?? 0,   r.L?.best_frc ?? 0,
            // Right
            r.R?.ax ?? 0,         r.R?.ay ?? 0,         r.R?.az ?? 0,
            r.R?.gx ?? 0,         r.R?.gy ?? 0,         r.R?.gz ?? 0,
            r.R?.mag ?? 0,        r.R?.speed ?? 0,
            r.R?.punch ?? 0,      r.R?.punch_cnt ?? 0,
            r.R?.force_n ?? 0,    r.R?.peak_g ?? 0,
            r.R?.punch_type ?? '', r.R?.best_spd ?? 0,   r.R?.best_frc ?? 0,
          ]
        );
      } catch (err) {
        console.warn('Skipping bad packet during batch save:', err);
      }
    }
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type RawPacket = {
  ts?: number;
  L?: {
    ax: number; ay: number; az: number;
    gx: number; gy: number; gz: number;
    mag: number; speed: number;
    punch: number; punch_cnt: number;
    force_n: number; peak_g: number;
    punch_type: string;
    best_spd: number; best_frc: number;
  };
  R?: {
    ax: number; ay: number; az: number;
    gx: number; gy: number; gz: number;
    mag: number; speed: number;
    punch: number; punch_cnt: number;
    force_n: number; peak_g: number;
    punch_type: string;
    best_spd: number; best_frc: number;
  };
};

export type SessionSummary = {
  sessionId:        string;
  durationMs:       number;
  totalReadings:    number;
  samplesPerSecond: number;
};
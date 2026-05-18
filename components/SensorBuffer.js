class SensorBuffer {
  constructor(flushInterval = 500, maxBufferSize = 100) {
    this.buffer = [];
    this.flushInterval = flushInterval;   // ms between flushes
    this.maxBufferSize = maxBufferSize;   // force flush after this many
    this.timer = null;
    this.currentSessionId = null;
    this.isFlushing = false;
  }

  // ─── Start Buffering for a Session ─────────────────
  async start() {
    this.currentSessionId = await database.startSession();
    this.buffer = [];

    this.timer = setInterval(() => {
      this.flush();
    }, this.flushInterval);

    return this.currentSessionId;
  }

  // ─── Add a Reading to Buffer ───────────────────────
  add(data) {
    // data = {"L":{"ax":...,"ay":...,...},"R":{"ax":...,...},"ts":131511}
    this.buffer.push(data);

    // Force flush if buffer is full
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  // ─── Flush Buffer to SQLite ────────────────────────
  async flush() {
    if (this.isFlushing || this.buffer.length === 0 || !this.currentSessionId) {
      return;
    }

    this.isFlushing = true;

    try {
      const toInsert = [...this.buffer];  // copy
      this.buffer = [];                    // clear buffer immediately

      await database.insertReadingBatch(this.currentSessionId, toInsert);
      
      console.log(`💾 Flushed ${toInsert.length} readings to SQLite`);
    } catch (error) {
      console.error('❌ Flush failed:', error);
      // Re-add failed data? Or log it? Your choice.
    } finally {
      this.isFlushing = false;
    }
  }

  // ─── Stop Buffering ────────────────────────────────
  async stop(totalPunches = 0) {
    clearInterval(this.timer);
    await this.flush();  // flush remaining data
    await database.endSession(this.currentSessionId, totalPunches);
    
    const sessionId = this.currentSessionId;
    this.currentSessionId = null;
    return sessionId;
  }
}

export const sensorBuffer = new SensorBuffer();
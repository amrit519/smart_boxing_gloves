import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PunchEvent, RoundStats } from '@/types/database';

interface PracticeState {
    isSessionActive: boolean;
    sessionId: string | null;
    currentRound: number;
    totalRounds: number;
    roundDuration: number; // seconds
    restDuration: number; // seconds
    timeRemaining: number; // seconds
    isResting: boolean;

    // Live punch data
    totalPunches: number;
    currentSpeed: number;
    currentPower: number;
    averageSpeed: number;
    averagePower: number;

    // Fatigue tracking
    baselineSpeed: number; // Round 1 avg speed
    fatigueLevel: number; // 0-100
    showFatigueAlert: boolean;

    // Round history
    roundStats: RoundStats[];

    // Accumulator for current round
    roundPunchCount: number;
    roundSpeedSum: number;
    roundPowerSum: number;
}

const initialState: PracticeState = {
    isSessionActive: false,
    sessionId: null,
    currentRound: 0,
    totalRounds: 4,
    roundDuration: 180, // 3 minutes
    restDuration: 60,   // 1 minute
    timeRemaining: 180,
    isResting: false,

    totalPunches: 0,
    currentSpeed: 0,
    currentPower: 0,
    averageSpeed: 0,
    averagePower: 0,

    baselineSpeed: 0,
    fatigueLevel: 0,
    showFatigueAlert: false,

    roundStats: [],

    roundPunchCount: 0,
    roundSpeedSum: 0,
    roundPowerSum: 0,
};

const practiceSlice = createSlice({
    name: 'practice',
    initialState,
    reducers: {
        startSession: (state, action: PayloadAction<{ totalRounds?: number; roundDuration?: number; restDuration?: number }>) => {
            state.isSessionActive = true;
            state.sessionId = `session_${Date.now()}`;
            state.currentRound = 1;
            state.totalRounds = action.payload.totalRounds || 4;
            state.roundDuration = action.payload.roundDuration || 180;
            state.restDuration = action.payload.restDuration || 60;
            state.timeRemaining = state.roundDuration;
            state.isResting = false;
            state.totalPunches = 0;
            state.currentSpeed = 0;
            state.currentPower = 0;
            state.averageSpeed = 0;
            state.averagePower = 0;
            state.baselineSpeed = 0;
            state.fatigueLevel = 0;
            state.showFatigueAlert = false;
            state.roundStats = [];
            state.roundPunchCount = 0;
            state.roundSpeedSum = 0;
            state.roundPowerSum = 0;
        },

        endSession: (state) => {
            state.isSessionActive = false;
        },

        addPunchData: (state, action: PayloadAction<PunchEvent>) => {
            const punch = action.payload;
            state.totalPunches += 1;
            state.currentSpeed = punch.speed;
            state.currentPower = punch.power;

            // Update round accumulators
            state.roundPunchCount += 1;
            state.roundSpeedSum += punch.speed;
            state.roundPowerSum += punch.power;

            // Update session averages
            state.averageSpeed = state.roundSpeedSum / state.roundPunchCount;
            state.averagePower = state.roundPowerSum / state.roundPunchCount;
        },

        endRound: (state) => {
            const avgSpeed = state.roundPunchCount > 0 ? state.roundSpeedSum / state.roundPunchCount : 0;
            const avgPower = state.roundPunchCount > 0 ? state.roundPowerSum / state.roundPunchCount : 0;

            // Set baseline from round 1
            if (state.currentRound === 1) {
                state.baselineSpeed = avgSpeed;
            }

            // Calculate fatigue
            let fatigue = 0;
            if (state.baselineSpeed > 0 && state.currentRound > 1) {
                const drop = state.baselineSpeed - avgSpeed;
                fatigue = Math.max(0, Math.min(100, Math.round((drop / state.baselineSpeed) * 100)));
            }
            state.fatigueLevel = fatigue;
            state.showFatigueAlert = fatigue > 80;

            // Save round stats
            state.roundStats.push({
                id: `round_${state.currentRound}_${Date.now()}`,
                session_id: state.sessionId || '',
                round_number: state.currentRound,
                punch_count: state.roundPunchCount,
                avg_speed: Math.round(avgSpeed * 10) / 10,
                avg_power: Math.round(avgPower * 10) / 10,
                fatigue_level: fatigue,
            });

            // Reset round accumulators
            state.roundPunchCount = 0;
            state.roundSpeedSum = 0;
            state.roundPowerSum = 0;
        },

        startNextRound: (state) => {
            if (state.currentRound < state.totalRounds) {
                state.currentRound += 1;
                state.timeRemaining = state.roundDuration;
                state.isResting = false;
            }
        },

        startRest: (state) => {
            state.isResting = true;
            state.timeRemaining = state.restDuration;
        },

        tickTimer: (state) => {
            if (state.timeRemaining > 0) {
                state.timeRemaining -= 1;
            }
        },

        dismissFatigueAlert: (state) => {
            state.showFatigueAlert = false;
        },

        setSessionConfig: (state, action: PayloadAction<{ totalRounds?: number; roundDuration?: number; restDuration?: number }>) => {
            if (action.payload.totalRounds) state.totalRounds = action.payload.totalRounds;
            if (action.payload.roundDuration) state.roundDuration = action.payload.roundDuration;
            if (action.payload.restDuration) state.restDuration = action.payload.restDuration;
        },
    },
});

export const {
    startSession,
    endSession,
    addPunchData,
    endRound,
    startNextRound,
    startRest,
    tickTimer,
    dismissFatigueAlert,
    setSessionConfig,
} = practiceSlice.actions;

export default practiceSlice.reducer;

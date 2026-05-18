import { useEffect, useRef, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { addPunchData } from '@/store/slices/practiceSlice';
import { PunchEvent } from '@/types/database';

/**
 * Generates simulated punch events at realistic intervals.
 * Simulates speed degradation over rounds for fatigue testing.
 * Easy on/off toggle – will be replaced by real SDK data.
 */
export const useMockGloveData = (enabled: boolean = false) => {
    const dispatch = useAppDispatch();
    const { isSessionActive, currentRound } = useAppSelector(state => state.practice);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const punchTypes: PunchEvent['type'][] = ['jab', 'cross', 'hook', 'uppercut'];

    const generatePunch = useCallback((): PunchEvent => {
        // Base speed degrades with each round to simulate fatigue
        const roundDegradation = (currentRound - 1) * 2.5; // ~2.5 m/s drop per round
        const baseSpeed = 20 - roundDegradation;
        const speed = Math.max(5, baseSpeed + (Math.random() * 6 - 3)); // ±3 m/s variance

        const basePower = 80 - (currentRound - 1) * 8; // power drops too
        const power = Math.max(20, basePower + (Math.random() * 20 - 10)); // ±10 variance

        return {
            timestamp: Date.now(),
            speed: Math.round(speed * 10) / 10,
            power: Math.round(power * 10) / 10,
            type: punchTypes[Math.floor(Math.random() * punchTypes.length)],
        };
    }, [currentRound]);

    useEffect(() => {
        if (enabled && isSessionActive) {
            // Generate a punch every 400-800ms (realistic boxing pace)
            intervalRef.current = setInterval(() => {
                const punch = generatePunch();
                dispatch(addPunchData(punch));
            }, 400 + Math.random() * 400);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [enabled, isSessionActive, generatePunch, dispatch]);

    return { isGenerating: enabled && isSessionActive };
};

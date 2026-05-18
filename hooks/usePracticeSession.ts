import { useEffect, useRef, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
    startSession,
    endSession,
    endRound,
    startNextRound,
    startRest,
    tickTimer,
} from '@/store/slices/practiceSlice';

/**
 * Manages the practice session lifecycle:
 * - Start/stop sessions
 * - Round management with automatic transitions
 * - Timer countdown
 */
export const usePracticeSession = () => {
    const dispatch = useAppDispatch();
    const practice = useAppSelector(state => state.practice);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Timer countdown
    useEffect(() => {
        if (practice.isSessionActive && practice.timeRemaining > 0) {
            timerRef.current = setInterval(() => {
                dispatch(tickTimer());
            }, 1000);
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [practice.isSessionActive, practice.timeRemaining > 0, dispatch]);

    // Handle round/rest transitions when timer hits 0
    useEffect(() => {
        if (!practice.isSessionActive || practice.timeRemaining > 0) return;

        if (!practice.isResting) {
            // Round just ended
            dispatch(endRound());
            if (practice.currentRound < practice.totalRounds) {
                dispatch(startRest());
            } else {
                // All rounds done
                dispatch(endSession());
            }
        } else {
            // Rest period ended, start next round
            dispatch(startNextRound());
        }
    }, [practice.timeRemaining, practice.isSessionActive, practice.isResting, dispatch]);

    const handleStartSession = useCallback((config?: {
        totalRounds?: number;
        roundDuration?: number;
        restDuration?: number;
    }) => {
        dispatch(startSession(config || {}));
    }, [dispatch]);

    const handleEndSession = useCallback(() => {
        dispatch(endSession());
        dispatch(endRound());
    }, [dispatch]);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return {
        ...practice,
        formattedTime: formatTime(practice.timeRemaining),
        startSession: handleStartSession,
        endSession: handleEndSession,
    };
};

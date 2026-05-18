/**
 * Fatigue calculation utilities for the Fight App.
 *
 * Algorithm:
 *   Store the Average Speed of Round 1 as the "Baseline".
 *   In subsequent rounds, compare Current Speed Average to Baseline.
 *   Fatigue % = ((Baseline - CurrentSpeed) / Baseline) * 100
 *
 * Example:
 *   Round 1 Avg Speed: 20 m/s (Baseline)
 *   Round 2 Avg Speed: 16 m/s
 *   Drop = 4 m/s → Fatigue = (4/20)*100 = 20%
 */

export function calculateFatigue(baselineSpeed: number, currentSpeed: number): number {
    if (baselineSpeed <= 0) return 0;
    const drop = baselineSpeed - currentSpeed;
    const fatigue = Math.max(0, Math.min(100, (drop / baselineSpeed) * 100));
    return Math.round(fatigue);
}

export type FatigueZone = 'green' | 'yellow' | 'red';

export function getFatigueColor(fatigue: number): string {
    if (fatigue < 40) return '#34C759';  // Green
    if (fatigue < 65) return '#FFD60A';  // Yellow
    return '#FF453A';                     // Red
}

export function getFatigueZone(fatigue: number): FatigueZone {
    if (fatigue < 40) return 'green';
    if (fatigue < 65) return 'yellow';
    return 'red';
}

export function shouldAlertCoach(fatigue: number): boolean {
    return fatigue > 50;
}

export function shouldAlertPlayer(fatigue: number): boolean {
    return fatigue > 80;
}

export function getFatigueLabel(fatigue: number): string {
    if (fatigue < 20) return 'Fresh';
    if (fatigue < 40) return 'Warm';
    if (fatigue < 60) return 'Tired';
    if (fatigue < 80) return 'Fatigued';
    return 'Exhausted';
}

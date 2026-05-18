// Database types matching the Supabase schema

export type UserRole = 'player' | 'coach';

export interface Profile {
    id: string; // UUID, links to auth user
    full_name: string;
    role: UserRole;
    club_id: string | null;
    imei_number: string | null;
    avatar_url: string | null;
    created_at: string;
}

export interface PracticeSession {
    id: string;
    user_id: string;
    started_at: string;
    ended_at: string | null;
    total_punches: number;
    average_speed: number;
    average_power: number;
    fatigue_score: number;
    created_at: string;
}

export interface RoundStats {
    id: string;
    session_id: string;
    round_number: number;
    punch_count: number;
    avg_speed: number;
    avg_power: number;
    fatigue_level: number;
}

export interface LeaderboardEntry {
    user_id: string;
    full_name: string;
    avatar_url: string | null;
    total_punches: number;
    total_power: number;
    total_sessions: number;
    rank: number;
}

// Punch event from glove (real-time BLE data)
export interface PunchEvent {
    timestamp: number;
    speed: number;     // m/s
    power: number;     // kg or lbs
    type: 'jab' | 'cross' | 'hook' | 'uppercut' | 'unknown';
}

// Live student data for coach dashboard
export interface LiveStudentData {
    user_id: string;
    full_name: string;
    avatar_url: string | null;
    is_live: boolean;
    current_round: number;
    current_speed: number;
    current_fatigue: number;
    session_id: string | null;
}

// 

/**
 * Fight App color system – Boxing-themed, high-contrast, dark-first design.
 */

export const THEME_COLOR = '#FF3B30'; // Fiery red – primary brand color
export const ACCENT_COLOR = '#FF9500'; // Orange/gold accent

export const Colors = {
  light: {
    text: '#1A1A2E',
    background: '#F5F5FA',
    surface: 'rgba(255, 255, 255, 0.85)',
    surfaceContainer: '#FFFFFF',
    primary: THEME_COLOR,
    accent: ACCENT_COLOR,
    secondary: '#6B7280',
    border: '#E5E7EB',
    icon: '#6B7280',
    error: '#DC3545',
    success: '#34C759',
    warning: '#FFD60A',
    danger: '#FF453A',
  },
  dark: {
    text: '#F0F0F5',
    background: '#0A0A0F',
    surface: 'rgba(28, 28, 38, 0.85)',
    surfaceContainer: '#16161F',
    primary: THEME_COLOR,
    accent: ACCENT_COLOR,
    secondary: '#9CA3AF',
    border: '#2A2A35',
    icon: '#9CA3AF',
    error: '#FF4B55',
    success: '#34C759',
    warning: '#FFD60A',
    danger: '#FF453A',
  },
  // Fatigue bar colors
  fatigue: {
    green: '#34C759',
    yellow: '#FFD60A',
    red: '#FF453A',
  },
  // Leaderboard medal colors
  medals: {
    gold: '#FFD700',
    silver: '#C0C0C0',
    bronze: '#CD7F32',
  },
};

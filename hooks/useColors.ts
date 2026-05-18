import { Colors } from '@/constants/Colors';
import { useTheme } from '@/context/ThemeContext';

export function useColors() {
  const { theme } = useTheme();
  return Colors[theme];
} 
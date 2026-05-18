import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { IconSymbol } from '@/components/ui/IconSymbol';
import { THEME_COLOR, Colors } from '@/constants/Colors';
import { useTheme } from '@/context/ThemeContext';

export default function TabLayout() {
  const  { isDarkMode }  = useTheme();
  const theme = isDarkMode ? Colors.dark : Colors.light;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: THEME_COLOR,
        tabBarInactiveTintColor: isDarkMode ? '#6B7280' : '#9CA3AF',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDarkMode ? '#16161F' : '#FFFFFF',
          borderTopColor: isDarkMode ? '#2A2A35' : '#E5E7EB',
          borderTopWidth: 0.5,
          height: 65,
          paddingBottom: 10,
          paddingTop: 8,
          position: Platform.OS === 'ios' ? 'absolute' : 'relative',
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.3,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Connect',
          tabBarIcon: ({ color, size }) => <IconSymbol name="bluetooth" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          title: 'Practice',
          tabBarIcon: ({ color, size }) => <IconSymbol name="fitness-center" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <IconSymbol name="dashboard" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Ranking',
          tabBarIcon: ({ color, size }) => <IconSymbol name="emoji-events" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <IconSymbol name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

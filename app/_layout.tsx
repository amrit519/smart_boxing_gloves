import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { Provider } from 'react-redux';
import { store } from '@/store';
import { AnimatedSplash } from '@/components/AnimatedSplash';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemeProvider } from '@/context/ThemeContext';
import { LoginScreen } from '@/components/auth/LoginScreen';
import { useAppSelector } from '@/store/hooks';
import { THEME_COLOR } from '@/constants/Colors'; 
import { HardwareProvider } from '@/context/sethardware';
import PracticeScreen from './(tabs)/practice';


const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: THEME_COLOR,
  },
};

const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: THEME_COLOR,
  },
};

// Custom dark theme for navigation
const FightDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0A0A0F',
    card: '#16161F',
    primary: THEME_COLOR,
  },
};

const FightLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#F5F5FA',
    primary: THEME_COLOR,
  },
};

function AppContent() {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const { isAuthenticated } = useAppSelector(state => state.auth);

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <NavigationThemeProvider value={isDarkMode ? FightDarkTheme : FightLightTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown:false}} />     
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [showSplash, setShowSplash] = useState(true);
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    return null;
  }

  if (showSplash) {
    return <AnimatedSplash onAnimationComplete={() => setShowSplash(false)} />;
  }

  const isDarkMode = colorScheme === 'dark';

  return (
    <Provider store={store}>
        <PaperProvider theme={isDarkMode ? darkTheme : lightTheme}>
          <ThemeProvider>
            <HardwareProvider>
              <AppContent />
            </HardwareProvider>
          </ThemeProvider>
        </PaperProvider>
    </Provider>
  );
}

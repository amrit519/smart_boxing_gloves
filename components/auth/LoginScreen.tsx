import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Colors, THEME_COLOR } from '@/constants/Colors';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useAppDispatch } from '@/store/hooks';
import { setUser, setProfile } from '@/store/slices/authSlice'; 

export function LoginScreen() {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? Colors.dark : Colors.light;
  const dispatch = useAppDispatch();

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<'player' | 'coach'>('player');

  const handleSendOTP = async () => {
    if (!phone.trim()) {
      setError('Please enter your phone number');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        phone: phone.trim(),
      });
      if (authError) throw authError;
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim()) {
      setError('Please enter the OTP');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.verifyOtp({
        phone: phone.trim(),
        token: otp.trim(),
        type: 'sms',
      });
      if (authError) throw authError;
      if (data.user) {
        dispatch(setUser({
          id: data.user.id,
          phone: data.user.phone,
        }));
      }
    } catch (err: any) {
      setError(err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  // Demo mode – skip auth for prototype
  const handleDemoLogin = (demoRole: 'player' | 'coach') => {
    dispatch(setUser({
      id: `demo_${demoRole}_${Date.now()}`,
      phone: '+1234567890',
    }));
    dispatch(setProfile({
      id: `demo_${demoRole}_${Date.now()}`,
      full_name: demoRole === 'player' ? 'Alex Fighter' : 'Coach Mike',
      role: demoRole,
      club_id: 'demo_club',
      imei_number: null,
      avatar_url: null,
      created_at: new Date().toISOString(),
    }));
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Logo & Title */}
        <View style={styles.logoSection}>
          <ThemedText style={styles.gloveEmoji}>🥊</ThemedText>
          <ThemedText style={[styles.appName, { color: THEME_COLOR }]}>
            FIGHT APP
          </ThemedText>
          <ThemedText style={[styles.tagline, { color: theme.secondary }]}>
            Train Smarter. Fight Harder.
          </ThemedText>
        </View>

        {/* Auth Form */}
        <View style={[styles.formCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {step === 'phone' ? (
            <>
              <ThemedText style={styles.formTitle}>Enter Phone Number</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceContainer }]}
                placeholder="+91 XXXXX XXXXX"
                placeholderTextColor={theme.secondary}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoFocus
              />
              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleSendOTP}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={styles.primaryButtonText}>Send OTP</ThemedText>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <ThemedText style={styles.formTitle}>Verify OTP</ThemedText>
              <ThemedText style={[styles.otpHint, { color: theme.secondary }]}>
                Code sent to {phone}
              </ThemedText>
              <TextInput
                style={[styles.input, styles.otpInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceContainer }]}
                placeholder="000000"
                placeholderTextColor={theme.secondary}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleVerifyOTP}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={styles.primaryButtonText}>Verify</ThemedText>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setStep('phone'); setOtp(''); }}>
                <ThemedText style={[styles.backLink, { color: theme.primary }]}>
                  ← Change Number
                </ThemedText>
              </TouchableOpacity>
            </>
          )}

          {error && (
            <ThemedText style={[styles.error, { color: theme.error }]}>{error}</ThemedText>
          )}
        </View>

        {/* Demo Buttons */}
        <View style={styles.demoSection}>
          <ThemedText style={[styles.demoLabel, { color: theme.secondary }]}>
            — Quick Demo Access —
          </ThemedText>
          <View style={styles.demoButtons}>
            <TouchableOpacity
              style={[styles.demoButton, { borderColor: THEME_COLOR }]}
              onPress={() => handleDemoLogin('player')}
            >
              <ThemedText style={styles.demoEmoji}>🥊</ThemedText>
              <ThemedText style={[styles.demoButtonText, { color: THEME_COLOR }]}>
                Player
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.demoButton, { borderColor: '#FF9500' }]}
              onPress={() => handleDemoLogin('coach')}
            >
              <ThemedText style={styles.demoEmoji}>📋</ThemedText>
              <ThemedText style={[styles.demoButtonText, { color: '#FF9500' }]}>
                Coach
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  gloveEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  appName: {
    fontSize: 32,
    lineHeight: 42,
    fontWeight: '900',
    letterSpacing: 6,
    paddingVertical: 4,
  },
  tagline: {
    fontSize: 13,
    marginTop: 8,
    letterSpacing: 1,
  },
  formCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
    fontWeight: '700',
  },
  otpHint: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: THEME_COLOR,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  backLink: {
    textAlign: 'center',
    marginTop: 16,
    fontSize: 14,
  },
  error: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },
  demoSection: {
    marginTop: 32,
    alignItems: 'center',
  },
  demoLabel: {
    fontSize: 12,
    marginBottom: 12,
    letterSpacing: 1,
  },
  demoButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  demoButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  demoEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  demoButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});

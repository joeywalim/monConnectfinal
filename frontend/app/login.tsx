import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wrench } from 'lucide-react-native';
import { useAuth } from '../src/auth';
import { colors } from '../src/api';

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing info', 'Please enter email and password');
      return;
    }
    try {
      setLoading(true);
      const u = await signIn(email.trim().toLowerCase(), password);
      if (u.role === 'admin') router.replace('/admin');
      else if (u.role === 'provider') router.replace('/provider-dashboard');
      else router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Login failed', e?.response?.data?.detail || 'Try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <View style={styles.logo}><Wrench color={colors.accent} size={28} /></View>
            <Text style={styles.brand}>TownServe</Text>
          </View>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Book trusted local services in minutes.</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            testID="login-email-input"
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            testID="login-password-input"
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity testID="login-submit-button" style={styles.primaryBtn} onPress={onLogin} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.primaryFg} /> : <Text style={styles.primaryBtnText}>Log in</Text>}
          </TouchableOpacity>

          <TouchableOpacity testID="goto-register-button" style={styles.secondaryLink} onPress={() => router.push('/register')}>
            <Text style={styles.secondaryLinkText}>New here? <Text style={{ color: colors.accent, fontWeight: '700' }}>Create an account</Text></Text>
          </TouchableOpacity>

          <TouchableOpacity testID="guest-browse-button" style={styles.guestLink} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.guestLinkText}>Continue without an account →</Text>
          </TouchableOpacity>

          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>Try demo accounts</Text>
            <Text style={styles.demoText}>Admin: admin@townserve.com / Admin@12345</Text>
            <Text style={styles.demoText}>Provider: ramesh.kumar@townserve.in / Provider@123</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: 24, paddingTop: 32, flexGrow: 1 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  logo: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  brand: { fontSize: 22, fontWeight: '800', color: colors.primary, letterSpacing: -0.5 },
  title: { fontSize: 32, fontWeight: '800', color: colors.primary, marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: colors.muted, marginBottom: 32 },
  label: { fontSize: 14, fontWeight: '600', color: colors.primary, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.primary, marginBottom: 16, minHeight: 48,
  },
  primaryBtn: {
    backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 16, alignItems: 'center',
    justifyContent: 'center', marginTop: 8, minHeight: 52,
  },
  primaryBtnText: { color: colors.primaryFg, fontSize: 16, fontWeight: '700' },
  secondaryLink: { alignItems: 'center', paddingVertical: 12 },
  secondaryLinkText: { color: colors.muted, fontSize: 15 },
  guestLink: { alignItems: 'center', paddingVertical: 8 },
  guestLinkText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  demoBox: { marginTop: 'auto', padding: 14, borderRadius: 12, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A' },
  demoTitle: { fontWeight: '700', color: '#92400E', marginBottom: 4 },
  demoText: { color: '#92400E', fontSize: 13 },
});

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, Role } from '../src/auth';
import { colors } from '../src/api';
import { User, Briefcase } from 'lucide-react-native';

export default function Register() {
  const router = useRouter();
  const { signUp } = useAuth();
  const params = useLocalSearchParams<{ role?: string }>();
  const [role, setRole] = useState<Role>((params.role === 'provider' ? 'provider' : 'customer'));
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!name || !email || !password) {
      Alert.alert('Missing info', 'Please fill all required fields');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters');
      return;
    }
    try {
      setLoading(true);
      const u = await signUp(name.trim(), email.trim().toLowerCase(), password, role, phone.trim() || undefined);
      if (u.role === 'provider') router.replace('/provider-dashboard');
      else router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Registration failed', e?.response?.data?.detail || 'Try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Join MonConnect — book or offer services.</Text>

          <Text style={styles.label}>I am a</Text>
          <View style={styles.roleRow}>
            <TouchableOpacity
              testID="role-customer-button"
              style={[styles.roleCard, role === 'customer' && styles.roleCardActive]}
              onPress={() => setRole('customer')}
            >
              <User color={role === 'customer' ? colors.accent : colors.muted} size={26} />
              <Text style={[styles.roleTitle, role === 'customer' && { color: colors.primary }]}>Customer</Text>
              <Text style={styles.roleDesc}>Book services</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="role-provider-button"
              style={[styles.roleCard, role === 'provider' && styles.roleCardActive]}
              onPress={() => setRole('provider')}
            >
              <Briefcase color={role === 'provider' ? colors.accent : colors.muted} size={26} />
              <Text style={[styles.roleTitle, role === 'provider' && { color: colors.primary }]}>Provider</Text>
              <Text style={styles.roleDesc}>Offer services</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Full name</Text>
          <TextInput testID="register-name-input" style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={colors.muted} />

          <Text style={styles.label}>Email</Text>
          <TextInput testID="register-email-input" style={styles.input} value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" />

          <Text style={styles.label}>Phone (optional)</Text>
          <TextInput testID="register-phone-input" style={styles.input} value={phone} onChangeText={setPhone} placeholder="+91 9999900000" placeholderTextColor={colors.muted} keyboardType="phone-pad" />

          <Text style={styles.label}>Password</Text>
          <TextInput testID="register-password-input" style={styles.input} value={password} onChangeText={setPassword} placeholder="At least 6 characters" placeholderTextColor={colors.muted} secureTextEntry />

          <TouchableOpacity testID="register-submit-button" style={styles.primaryBtn} onPress={onSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.primaryFg} /> : <Text style={styles.primaryBtnText}>Create account</Text>}
          </TouchableOpacity>

          <TouchableOpacity testID="goto-login-button" style={styles.secondaryLink} onPress={() => router.replace('/login')}>
            <Text style={styles.secondaryLinkText}>Already have an account? <Text style={{ color: colors.accent, fontWeight: '700' }}>Log in</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: 24, paddingTop: 16, flexGrow: 1 },
  title: { fontSize: 28, fontWeight: '800', color: colors.primary, marginBottom: 6 },
  subtitle: { fontSize: 15, color: colors.muted, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.primary, marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.primary, marginBottom: 14, minHeight: 48,
  },
  roleRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  roleCard: {
    flex: 1, padding: 16, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16,
    backgroundColor: colors.surface, alignItems: 'flex-start', minHeight: 100,
  },
  roleCardActive: { borderColor: colors.accent, backgroundColor: '#FFFBEB' },
  roleTitle: { fontWeight: '700', fontSize: 16, color: colors.primary, marginTop: 8 },
  roleDesc: { fontSize: 13, color: colors.muted, marginTop: 2 },
  primaryBtn: {
    backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 16, alignItems: 'center',
    justifyContent: 'center', marginTop: 8, minHeight: 52,
  },
  primaryBtnText: { color: colors.primaryFg, fontSize: 16, fontWeight: '700' },
  secondaryLink: { alignItems: 'center', paddingVertical: 16 },
  secondaryLinkText: { color: colors.muted, fontSize: 15 },
});

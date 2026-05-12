import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth';
import { colors } from '../../src/api';
import { LogOut, User as UserIcon, Mail, Phone, BadgeCheck, Briefcase, Shield, ChevronRight, LogIn, UserPlus } from 'lucide-react-native';

export default function Profile() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Log out?', 'You will need to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: async () => { await signOut(); } },
    ]);
  };

  // ---------- Guest view ----------
  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.container} testID="guest-profile-scroll">
          <Text style={styles.title}>Profile</Text>

          <View style={styles.guestHero}>
            <View style={styles.guestIcon}><UserIcon color={colors.accent} size={36} /></View>
            <Text style={styles.guestTitle}>Browsing as a guest</Text>
            <Text style={styles.guestSub}>Sign in to book services, leave reviews, and track your bookings.</Text>

            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/login')} testID="guest-login-button">
              <LogIn color={colors.primaryFg} size={18} />
              <Text style={styles.primaryBtnText}>Log in</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/register')} testID="guest-signup-button">
              <UserPlus color={colors.primary} size={18} />
              <Text style={styles.secondaryBtnText}>Create account</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>MonConnect v1.0 · Built with care for your neighbourhood</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---------- Logged-in view ----------
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} testID="profile-scroll">
        <Text style={styles.title}>Profile</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <UserIcon color={colors.accent} size={32} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{user.name}</Text>
              {user.is_verified && <BadgeCheck color={colors.success} size={18} />}
            </View>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{user.role.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Mail color={colors.muted} size={18} />
            <Text style={styles.infoText}>{user.email}</Text>
          </View>
          {user.phone ? (
            <View style={styles.infoRow}>
              <Phone color={colors.muted} size={18} />
              <Text style={styles.infoText}>{user.phone}</Text>
            </View>
          ) : null}
        </View>

        {user.role === 'provider' && (
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/provider-dashboard')} testID="goto-provider-dashboard">
            <View style={styles.menuIcon}><Briefcase color={colors.accent} size={20} /></View>
            <Text style={styles.menuText}>Provider Dashboard</Text>
            <ChevronRight color={colors.muted} size={20} />
          </TouchableOpacity>
        )}

        {user.role === 'admin' && (
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/admin')} testID="goto-admin">
            <View style={styles.menuIcon}><Shield color={colors.accent} size={20} /></View>
            <Text style={styles.menuText}>Admin Panel</Text>
            <ChevronRight color={colors.muted} size={20} />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.menuItem, { borderColor: '#FEE2E2' }]} onPress={handleLogout} testID="logout-button">
          <View style={[styles.menuIcon, { backgroundColor: '#FEE2E2' }]}><LogOut color={colors.danger} size={20} /></View>
          <Text style={[styles.menuText, { color: colors.danger }]}>Log out</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>MonConnect v1.0 · Built with care for your neighbourhood</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: colors.primary, marginBottom: 16 },
  guestHero: {
    backgroundColor: colors.surface, borderRadius: 20, padding: 24, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, marginTop: 20,
  },
  guestIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  guestTitle: { fontSize: 20, fontWeight: '800', color: colors.primary, marginBottom: 6 },
  guestSub: { fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 14, width: '100%', minHeight: 52,
  },
  primaryBtnText: { color: colors.primaryFg, fontWeight: '700', fontSize: 16 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: 999, paddingVertical: 14, marginTop: 10, width: '100%', minHeight: 52,
  },
  secondaryBtnText: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.surface,
    borderRadius: 16, padding: 18, borderWidth: 1, borderColor: colors.border, marginBottom: 16,
  },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 18, fontWeight: '800', color: colors.primary },
  roleBadge: { backgroundColor: '#FEF3C7', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginTop: 4 },
  roleText: { fontSize: 10, fontWeight: '700', color: '#92400E', letterSpacing: 0.5 },
  infoCard: {
    backgroundColor: colors.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.border, marginBottom: 24, gap: 12,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoText: { fontSize: 15, color: colors.primary },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface,
    borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10, minHeight: 56,
  },
  menuIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  menuText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.primary },
  footer: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: 32 },
});

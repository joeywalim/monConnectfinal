import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, colors } from '../../src/api';
import { useAuth } from '../../src/auth';
import { LogOut, Users, ShieldCheck, Calendar, ListChecks, BadgeCheck, Star } from 'lucide-react-native';

type Tab = 'overview' | 'providers' | 'bookings';

export default function AdminPanel() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<any>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, p, b] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/providers'),
        api.get('/admin/bookings'),
      ]);
      setStats(s.data); setProviders(p.data); setBookings(b.data);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Access denied');
      if (e?.response?.status === 403) { await signOut(); router.replace('/login'); }
    } finally { setLoading(false); setRefreshing(false); }
  }, [router, signOut]);

  useEffect(() => { load(); }, [load]);

  const verify = async (id: string, current: boolean) => {
    try {
      await api.patch(`/admin/providers/${id}/verify?verify=${!current}`);
      load();
    } catch (e: any) { Alert.alert('Error', e?.response?.data?.detail || 'Failed'); }
  };

  const logout = () => {
    Alert.alert('Log out?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/login'); } },
    ]);
  };

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator style={{ marginTop: 80 }} color={colors.primary} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topLabel}>Admin Panel</Text>
          <Text style={styles.topName}>{user?.name}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn} testID="admin-logout">
          <LogOut color={colors.danger} size={18} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabsRow}>
        {(['overview', 'providers', 'bookings'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
            testID={`admin-tab-${t}`}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t[0].toUpperCase() + t.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        testID="admin-scroll"
      >
        {tab === 'overview' && stats && (
          <>
            <View style={styles.statGrid}>
              <View style={styles.statCard}><Users color={colors.accent} size={20} /><Text style={styles.statNum}>{stats.users}</Text><Text style={styles.statLabel}>Total users</Text></View>
              <View style={styles.statCard}><Users color={colors.primary} size={20} /><Text style={styles.statNum}>{stats.customers}</Text><Text style={styles.statLabel}>Customers</Text></View>
              <View style={styles.statCard}><ShieldCheck color={colors.success} size={20} /><Text style={styles.statNum}>{stats.providers}</Text><Text style={styles.statLabel}>Providers</Text></View>
              <View style={styles.statCard}><BadgeCheck color={colors.success} size={20} /><Text style={styles.statNum}>{stats.verified_providers}</Text><Text style={styles.statLabel}>Verified</Text></View>
              <View style={styles.statCard}><Calendar color={colors.accent} size={20} /><Text style={styles.statNum}>{stats.bookings}</Text><Text style={styles.statLabel}>Bookings</Text></View>
              <View style={styles.statCard}><ListChecks color={colors.success} size={20} /><Text style={styles.statNum}>{stats.completed_bookings}</Text><Text style={styles.statLabel}>Completed</Text></View>
              <View style={styles.statCard}><Star color={colors.accent} size={20} /><Text style={styles.statNum}>{stats.reviews}</Text><Text style={styles.statLabel}>Reviews</Text></View>
            </View>
          </>
        )}

        {tab === 'providers' && providers.map((p) => (
          <View key={p.id} style={styles.card} testID={`admin-provider-${p.id}`}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.cardTitle}>{p.name}</Text>
                {p.is_verified && <BadgeCheck color={colors.success} size={14} />}
              </View>
              <Text style={styles.cardSub}>{p.city || 'No city'} · {p.services.length} services · ⭐ {(p.rating_avg || 0).toFixed(1)}</Text>
            </View>
            <TouchableOpacity
              style={[styles.verifyBtn, p.is_verified && styles.unverifyBtn]}
              onPress={() => verify(p.id, p.is_verified)}
              testID={`verify-${p.id}`}
            >
              <Text style={[styles.verifyBtnText, p.is_verified && { color: colors.danger }]}>{p.is_verified ? 'Unverify' : 'Verify'}</Text>
            </TouchableOpacity>
          </View>
        ))}

        {tab === 'bookings' && bookings.map((b) => (
          <View key={b.id} style={styles.card} testID={`admin-booking-${b.id}`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{b.service_title}</Text>
              <Text style={styles.cardSub}>{b.customer_name} → {b.provider_name}</Text>
              <Text style={styles.cardSub}>₹{b.price} · {b.status} · {b.payment_status}</Text>
            </View>
          </View>
        ))}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.primary },
  topLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  topName: { color: colors.primaryFg, fontSize: 18, fontWeight: '800', marginTop: 2 },
  logoutBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' },
  tabsRow: { flexDirection: 'row', backgroundColor: colors.surface, marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: colors.border },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: colors.primaryFg },
  content: { padding: 16, paddingBottom: 32 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '48%', backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border },
  statNum: { fontSize: 22, fontWeight: '800', color: colors.primary, marginTop: 6 },
  statLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.primary },
  cardSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  verifyBtn: { backgroundColor: colors.success, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, minHeight: 40 },
  unverifyBtn: { backgroundColor: '#FEE2E2' },
  verifyBtnText: { color: colors.primaryFg, fontWeight: '700', fontSize: 13 },
});

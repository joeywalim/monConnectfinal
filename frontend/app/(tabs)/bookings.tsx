import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, colors } from '../../src/api';
import { useAuth } from '../../src/auth';
import { Calendar, MapPin, Clock, Star, IndianRupee } from 'lucide-react-native';

interface Booking {
  id: string; customer_id: string; customer_name: string; provider_id: string; provider_name: string;
  service_title: string; price: number; status: string; payment_mode: string; payment_status: string;
  scheduled_at: string; address: string; created_at: string;
}

const STATUS_LABELS: Record<string, { text: string; color: string; bg: string }> = {
  pending: { text: 'Pending', color: '#92400E', bg: '#FEF3C7' },
  confirmed: { text: 'Confirmed', color: '#065F46', bg: '#D1FAE5' },
  in_progress: { text: 'In Progress', color: '#1E40AF', bg: '#DBEAFE' },
  completed: { text: 'Completed', color: '#065F46', bg: '#D1FAE5' },
  cancelled: { text: 'Cancelled', color: '#991B1B', bg: '#FEE2E2' },
  rejected: { text: 'Rejected', color: '#991B1B', bg: '#FEE2E2' },
};

export default function Bookings() {
  const router = useRouter();
  const { user } = useAuth();
  const [list, setList] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/bookings/mine');
      setList(r.data);
    } catch { /* ignore */ } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onCancel = async (id: string) => {
    Alert.alert('Cancel booking?', 'This action cannot be undone.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel', style: 'destructive', onPress: async () => {
          try { await api.patch(`/bookings/${id}/status`, { status: 'cancelled' }); load(); }
          catch (e: any) { Alert.alert('Error', e?.response?.data?.detail || 'Failed'); }
        }
      },
    ]);
  };

  const submitReview = async (bookingId: string, rating: number) => {
    try {
      await api.post('/reviews', { booking_id: bookingId, rating, comment: '' });
      Alert.alert('Thanks!', 'Review submitted successfully');
      setReviewingId(null);
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to submit review');
    }
  };

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator style={{ marginTop: 80 }} color={colors.primary} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>My bookings</Text>
        <Text style={styles.subtitle}>{user?.role === 'provider' ? 'Incoming jobs' : 'Your service requests'}</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        testID="bookings-scroll"
      >
        {list.length === 0 ? (
          <View style={styles.empty}>
            <Calendar color={colors.muted} size={40} />
            <Text style={styles.emptyTitle}>No bookings yet</Text>
            <Text style={styles.emptySub}>{user?.role === 'provider' ? 'New jobs will appear here.' : 'Book your first service to get started.'}</Text>
            {user?.role === 'customer' && (
              <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(tabs)')}>
                <Text style={styles.primaryBtnText}>Browse services</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          list.map((b) => {
            const sl = STATUS_LABELS[b.status] || STATUS_LABELS.pending;
            const scheduled = new Date(b.scheduled_at);
            return (
              <View key={b.id} style={styles.card} testID={`booking-${b.id}`}>
                <View style={styles.cardHead}>
                  <Text style={styles.serviceTitle}>{b.service_title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: sl.bg }]}>
                    <Text style={[styles.statusText, { color: sl.color }]}>{sl.text}</Text>
                  </View>
                </View>
                <Text style={styles.partyName}>
                  {user?.role === 'customer' ? `Provider: ${b.provider_name}` : `Customer: ${b.customer_name}`}
                </Text>
                <View style={styles.metaRow}>
                  <Clock color={colors.muted} size={14} />
                  <Text style={styles.metaText}>{scheduled.toLocaleString()}</Text>
                </View>
                <View style={styles.metaRow}>
                  <MapPin color={colors.muted} size={14} />
                  <Text style={styles.metaText} numberOfLines={2}>{b.address}</Text>
                </View>
                <View style={styles.metaRow}>
                  <IndianRupee color={colors.muted} size={14} />
                  <Text style={styles.metaText}>₹{b.price} · {b.payment_mode === 'cod' ? 'Cash on service' : 'Online'} · {b.payment_status}</Text>
                </View>

                {/* Customer actions */}
                {user?.role === 'customer' && b.status === 'pending' && (
                  <TouchableOpacity style={styles.dangerBtn} onPress={() => onCancel(b.id)} testID={`cancel-${b.id}`}>
                    <Text style={styles.dangerBtnText}>Cancel booking</Text>
                  </TouchableOpacity>
                )}
                {user?.role === 'customer' && b.status === 'completed' && (
                  reviewingId === b.id ? (
                    <View style={styles.starRow}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <TouchableOpacity key={n} onPress={() => submitReview(b.id, n)} testID={`rate-${b.id}-${n}`}>
                          <Star color={colors.accent} size={32} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.primaryBtn} onPress={() => setReviewingId(b.id)} testID={`review-${b.id}`}>
                      <Text style={styles.primaryBtnText}>Rate & review</Text>
                    </TouchableOpacity>
                  )
                )}

                {/* Provider actions */}
                {user?.role === 'provider' && b.status === 'pending' && (
                  <View style={styles.btnRow}>
                    <TouchableOpacity
                      style={styles.dangerBtn}
                      testID={`reject-${b.id}`}
                      onPress={async () => {
                        try { await api.patch(`/bookings/${b.id}/status`, { status: 'rejected' }); load(); } catch { }
                      }}
                    >
                      <Text style={styles.dangerBtnText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      testID={`accept-${b.id}`}
                      onPress={async () => {
                        try { await api.patch(`/bookings/${b.id}/status`, { status: 'confirmed' }); load(); } catch { }
                      }}
                    >
                      <Text style={styles.primaryBtnText}>Accept</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {user?.role === 'provider' && b.status === 'confirmed' && (
                  <TouchableOpacity
                    style={styles.primaryBtn} testID={`start-${b.id}`}
                    onPress={async () => { try { await api.patch(`/bookings/${b.id}/status`, { status: 'in_progress' }); load(); } catch { } }}
                  >
                    <Text style={styles.primaryBtnText}>Start job</Text>
                  </TouchableOpacity>
                )}
                {user?.role === 'provider' && b.status === 'in_progress' && (
                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: colors.success }]} testID={`complete-${b.id}`}
                    onPress={async () => { try { await api.patch(`/bookings/${b.id}/status`, { status: 'completed' }); load(); } catch { } }}
                  >
                    <Text style={styles.primaryBtnText}>Mark complete</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: colors.primary },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 2 },
  list: { paddingHorizontal: 20, paddingTop: 12 },
  card: {
    backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  serviceTitle: { fontSize: 16, fontWeight: '700', color: colors.primary, flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: '700' },
  partyName: { fontSize: 13, color: colors.muted, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaText: { fontSize: 13, color: colors.primary, flexShrink: 1 },
  primaryBtn: {
    backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 12, alignItems: 'center',
    marginTop: 12, minHeight: 44, flex: 1, justifyContent: 'center',
  },
  primaryBtnText: { color: colors.primaryFg, fontWeight: '700', fontSize: 14 },
  dangerBtn: {
    backgroundColor: '#FEE2E2', borderRadius: 999, paddingVertical: 12, alignItems: 'center',
    marginTop: 12, minHeight: 44, flex: 1, justifyContent: 'center',
  },
  dangerBtnText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
  btnRow: { flexDirection: 'row', gap: 10 },
  starRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 14 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.primary, marginTop: 16 },
  emptySub: { fontSize: 14, color: colors.muted, marginTop: 6, textAlign: 'center', paddingHorizontal: 40 },
});

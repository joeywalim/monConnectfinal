import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, colors } from '../../src/api';
import { useAuth } from '../../src/auth';
import { Star, BadgeCheck, MapPin, ArrowLeft, Phone, Calendar } from 'lucide-react-native';

interface Service { id: string; title: string; description: string; price: number; }
interface Provider {
  id: string; name: string; city: string; bio: string; photo_url: string; phone: string;
  rating_avg: number; rating_count: number; is_verified: boolean; services: Service[];
}
interface Review { id: string; customer_name: string; rating: number; comment: string; created_at: string; }

export default function ProviderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.get(`/providers/${id}`), api.get(`/reviews/provider/${id}`)])
      .then(([p, r]) => { setProvider(p.data); setReviews(r.data); })
      .catch(() => Alert.alert('Error', 'Failed to load provider'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !provider) {
    return <SafeAreaView style={styles.safe}><ActivityIndicator style={{ marginTop: 80 }} color={colors.primary} /></SafeAreaView>;
  }

  const onBook = (serviceId: string) => {
    if (!user) {
      Alert.alert('Log in to book', 'Please log in or create an account to book this service.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log in', onPress: () => router.push('/login') },
      ]);
      return;
    }
    if (user.role !== 'customer') { Alert.alert('Customer only', 'Only customers can book services.'); return; }
    router.push({ pathname: `/book/${provider.id}`, params: { service_id: serviceId } });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="back-button">
          <ArrowLeft color={colors.primary} size={22} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Provider</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} testID="provider-detail-scroll">
        <Image
          source={{ uri: provider.photo_url || 'https://images.unsplash.com/photo-1665242043190-0ef29390d289?w=600' }}
          style={styles.cover}
        />
        <View style={styles.headerCard}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{provider.name}</Text>
            {provider.is_verified && <BadgeCheck color={colors.success} size={20} />}
          </View>
          <View style={styles.metaRow}>
            <Star color={colors.accent} size={16} fill={colors.accent} />
            <Text style={styles.metaText}>{provider.rating_avg.toFixed(1)} ({provider.rating_count} reviews)</Text>
            {provider.city ? (
              <>
                <Text style={styles.metaDot}>·</Text>
                <MapPin color={colors.muted} size={14} />
                <Text style={styles.metaText}>{provider.city}</Text>
              </>
            ) : null}
          </View>
          {!!provider.bio && <Text style={styles.bio}>{provider.bio}</Text>}
          {!!provider.phone && (
            <View style={styles.phoneRow}>
              <Phone color={colors.muted} size={14} />
              <Text style={styles.phoneText}>{provider.phone}</Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Services</Text>
        {provider.services.length === 0 ? (
          <Text style={styles.emptyText}>No services listed yet.</Text>
        ) : provider.services.map((s) => (
          <View key={s.id} style={styles.serviceCard} testID={`service-${s.id}`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.serviceTitle}>{s.title}</Text>
              <Text style={styles.serviceDesc} numberOfLines={2}>{s.description}</Text>
              <Text style={styles.servicePrice}>₹{s.price}</Text>
            </View>
            <TouchableOpacity style={styles.bookBtn} onPress={() => onBook(s.id)} testID={`book-${s.id}`}>
              <Calendar color={colors.primaryFg} size={16} />
              <Text style={styles.bookBtnText}>Book</Text>
            </TouchableOpacity>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Reviews</Text>
        {reviews.length === 0 ? (
          <Text style={styles.emptyText}>No reviews yet. Be the first to review!</Text>
        ) : reviews.map((r) => (
          <View key={r.id} style={styles.reviewCard}>
            <View style={styles.reviewHead}>
              <Text style={styles.reviewer}>{r.customer_name}</Text>
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} size={12} color={colors.accent} fill={n <= r.rating ? colors.accent : 'transparent'} />
                ))}
              </View>
            </View>
            {!!r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
          </View>
        ))}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  topTitle: { fontSize: 16, fontWeight: '700', color: colors.primary },
  scroll: { paddingBottom: 24 },
  cover: { width: '100%', height: 200, backgroundColor: colors.secondary },
  headerCard: { backgroundColor: colors.surface, marginHorizontal: 16, marginTop: -28, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 22, fontWeight: '800', color: colors.primary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  metaText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  metaDot: { color: colors.muted, marginHorizontal: 4 },
  bio: { fontSize: 14, color: colors.muted, marginTop: 10, lineHeight: 20 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  phoneText: { fontSize: 13, color: colors.muted },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.primary, marginHorizontal: 20, marginTop: 24, marginBottom: 10 },
  emptyText: { fontSize: 14, color: colors.muted, marginHorizontal: 20 },
  serviceCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, marginHorizontal: 16,
    padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 10, gap: 12,
  },
  serviceTitle: { fontSize: 15, fontWeight: '700', color: colors.primary },
  serviceDesc: { fontSize: 13, color: colors.muted, marginTop: 2 },
  servicePrice: { fontSize: 16, fontWeight: '800', color: colors.accent, marginTop: 6 },
  bookBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999, minHeight: 44,
  },
  bookBtnText: { color: colors.primaryFg, fontWeight: '700', fontSize: 14 },
  reviewCard: { backgroundColor: colors.surface, marginHorizontal: 16, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  reviewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewer: { fontWeight: '700', color: colors.primary },
  starRow: { flexDirection: 'row', gap: 2 },
  reviewComment: { fontSize: 13, color: colors.muted, marginTop: 6 },
});

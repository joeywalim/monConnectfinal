import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, ActivityIndicator,
  RefreshControl, Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, colors } from '../../src/api';
import { useAuth } from '../../src/auth';
import * as Icons from 'lucide-react-native';
import { Star, BadgeCheck, ChevronRight } from 'lucide-react-native';

interface Category { id: string; name: string; icon: string; order: number; }
interface Provider {
  id: string; name: string; city: string; bio: string; photo_url: string;
  primary_category_id?: string; rating_avg: number; rating_count: number;
  is_verified: boolean; services: any[];
}

const { width } = Dimensions.get('window');

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [cats, setCats] = useState<Category[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([api.get('/categories'), api.get('/providers')]);
      setCats(c.data);
      setProviders(p.data);
    } catch (e) { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator style={{ marginTop: 80 }} color={colors.primary} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        testID="home-scroll"
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hi {user?.name?.split(' ')[0] || 'there'} 👋</Text>
            <Text style={styles.title}>What do you need today?</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.searchBar} onPress={() => router.push('/(tabs)/search')} testID="home-search-bar">
          <Icons.Search color={colors.muted} size={20} />
          <Text style={styles.searchPlaceholder}>Search electrician, plumber, tutor…</Text>
        </TouchableOpacity>

        <View style={styles.heroCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroSubtitle}>Trusted by your neighbours</Text>
            <Text style={styles.heroTitle}>Verified pros, fair prices.</Text>
            <View style={styles.heroBadge}>
              <BadgeCheck color={colors.success} size={14} />
              <Text style={styles.heroBadgeText}>ID verified providers</Text>
            </View>
          </View>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1646640381839-02748ae8ddf0?w=400' }}
            style={styles.heroImg}
          />
        </View>

        <Text style={styles.sectionTitle}>Browse categories</Text>
        <View style={styles.catGrid}>
          {cats.map((c) => {
            const Icon = (Icons as any)[c.icon] || Icons.Wrench;
            return (
              <TouchableOpacity
                key={c.id}
                style={styles.catCard}
                onPress={() => router.push({ pathname: '/(tabs)/search', params: { category_id: c.id, name: c.name } })}
                testID={`category-${c.name.toLowerCase().replace(/ /g, '-')}`}
              >
                <View style={styles.catIcon}><Icon color={colors.accent} size={26} /></View>
                <Text style={styles.catName}>{c.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Top rated near you</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/search')}>
            <Text style={styles.linkText}>See all</Text>
          </TouchableOpacity>
        </View>

        {providers.slice(0, 6).map((p) => (
          <TouchableOpacity
            key={p.id}
            style={styles.providerCard}
            onPress={() => router.push(`/provider/${p.id}`)}
            testID={`provider-card-${p.id}`}
          >
            <Image
              source={{ uri: p.photo_url || 'https://images.unsplash.com/photo-1665242043190-0ef29390d289?w=200' }}
              style={styles.providerAvatar}
            />
            <View style={{ flex: 1 }}>
              <View style={styles.providerNameRow}>
                <Text style={styles.providerName}>{p.name}</Text>
                {p.is_verified && <BadgeCheck color={colors.success} size={16} />}
              </View>
              <Text style={styles.providerBio} numberOfLines={2}>{p.bio}</Text>
              <View style={styles.providerMeta}>
                <Star color={colors.accent} size={14} fill={colors.accent} />
                <Text style={styles.metaText}>{(p.rating_avg || 0).toFixed(1)}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>{p.city || 'Local'}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>From ₹{p.services[0]?.price || 299}</Text>
              </View>
            </View>
            <ChevronRight color={colors.muted} size={20} />
          </TouchableOpacity>
        ))}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, paddingBottom: 32 },
  header: { marginBottom: 16 },
  greeting: { fontSize: 14, color: colors.muted, fontWeight: '500' },
  title: { fontSize: 26, fontWeight: '800', color: colors.primary, marginTop: 2, letterSpacing: -0.5 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 16,
    paddingVertical: 14, minHeight: 50, marginBottom: 20,
  },
  searchPlaceholder: { color: colors.muted, fontSize: 15 },
  heroCard: {
    flexDirection: 'row', backgroundColor: '#FFFBEB', borderRadius: 20, padding: 16,
    marginBottom: 24, borderWidth: 1, borderColor: '#FDE68A', alignItems: 'center', overflow: 'hidden',
  },
  heroSubtitle: { fontSize: 12, color: '#92400E', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroTitle: { fontSize: 18, fontWeight: '800', color: colors.primary, marginTop: 4 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  heroBadgeText: { fontSize: 11, color: colors.success, fontWeight: '600' },
  heroImg: { width: 90, height: 90, borderRadius: 16, marginLeft: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.primary, marginBottom: 12, marginTop: 4 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 12 },
  linkText: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 8 },
  catCard: {
    width: (width - 64) / 4, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16,
    paddingVertical: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border, minHeight: 90,
  },
  catIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  catName: { fontSize: 11, color: colors.primary, fontWeight: '600', textAlign: 'center' },
  providerCard: {
    flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 16, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', gap: 12,
  },
  providerAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.secondary },
  providerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  providerName: { fontSize: 16, fontWeight: '700', color: colors.primary },
  providerBio: { fontSize: 13, color: colors.muted, marginTop: 2 },
  providerMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  metaText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  metaDot: { color: colors.muted, marginHorizontal: 2 },
});

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, TextInput, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, colors } from '../../src/api';
import { Search as SearchIcon, Star, BadgeCheck, X } from 'lucide-react-native';

interface Provider {
  id: string; name: string; city: string; bio: string; photo_url: string;
  primary_category_id?: string; rating_avg: number; rating_count: number;
  is_verified: boolean; services: any[];
}
interface Category { id: string; name: string; icon: string; }

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category_id?: string; name?: string }>();
  const [q, setQ] = useState('');
  const [selectedCat, setSelectedCat] = useState<string | undefined>(params.category_id as string | undefined);
  const [cats, setCats] = useState<Category[]>([]);
  const [list, setList] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/categories').then((r) => setCats(r.data)).catch(() => {});
  }, []);

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/providers', { params: { category_id: selectedCat, q: q || undefined } });
      setList(r.data);
    } finally { setLoading(false); }
  }, [q, selectedCat]);

  useEffect(() => { search(); }, [search]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Find services</Text>

        <View style={styles.searchBar}>
          <SearchIcon color={colors.muted} size={20} />
          <TextInput
            testID="search-input"
            style={styles.searchInput}
            placeholder="Search by name, skill, area…"
            placeholderTextColor={colors.muted}
            value={q}
            onChangeText={setQ}
            returnKeyType="search"
            onSubmitEditing={search}
          />
          {q.length > 0 && (
            <TouchableOpacity onPress={() => setQ('')}><X color={colors.muted} size={18} /></TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.chip, !selectedCat && styles.chipActive]}
            onPress={() => setSelectedCat(undefined)}
            testID="chip-all"
          >
            <Text style={[styles.chipText, !selectedCat && styles.chipTextActive]}>All</Text>
          </TouchableOpacity>
          {cats.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.chip, selectedCat === c.id && styles.chipActive]}
              onPress={() => setSelectedCat(c.id)}
              testID={`chip-${c.name.toLowerCase().replace(/ /g, '-')}`}
            >
              <Text style={[styles.chipText, selectedCat === c.id && styles.chipTextActive]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.list} testID="search-results">
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : list.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No providers found</Text>
            <Text style={styles.emptySub}>Try a different category or search term.</Text>
          </View>
        ) : (
          list.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.card}
              onPress={() => router.push(`/provider/${p.id}`)}
              testID={`result-${p.id}`}
            >
              <Image
                source={{ uri: p.photo_url || 'https://images.unsplash.com/photo-1665242043190-0ef29390d289?w=200' }}
                style={styles.avatar}
              />
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{p.name}</Text>
                  {p.is_verified && <BadgeCheck color={colors.success} size={16} />}
                </View>
                <Text style={styles.bio} numberOfLines={2}>{p.bio}</Text>
                <View style={styles.meta}>
                  <Star color={colors.accent} size={13} fill={colors.accent} />
                  <Text style={styles.metaText}>{(p.rating_avg || 0).toFixed(1)} ({p.rating_count})</Text>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.metaText}>From ₹{p.services[0]?.price || 299}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '800', color: colors.primary, marginBottom: 12 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 14,
    paddingVertical: 10, minHeight: 48,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.primary, paddingVertical: 4 },
  chipRow: { marginTop: 12, marginHorizontal: -20, paddingHorizontal: 20 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, marginRight: 8, minHeight: 36, justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: colors.primaryFg },
  list: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 },
  card: {
    flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 16, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', gap: 12,
  },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.secondary },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontSize: 16, fontWeight: '700', color: colors.primary },
  bio: { fontSize: 13, color: colors.muted, marginTop: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  metaText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  metaDot: { color: colors.muted, marginHorizontal: 2 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.primary },
  emptySub: { fontSize: 14, color: colors.muted, marginTop: 6 },
});

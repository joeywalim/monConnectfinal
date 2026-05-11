import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  TextInput, Modal, Alert, RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, colors } from '../../src/api';
import { useAuth } from '../../src/auth';
import { Plus, Trash2, LogOut, IndianRupee, Calendar, ListChecks, BadgeCheck } from 'lucide-react-native';

interface Category { id: string; name: string; }
interface Service { id: string; title: string; description: string; price: number; category_id: string; }

export default function ProviderDashboard() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newSvc, setNewSvc] = useState({ title: '', description: '', price: '', category_id: '' });
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');

  const load = useCallback(async () => {
    try {
      const [p, c, b] = await Promise.all([
        api.get('/providers/me/profile'),
        api.get('/categories'),
        api.get('/bookings/mine'),
      ]);
      setProfile(p.data); setCats(c.data); setBookings(b.data);
      setBio(p.data.bio || ''); setCity(p.data.city || '');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to load');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addService = async () => {
    if (!newSvc.title || !newSvc.description || !newSvc.price || !newSvc.category_id) {
      Alert.alert('Missing', 'Please fill all fields'); return;
    }
    try {
      await api.post('/providers/me/services', {
        title: newSvc.title, description: newSvc.description,
        price: parseFloat(newSvc.price), category_id: newSvc.category_id,
      });
      setNewSvc({ title: '', description: '', price: '', category_id: '' });
      setModalOpen(false); load();
    } catch (e: any) { Alert.alert('Error', e?.response?.data?.detail || 'Failed'); }
  };

  const deleteService = (id: string) => {
    Alert.alert('Delete service?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete(`/providers/me/services/${id}`); load(); }
        catch (e: any) { Alert.alert('Error', e?.response?.data?.detail || 'Failed'); }
      }},
    ]);
  };

  const saveProfile = async () => {
    try {
      await api.put('/providers/me/profile', { bio, city, primary_category_id: profile?.primary_category_id });
      setEditProfileOpen(false); load();
    } catch (e: any) { Alert.alert('Error', e?.response?.data?.detail || 'Failed'); }
  };

  const logout = () => {
    Alert.alert('Log out?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/login'); } },
    ]);
  };

  if (loading || !profile) return <SafeAreaView style={styles.safe}><ActivityIndicator style={{ marginTop: 80 }} color={colors.primary} /></SafeAreaView>;

  const pendingCount = bookings.filter(b => b.status === 'pending').length;
  const completedCount = bookings.filter(b => b.status === 'completed').length;
  const earnings = bookings.filter(b => b.status === 'completed').reduce((s, b) => s + (b.price || 0), 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topLabel}>Provider Dashboard</Text>
          <Text style={styles.topName}>{user?.name}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn} testID="logout-button">
          <LogOut color={colors.danger} size={18} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        testID="provider-dashboard-scroll"
      >
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Calendar color={colors.accent} size={20} />
            <Text style={styles.statNum}>{pendingCount}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <ListChecks color={colors.success} size={20} />
            <Text style={styles.statNum}>{completedCount}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <IndianRupee color={colors.primary} size={20} />
            <Text style={styles.statNum}>₹{earnings}</Text>
            <Text style={styles.statLabel}>Earnings</Text>
          </View>
        </View>

        <View style={styles.profileCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.profileName}>{profile.name}</Text>
            {profile.is_verified && <BadgeCheck color={colors.success} size={16} />}
          </View>
          <Text style={styles.profileMeta}>{profile.city || 'Set your city'} · ⭐ {(profile.rating_avg || 0).toFixed(1)} ({profile.rating_count})</Text>
          <Text style={styles.profileBio}>{profile.bio || 'Add a short bio to attract customers.'}</Text>
          <TouchableOpacity style={styles.editBtn} onPress={() => setEditProfileOpen(true)} testID="edit-profile-button">
            <Text style={styles.editBtnText}>Edit profile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Your services</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setModalOpen(true)} testID="add-service-button">
            <Plus color={colors.primaryFg} size={16} />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {(profile.services as Service[]).length === 0 ? (
          <Text style={styles.emptyText}>No services yet. Add your first service.</Text>
        ) : (profile.services as Service[]).map((s) => (
          <View key={s.id} style={styles.serviceCard} testID={`my-service-${s.id}`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.svcTitle}>{s.title}</Text>
              <Text style={styles.svcDesc} numberOfLines={2}>{s.description}</Text>
              <Text style={styles.svcPrice}>₹{s.price}</Text>
            </View>
            <TouchableOpacity onPress={() => deleteService(s.id)} style={styles.delBtn} testID={`delete-service-${s.id}`}>
              <Trash2 color={colors.danger} size={18} />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.bookingsLink} onPress={() => router.push('/(tabs)/bookings')} testID="goto-bookings">
          <Text style={styles.bookingsLinkText}>Manage incoming bookings →</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Add Service Modal */}
      <Modal visible={modalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add a service</Text>
            <TextInput
              testID="svc-title-input"
              style={styles.modalInput}
              placeholder="Service title"
              placeholderTextColor={colors.muted}
              value={newSvc.title}
              onChangeText={(t) => setNewSvc({ ...newSvc, title: t })}
            />
            <TextInput
              testID="svc-desc-input"
              style={[styles.modalInput, { minHeight: 70 }]}
              placeholder="Description"
              placeholderTextColor={colors.muted}
              value={newSvc.description}
              onChangeText={(t) => setNewSvc({ ...newSvc, description: t })}
              multiline
            />
            <TextInput
              testID="svc-price-input"
              style={styles.modalInput}
              placeholder="Price in ₹"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              value={newSvc.price}
              onChangeText={(t) => setNewSvc({ ...newSvc, price: t })}
            />
            <Text style={styles.modalLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {cats.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.catChip, newSvc.category_id === c.id && styles.catChipActive]}
                  onPress={() => setNewSvc({ ...newSvc, category_id: c.id })}
                  testID={`svc-cat-${c.id}`}
                >
                  <Text style={[styles.catChipText, newSvc.category_id === c.id && { color: colors.primaryFg }]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={addService} testID="save-service-button">
                <Text style={styles.saveBtnText}>Add service</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={editProfileOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit profile</Text>
            <Text style={styles.modalLabel}>City</Text>
            <TextInput style={styles.modalInput} value={city} onChangeText={setCity} placeholder="Your city" placeholderTextColor={colors.muted} testID="edit-city-input" />
            <Text style={styles.modalLabel}>Bio</Text>
            <TextInput style={[styles.modalInput, { minHeight: 80 }]} value={bio} onChangeText={setBio} placeholder="Tell customers about your skills..." placeholderTextColor={colors.muted} multiline testID="edit-bio-input" />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditProfileOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} testID="save-profile-button">
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.primary },
  topLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  topName: { color: colors.primaryFg, fontSize: 18, fontWeight: '800', marginTop: 2 },
  logoutBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 32 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'flex-start' },
  statNum: { fontSize: 22, fontWeight: '800', color: colors.primary, marginTop: 6 },
  statLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },
  profileCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 20 },
  profileName: { fontSize: 18, fontWeight: '800', color: colors.primary },
  profileMeta: { fontSize: 13, color: colors.muted, marginTop: 4 },
  profileBio: { fontSize: 14, color: colors.primary, marginTop: 10, lineHeight: 20 },
  editBtn: { alignSelf: 'flex-start', backgroundColor: '#FEF3C7', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, marginTop: 12 },
  editBtnText: { color: '#92400E', fontWeight: '700', fontSize: 13 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.primary },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  addBtnText: { color: colors.primaryFg, fontWeight: '700', fontSize: 13 },
  serviceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10, gap: 12 },
  svcTitle: { fontSize: 15, fontWeight: '700', color: colors.primary },
  svcDesc: { fontSize: 13, color: colors.muted, marginTop: 2 },
  svcPrice: { fontSize: 16, fontWeight: '800', color: colors.accent, marginTop: 6 },
  delBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: colors.muted, paddingVertical: 16 },
  bookingsLink: { backgroundColor: colors.primary, borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 12 },
  bookingsLinkText: { color: colors.primaryFg, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.primary, marginBottom: 16 },
  modalInput: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12, fontSize: 15, color: colors.primary, minHeight: 48 },
  modalLabel: { fontSize: 13, fontWeight: '600', color: colors.primary, marginBottom: 8 },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, marginRight: 8 },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 999, backgroundColor: colors.secondary, alignItems: 'center' },
  cancelBtnText: { color: colors.primary, fontWeight: '700' },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 999, backgroundColor: colors.primary, alignItems: 'center' },
  saveBtnText: { color: colors.primaryFg, fontWeight: '700' },
});

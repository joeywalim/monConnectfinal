import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Modal
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, colors } from '../../src/api';
import { ArrowLeft, Check, IndianRupee, MapPin } from 'lucide-react-native';

export default function BookFlow() {
  const { providerId, service_id } = useLocalSearchParams<{ providerId: string; service_id: string }>();
  const router = useRouter();
  const [provider, setProvider] = useState<any>(null);
  const [service, setService] = useState<any>(null);
  const [date, setDate] = useState<Date>(() => {
    const d = new Date(); d.setHours(d.getHours() + 24, 0, 0, 0); return d;
  });
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [payMode, setPayMode] = useState<'cod' | 'online'>('cod');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!providerId) return;
    api.get(`/providers/${providerId}`).then((r) => {
      setProvider(r.data);
      const s = r.data.services.find((x: any) => x.id === service_id);
      setService(s);
    }).catch(() => Alert.alert('Error', 'Failed to load'));
  }, [providerId, service_id]);

  const submit = async () => {
    if (!address.trim()) { Alert.alert('Address required', 'Please enter the service address.'); return; }
    setSubmitting(true);
    try {
      await api.post('/bookings', {
        provider_id: providerId,
        service_id,
        scheduled_at: date.toISOString(),
        address: address.trim(),
        notes: notes.trim(),
        payment_mode: payMode,
      });
      setSuccess(true);
    } catch (e: any) {
      Alert.alert('Booking failed', e?.response?.data?.detail || 'Try again');
    } finally { setSubmitting(false); }
  };

  if (!provider || !service) {
    return <SafeAreaView style={styles.safe}><ActivityIndicator style={{ marginTop: 80 }} color={colors.primary} /></SafeAreaView>;
  }

  // Time options: today+1 .. today+7 at hourly slots 9-18
  const dateOptions: Date[] = [];
  for (let d = 1; d <= 5; d++) {
    for (const h of [9, 11, 13, 15, 17]) {
      const dt = new Date(); dt.setDate(dt.getDate() + d); dt.setHours(h, 0, 0, 0);
      dateOptions.push(dt);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="back-button">
          <ArrowLeft color={colors.primary} size={22} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Confirm booking</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} testID="book-scroll" keyboardShouldPersistTaps="handled">
          <View style={styles.summary}>
            <Text style={styles.summaryLabel}>Service</Text>
            <Text style={styles.summaryTitle}>{service.title}</Text>
            <Text style={styles.summarySub}>with {provider.name}</Text>
            <View style={styles.priceRow}>
              <IndianRupee color={colors.accent} size={18} />
              <Text style={styles.priceText}>{service.price}</Text>
            </View>
          </View>

          <Text style={styles.label}>Pick date & time</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
            {dateOptions.map((d, i) => {
              const sel = d.getTime() === date.getTime();
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.slot, sel && styles.slotActive]}
                  onPress={() => setDate(d)}
                  testID={`slot-${i}`}
                >
                  <Text style={[styles.slotDay, sel && { color: colors.primaryFg }]}>
                    {d.toLocaleDateString(undefined, { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.slotDate, sel && { color: colors.primaryFg }]}>
                    {d.getDate()}/{d.getMonth() + 1}
                  </Text>
                  <Text style={[styles.slotTime, sel && { color: colors.primaryFg }]}>
                    {d.getHours()}:00
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.label}>Service address</Text>
          <View style={styles.inputWrap}>
            <MapPin color={colors.muted} size={18} />
            <TextInput
              testID="address-input"
              style={styles.input}
              placeholder="House no, Street, Area, Landmark"
              placeholderTextColor={colors.muted}
              value={address}
              onChangeText={setAddress}
              multiline
            />
          </View>

          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            testID="notes-input"
            style={[styles.input, styles.notesInput]}
            placeholder="Special instructions..."
            placeholderTextColor={colors.muted}
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          <Text style={styles.label}>Payment</Text>
          <View style={styles.payRow}>
            <TouchableOpacity
              style={[styles.payCard, payMode === 'cod' && styles.payCardActive]}
              onPress={() => setPayMode('cod')}
              testID="pay-cod"
            >
              <Text style={[styles.payTitle, payMode === 'cod' && { color: colors.primary }]}>Cash on service</Text>
              <Text style={styles.paySub}>Pay after work is done</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.payCard, payMode === 'online' && styles.payCardActive]}
              onPress={() => setPayMode('online')}
              testID="pay-online"
            >
              <Text style={[styles.payTitle, payMode === 'online' && { color: colors.primary }]}>Online (Razorpay)</Text>
              <Text style={styles.paySub}>UPI, cards, wallets</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.confirmBtn} onPress={submit} disabled={submitting} testID="confirm-booking">
            {submitting ? <ActivityIndicator color={colors.primaryFg} /> : <Text style={styles.confirmBtnText}>Confirm booking</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={success} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}><Check color={colors.success} size={36} /></View>
            <Text style={styles.modalTitle}>Booking confirmed!</Text>
            <Text style={styles.modalSub}>The provider will be notified. Track status in My Bookings.</Text>
            <TouchableOpacity
              style={styles.modalBtn}
              onPress={() => { setSuccess(false); router.replace('/(tabs)/bookings'); }}
              testID="modal-ok"
            >
              <Text style={styles.modalBtnText}>View bookings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  topTitle: { fontSize: 16, fontWeight: '700', color: colors.primary },
  content: { padding: 20, paddingBottom: 32 },
  summary: { backgroundColor: '#FFFBEB', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#FDE68A', marginBottom: 20 },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: '#92400E', letterSpacing: 0.5 },
  summaryTitle: { fontSize: 18, fontWeight: '800', color: colors.primary, marginTop: 4 },
  summarySub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  priceText: { fontSize: 22, fontWeight: '800', color: colors.accent },
  label: { fontSize: 14, fontWeight: '700', color: colors.primary, marginTop: 16, marginBottom: 10 },
  slot: {
    paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, marginRight: 8, alignItems: 'center', minWidth: 70,
  },
  slotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotDay: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  slotDate: { fontSize: 16, color: colors.primary, fontWeight: '800', marginTop: 2 },
  slotTime: { fontSize: 11, color: colors.muted, marginTop: 2 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56,
  },
  input: { flex: 1, fontSize: 15, color: colors.primary, paddingVertical: 0 },
  notesInput: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, minHeight: 70 },
  payRow: { flexDirection: 'row', gap: 10 },
  payCard: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  payCardActive: { borderColor: colors.accent, backgroundColor: '#FFFBEB' },
  payTitle: { fontWeight: '700', color: colors.primary, fontSize: 14 },
  paySub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  confirmBtn: { backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 16, alignItems: 'center', marginTop: 24, minHeight: 52 },
  confirmBtnText: { color: colors.primaryFg, fontWeight: '700', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 24, alignItems: 'center', width: '100%' },
  modalIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.primary, marginBottom: 6 },
  modalSub: { fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: 20 },
  modalBtn: { backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 14, paddingHorizontal: 24, width: '100%', alignItems: 'center' },
  modalBtnText: { color: colors.primaryFg, fontWeight: '700' },
});

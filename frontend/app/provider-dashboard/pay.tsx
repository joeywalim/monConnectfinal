import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, colors } from '../../src/api';
import { useAuth } from '../../src/auth';
import { CheckCircle2, CreditCard, IndianRupee, ShieldCheck, Sparkles, LogOut } from 'lucide-react-native';

interface Profile {
  id: string;
  name: string;
  is_paid: boolean;
  registration_fee?: number;
}

export default function RegistrationPay() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const load = async () => {
    try {
      const r = await api.get('/providers/me/profile');
      setProfile(r.data);
      if (r.data.is_paid) {
        // Already paid → go to dashboard
        router.replace('/provider-dashboard');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to load');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const fee = profile?.registration_fee || 199;

  const tryRazorpay = async () => {
    try {
      setPaying(true);
      const order = await api.post('/payments/registration-order');
      // If we're here on web with razorpay configured, open checkout
      if (Platform.OS === 'web' && (window as any).Razorpay) {
        const options = {
          key: order.data.key_id,
          amount: order.data.amount,
          currency: order.data.currency,
          name: 'MonConnect',
          description: 'Provider registration fee',
          order_id: order.data.order_id,
          handler: async (resp: any) => {
            try {
              await api.post('/payments/registration-verify', {
                booking_id: 'registration',
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
              });
              Alert.alert('Success', 'Payment received. Welcome to MonConnect!');
              router.replace('/provider-dashboard');
            } catch (e: any) {
              Alert.alert('Verification failed', e?.response?.data?.detail || 'Contact support');
            }
          },
          theme: { color: colors.accent },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        Alert.alert('Razorpay opened', 'Complete payment in the popup window.');
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail || 'Failed';
      // If razorpay is not configured, offer mock pay
      if (e?.response?.status === 503) {
        Alert.alert(
          'Razorpay not configured',
          'You can use test/mock pay to activate your account for now (admin can also mark you as paid).',
        );
      } else {
        Alert.alert('Payment error', detail);
      }
    } finally {
      setPaying(false);
    }
  };

  const tryMockPay = async () => {
    try {
      setPaying(true);
      await api.post('/payments/registration-mock-pay');
      Alert.alert('Success', 'Registration complete (test mode). You can now list your services.');
      router.replace('/provider-dashboard');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed');
    } finally { setPaying(false); }
  };

  const logout = async () => { await signOut(); router.replace('/login'); };

  if (loading || !profile) {
    return <SafeAreaView style={styles.safe}><ActivityIndicator style={{ marginTop: 80 }} color={colors.primary} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topLabel}>One last step</Text>
          <Text style={styles.topName}>Hi {user?.name?.split(' ')[0]} 👋</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn} testID="pay-logout-button">
          <LogOut color={colors.danger} size={18} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} testID="pay-scroll">
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}><ShieldCheck color={colors.accent} size={32} /></View>
          <Text style={styles.heroTitle}>Activate your provider account</Text>
          <Text style={styles.heroSub}>Pay a one-time registration fee to start receiving bookings on MonConnect.</Text>
        </View>

        <View style={styles.feeCard}>
          <Text style={styles.feeLabel}>One-time fee</Text>
          <View style={styles.feeRow}>
            <IndianRupee color={colors.primary} size={28} />
            <Text style={styles.feeAmount}>{fee}</Text>
          </View>
          <Text style={styles.feeNote}>Includes verification, listing on category pages, and unlimited bookings.</Text>

          <View style={styles.bulletRow}>
            <CheckCircle2 color={colors.success} size={18} />
            <Text style={styles.bulletText}>Visible to customers in your area</Text>
          </View>
          <View style={styles.bulletRow}>
            <CheckCircle2 color={colors.success} size={18} />
            <Text style={styles.bulletText}>Verified badge once approved by admin</Text>
          </View>
          <View style={styles.bulletRow}>
            <CheckCircle2 color={colors.success} size={18} />
            <Text style={styles.bulletText}>No commission for your first 10 jobs</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, paying && { opacity: 0.7 }]}
          onPress={tryRazorpay}
          disabled={paying}
          testID="pay-razorpay-button"
        >
          {paying ? <ActivityIndicator color={colors.primaryFg} /> : (
            <>
              <CreditCard color={colors.primaryFg} size={18} />
              <Text style={styles.primaryBtnText}>Pay ₹{fee} with Razorpay</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={tryMockPay}
          disabled={paying}
          testID="pay-mock-button"
        >
          <Sparkles color={colors.accent} size={18} />
          <Text style={styles.secondaryBtnText}>Use test pay (dev only)</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          Razorpay keys not yet configured? An admin can mark your account as paid from the Admin Panel.
        </Text>
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
  content: { padding: 20, paddingBottom: 40 },
  heroCard: {
    backgroundColor: '#FFFBEB', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#FDE68A',
    alignItems: 'flex-start', marginBottom: 16,
  },
  heroIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: colors.primary },
  heroSub: { fontSize: 14, color: colors.muted, marginTop: 6, lineHeight: 20 },
  feeCard: {
    backgroundColor: colors.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border,
    marginBottom: 20,
  },
  feeLabel: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  feeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 8 },
  feeAmount: { fontSize: 44, fontWeight: '800', color: colors.primary, marginLeft: -4 },
  feeNote: { fontSize: 13, color: colors.muted, marginBottom: 16, lineHeight: 18 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  bulletText: { fontSize: 14, color: colors.primary, flex: 1 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 16, minHeight: 56,
  },
  primaryBtnText: { color: colors.primaryFg, fontWeight: '700', fontSize: 16 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: 999, paddingVertical: 14, marginTop: 10, minHeight: 50,
  },
  secondaryBtnText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  footer: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 18, lineHeight: 16 },
});

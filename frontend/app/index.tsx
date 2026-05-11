import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/auth';
import { colors } from '../src/api';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    // General users (customers + guests) go straight to the home tabs.
    // Providers & admins land on their dashboards.
    if (user?.role === 'admin') router.replace('/admin');
    else if (user?.role === 'provider') router.replace('/provider-dashboard');
    else router.replace('/(tabs)');
  }, [user, loading]);

  return (
    <View style={styles.container} testID="splash-screen">
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});

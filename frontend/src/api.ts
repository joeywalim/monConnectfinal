import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 20000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('ts_token');
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

export const setAuthToken = async (token: string | null) => {
  if (token) await AsyncStorage.setItem('ts_token', token);
  else await AsyncStorage.removeItem('ts_token');
};

export const colors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  primary: '#0F172A',
  primaryFg: '#FFFFFF',
  secondary: '#E2E8F0',
  accent: '#D97706',
  accentFg: '#FFFFFF',
  success: '#059669',
  border: '#E2E8F0',
  muted: '#64748B',
  danger: '#DC2626',
};

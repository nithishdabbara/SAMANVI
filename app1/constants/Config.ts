import Constants from 'expo-constants';


// Explicitly configured backend URL from environment
const CONFIGURED_URL = process.env.EXPO_PUBLIC_API_URL || 
  (process.env.EXPO_PUBLIC_BACKEND_URL ? `${process.env.EXPO_PUBLIC_BACKEND_URL}/api` : null);

// In development, resolve Expo Metro bundler host IP
const METRO_HOST = Constants.expoConfig?.hostUri?.split(':')[0];
const isDev = typeof __DEV__ !== 'undefined' && Boolean(__DEV__);

// Resolve API base URL:
// 1. Explicit environment variable (always prioritized)
// 2. In dev mode: Metro bundler host IP (e.g., http://10.82.19.144:5000/api)
// 3. In dev mode fallback: localhost (for emulator / web)
// 4. In release mode without explicit URL: empty string (forces explicit configuration)
const rawBaseUrl = CONFIGURED_URL || (isDev ? (METRO_HOST ? `http://${METRO_HOST}:5000/api` : 'http://127.0.0.1:5000/api') : '');

export const API_BASE_URL = rawBaseUrl.replace(/\/$/, '');

export function requireApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error('Backend URL is not configured.');
  }
  return API_BASE_URL;
}


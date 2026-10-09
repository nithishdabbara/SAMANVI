// Simple analytics wrapper — proxies to your Flask /api endpoints when needed,
// no-op when POSTHOG_API_KEY is not configured server-side.

import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/Config';

export async function track(event: string, props: Record<string, any> = {}) {
  try {
    const token = await SecureStore.getItemAsync('userToken');
    await fetch(`${API_BASE_URL}/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ event, props }),
    }).catch(() => {});
  } catch {}
}

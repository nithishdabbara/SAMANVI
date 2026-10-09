// Samanvi realtime + push helpers — safe to import from any screen.

import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/Config';

// --- Server-Sent Events (realtime chat, offers, arrival, payment) ---
type SamanviEvent =
  | { type: 'chat_message'; payload: { from: string; text: string; time: string } }
  | { type: 'new_offer'; payload: any }
  | { type: 'offer_accepted'; payload: any }
  | { type: 'arrival_verified'; payload: { amount: number; offer_id: string } };

export function useSamanviEvents(onEvent: (ev: SamanviEvent) => void) {
  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;

    (async () => {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) return;
      const base = API_BASE_URL.replace(/\/api$/, '');
      const url = `${base}/api/events?token=${encodeURIComponent(token)}`;

      // EventSource exists on web natively. For React Native we polyfill using fetch streaming (best-effort).
      if (typeof (globalThis as any).EventSource !== 'undefined') {
        es = new (globalThis as any).EventSource(url);
        ['chat_message', 'new_offer', 'offer_accepted', 'arrival_verified'].forEach((t) => {
          (es as any).addEventListener(t, (e: any) => {
            try { onEvent({ type: t as any, payload: JSON.parse(e.data) }); } catch {}
          });
        });
      } else {
        // Simple long-poll fallback for native
        while (!cancelled) {
          try {
            const res = await fetch(url);
            const reader = (res as any).body?.getReader?.();
            if (!reader) { await new Promise((r) => setTimeout(r, 5000)); continue; }
            const decoder = new TextDecoder();
            let buf = '';
            while (!cancelled) {
              const { value, done } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });
              const chunks = buf.split('\n\n');
              buf = chunks.pop() || '';
              for (const chunk of chunks) {
                const evLine = chunk.split('\n').find((l) => l.startsWith('event:'));
                const dataLine = chunk.split('\n').find((l) => l.startsWith('data:'));
                if (!evLine || !dataLine) continue;
                const t = evLine.replace('event:', '').trim();
                const d = dataLine.replace('data:', '').trim();
                try { onEvent({ type: t as any, payload: JSON.parse(d) }); } catch {}
              }
            }
          } catch {
            await new Promise((r) => setTimeout(r, 5000));
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      if (es) es.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// --- Push token registration ---
export async function registerExpoPushToken() {
  try {
    // Lazy-imported so web builds don't crash if the module is absent
    const Notifications = await import('expo-notifications').catch(() => null as any);
    if (!Notifications) return null;
    const { status } = await Notifications.getPermissionsAsync();
    let final = status;
    if (final !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      final = req.status;
    }
    if (final !== 'granted') return null;
    const t = await Notifications.getExpoPushTokenAsync();
    const token = await SecureStore.getItemAsync('userToken');
    if (!token) return null;
    await fetch(`${API_BASE_URL}/push/register-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ expo_token: t.data, platform: Platform.OS }),
    });
    return t.data;
  } catch {
    return null;
  }
}

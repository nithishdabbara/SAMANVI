import { api, clearToken, getToken } from '../api/client';

export interface User {
  id: string;
  name: string;
  phone: string;
  area_name: string;
  trust_score: number;
  people_helped: number;
  requests_made: number;
  created_at: string;
  aadhaar_verified: boolean;
  location_locked: boolean;
  is_new_helper: boolean;
}

let listeners: (() => void)[] = [];
let state: { user: User | null; loading: boolean } = { user: null, loading: true };

function notify() {
  listeners.forEach((l) => l());
}

export function subscribe(cb: () => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

export function getSession() {
  return state;
}

export async function loadFromToken() {
  state = { ...state, loading: true };
  notify();
  const t = await getToken();
  if (!t) {
    state = { user: null, loading: false };
    notify();
    return;
  }
  try {
    const u = await api.get<User>('/me');
    state = { user: u, loading: false };
  } catch {
    await clearToken();
    state = { user: null, loading: false };
  }
  notify();
}

export function setUser(u: User) {
  state = { ...state, user: u, loading: false };
  notify();
}

export async function logout() {
  await clearToken();
  state = { user: null, loading: false };
  notify();
}

export async function refresh() {
  try {
    const u = await api.get<User>('/me');
    state = { ...state, user: u };
    notify();
  } catch {}
}

export { saveToken } from '../api/client';

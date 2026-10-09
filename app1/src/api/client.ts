import { storage } from '@/src/utils/storage';
import { requireApiBaseUrl } from '../../constants/Config';

export const TOKEN_KEY = 'samanvi_token';

export async function saveToken(token: string) {
  await storage.secureSet(TOKEN_KEY, token);
}
export async function getToken(): Promise<string | null> {
  const v = await storage.secureGet<string>(TOKEN_KEY, '');
  return v && typeof v === 'string' && v.length > 0 ? v : null;
}
export async function clearToken() {
  await storage.secureRemove(TOKEN_KEY);
}

export interface ApiError {
  message: string;
  status: number;
}

async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) || {}),
  };
  if (auth) {
    const t = await getToken();
    if (t) headers['Authorization'] = `Bearer ${t}`;
  }
  const base = requireApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const res = await fetch(`${base}${cleanPath}`, { ...init, headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { detail: text };
  }
  if (!res.ok) {
    const err: ApiError = {
      message: data?.detail || data?.message || `Request failed (${res.status})`,
      status: res.status,
    };
    throw err;
  }
  return data as T;
}

export const api = {
  get: <T>(p: string) => request<T>(p, { method: 'GET' }),
  post: <T>(p: string, body?: any) => request<T>(p, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  postNoAuth: <T>(p: string, body?: any) =>
    request<T>(p, { method: 'POST', body: JSON.stringify(body ?? {}) }, false),
};

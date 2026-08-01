import { supabase } from './supabase';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3400';
const CONFIGURED_API_KEY = process.env.NEXT_PUBLIC_PERIBOLOS_API_KEY;

export function isLocalDemoApi(): boolean {
  return false;
}

function resolveApiKey(): string | undefined {
  if (CONFIGURED_API_KEY) return CONFIGURED_API_KEY;
  if (typeof window === 'undefined') return undefined;
  return window.localStorage.getItem('peribolos.apiKey.v1') || undefined;
}

async function getSessionForRequest() {
  if (!supabase) return null;

  try {
    return await Promise.race([
      supabase.auth.getSession().then(({ data }) => data.session),
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1_500)),
    ]);
  } catch {
    return null;
  }
}

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const apiKey = resolveApiKey();
  const session = await getSessionForRequest();
  const bearer = session?.access_token || apiKey;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5_000);
  let res: Response;

  try {
    res = await fetch(url, {
      ...options,
      signal: options.signal ?? controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...options.headers,
      },
    });
  } finally {
    window.clearTimeout(timeout);
  }

  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined' && !session?.access_token) {
      window.dispatchEvent(new Event('peribolos-api-key-invalid'));
    }
    const errorBody = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(errorBody.message || `API error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

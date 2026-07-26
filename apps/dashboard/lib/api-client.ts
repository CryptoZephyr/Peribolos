export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3400';

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(errorBody.message || `API error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

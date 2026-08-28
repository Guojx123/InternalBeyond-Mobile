// 极简 API 客户端：开发期走 /api 代理（vite.config.ts），生产期走 VITE_API_URL。
const BASE = import.meta.env.VITE_API_URL || '';

export async function api<T = unknown>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('ib_token');
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '请求失败');
  }
  return res.json() as Promise<T>;
}

export const auth = {
  get token() {
    return localStorage.getItem('ib_token');
  },
  set(token: string) {
    localStorage.setItem('ib_token', token);
  },
  clear() {
    localStorage.removeItem('ib_token');
  },
};

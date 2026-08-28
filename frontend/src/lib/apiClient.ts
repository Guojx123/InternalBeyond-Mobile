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
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      '后端返回了非 JSON 响应（请确认 VITE_API_URL 已指向后端地址，而非前端静态站点）'
    );
  }
  if (!res.ok) {
    const err = (data as { error?: string }) || {};
    throw new Error(err.error || `请求失败 (${res.status})`);
  }
  return data as T;
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

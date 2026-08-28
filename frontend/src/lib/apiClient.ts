// 极简 API 客户端：开发期走 /api 代理（vite.config.ts），生产期走 VITE_API_URL。
const BASE = import.meta.env.VITE_API_URL || '';
const TIMEOUT_MS = 20_000;

export async function api<T = unknown>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('ib_token');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...opts,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.headers || {}),
      },
    });
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('请求超时（后端可能正在冷启动或不可达，请稍后重试）');
    }
    throw new Error(
      '网络请求失败：请确认 VITE_API_URL 已指向后端，且后端 CORS 允许本站来源'
    );
  }
  clearTimeout(timer);
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

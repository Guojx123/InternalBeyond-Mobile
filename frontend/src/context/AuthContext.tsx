import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, auth } from '../lib/apiClient';
import { pullSnapshot, flush } from '../lib/sync';

interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!auth.token) {
      setReady(true);
      return;
    }
    api<{ user: AuthUser }>('/api/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => auth.clear())
      .finally(() => setReady(true));
  }, []);

  async function login(email: string, password: string) {
    const r = await api<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    auth.set(r.token);
    setUser(r.user);
    await pullSnapshot(); // 拉取云端快照，逐条 LWW 合并（不覆盖本地更新的离线编辑）
    await flush(); // 把登录前的离线编辑推回服务端
  }

  async function register(email: string, password: string, displayName?: string) {
    const r = await api<{ token: string; user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });
    auth.set(r.token);
    setUser(r.user);
    await pullSnapshot();
    await flush();
  }

  function logout() {
    auth.clear();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用');
  return ctx;
}

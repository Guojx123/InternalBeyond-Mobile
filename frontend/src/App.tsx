import { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import { TopBar } from './components/TopBar';
import { Drawer } from './components/Drawer';
import { BottomDock } from './components/BottomDock';
import { ToastHost } from './components/ui/Toast';
import { ConfirmHost } from './components/ui/Modal';
import { onOnline } from './lib/sync';
import { api } from './lib/apiClient';

import HomePage from './modules/home/HomePage';
import ChatPage from './modules/chat/ChatPage';
import DataPage from './modules/data/DataPage';
import ApiPage from './modules/api/ApiPage';
import MemoryPage from './modules/memory/MemoryPage';
import CirclePage from './modules/circle/CirclePage';
import CalendarPage from './modules/calendar/CalendarPage';
import BlogPage from './modules/blog/BlogPage';
import LettersPage from './modules/letters/LettersPage';
import MusicPage from './modules/music/MusicPage';
import ICodePage from './modules/icode/ICodePage';
import VisualPage from './modules/visual/VisualPage';
import DIYPage from './modules/diy/DIYPage';
import LockPage from './modules/lock/LockPage';
import GuidePage from './modules/guide/GuidePage';
import { LockScreen } from './components/LockScreen';
import { kvGet, kvSet } from './lib/db';

import { MODULES } from './lib/modules';

function LoginScreen() {
  const { login, register, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return null;

  async function doLogin() {
    setBusy(true);
    setMsg('');
    try {
      await login(email, password);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function doRegister() {
    setBusy(true);
    setMsg('');
    try {
      await register(email, password, name);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '8vh auto 0', padding: 16 }}>
      <div className="card glass">
        <h1>InternalBeyond</h1>
        <p className="muted" style={{ marginBottom: 14 }}>登录或注册以同步你的 IB 数据</p>
        <input placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginBottom: 10 }} />
        <input placeholder="昵称（可选）" value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 10 }} />
        <input placeholder="密码（≥6 位）" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn primary" disabled={busy} onClick={doLogin}>登录</button>
          <button className="btn" disabled={busy} onClick={doRegister}>注册</button>
        </div>
        {msg && <p className="muted" style={{ marginTop: 10 }}>{msg}</p>}
      </div>
    </div>
  );
}

function Shell() {
  const [drawer, setDrawer] = useState(false);
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const h = () => toggle();
    window.addEventListener('ib-toggle-theme', h);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('ib-toggle-theme', h);
      window.removeEventListener('online', onOnline);
    };
  }, [toggle]);

  const current = MODULES.find((m) => location.pathname.startsWith(m.path));
  const title = current ? (
    <>
      <span style={{ fontFamily: 'var(--serif)', letterSpacing: '0.08em' }}>{current.en}</span>{' '}
      <span className="cn" style={{ fontSize: '0.7rem', color: 'var(--tx3)' }}>{current.cn}</span>
    </>
  ) : 'InternalBeyond';

  return (
    <>
      <TopBar
        title={title}
        left={<span style={{ fontSize: 20 }} onClick={() => setDrawer(true)}>☰</span>}
      />
      <Drawer open={drawer} onClose={() => setDrawer(false)} />
      <main>
        {/* pathname 作 key：一级路由切换时重挂载并播放 subIn 侧滑转场 */}
        <div className="sub-in" key={location.pathname}>
          <Routes>
            <Route path="/home" element={<HomePage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/data" element={<DataPage />} />
            {/* 已迁移模块 */}
            <Route path="/circle" element={<CirclePage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/letters" element={<LettersPage />} />
            <Route path="/memory" element={<MemoryPage />} />
            <Route path="/music" element={<MusicPage />} />
            <Route path="/icode" element={<ICodePage />} />
            <Route path="/visual" element={<VisualPage />} />
            <Route path="/diy" element={<DIYPage />} />
            <Route path="/lock" element={<LockPage />} />
            <Route path="/api" element={<ApiPage />} />
            <Route path="/guide" element={<GuidePage />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </div>
      </main>
      <BottomDock onGo={(to) => (to === 'drawer' ? setDrawer(true) : navigate(to))} />
    </>
  );
}

export default function App() {
  const { user, ready } = useAuth();
  const [showLock, setShowLock] = useState(false);

  useEffect(() => {
    if (user) {
      kvGet<boolean>('lockOn').then((on) => on && setShowLock(true));
      // 每日首次打开时，让 TA 主动关怀一次（模拟定时关怀）
      dailyCare();
    }
  }, [user]);

  async function dailyCare() {
    try {
      const last = await kvGet<number>('lastCareAt');
      if (last && Date.now() - last < 20 * 60 * 1000) return; // 20 分钟内不重复
      await api('/api/care/trigger', { method: 'POST', body: JSON.stringify({}) });
      await kvSet('lastCareAt', Date.now());
    } catch {
      /* 关怀失败不影响主流程 */
    }
  }

  if (!ready) return <div className="muted" style={{ padding: 24, textAlign: 'center' }}>初始化中…</div>;
  if (!user) return <LoginScreen />;
  return (
    <>
      {showLock && <LockScreen onUnlock={() => setShowLock(false)} />}
      <Shell />
      <ToastHost />
      <ConfirmHost />
    </>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MODULES } from '../lib/modules';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme } = useTheme();

  function go(path: string) {
    navigate(path);
    onClose();
  }

  return (
    <>
      <div id="drawer-scrim" className={open ? 'show' : ''} onClick={onClose} />
      <aside id="drawer" className={open ? 'open' : ''}>
        <div className="dw-brand">
          <div className="dw-seal">
            <svg viewBox="0 0 24 24"><path d="M12 3c0 6-4 9-9 9a9 9 0 1 0 18 0c0-5-4-9-9-9z" fill="currentColor" /></svg>
          </div>
          <div className="dw-word">
            <div className="dw-wm">
              <span className="ib-a">Internal</span>
              <span className="ib-b">{theme === 'infernal' ? 'Infernal' : 'Beyond'}</span>
            </div>
          </div>
        </div>
        <div className="dw-orn"><i /><span>IB · MOBILE</span><i /></div>
        <div className="dw-list">
          {MODULES.map((m) => (
            <div key={m.key} className="dw-item" onClick={() => go(m.path)}>
              <div className="dw-med">
                <span style={{ fontSize: 14 }}>{m.glyph}</span>
              </div>
              <div>
                <div className="dw-en">{m.en}</div>
                <div className="dw-cn">{m.cn}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="dw-foot">
          <div className="dw-foot-btn" onClick={logout}>
            <div className="dwf-ico">⎋</div>
            <div className="dwf-tx"><span className="dwf-en">退出</span><span className="dwf-cn">{user?.email || ''}</span></div>
          </div>
          <div className="dw-foot-btn" onClick={onClose}>
            <div className="dwf-ico">×</div>
            <div className="dwf-tx"><span className="dwf-en">关闭</span><span className="dwf-cn">收起菜单</span></div>
          </div>
        </div>
      </aside>
    </>
  );
}

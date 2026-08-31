import { useLocation } from 'react-router-dom';
import { DOCK_TABS, dockGlyph } from '../lib/modules';

interface BottomDockProps {
  /** 回调：'drawer' 表示打开抽屉，其余为路由路径 */
  onGo: (to: string) => void;
}

/**
 * 底部玻璃药丸坞（参考 #dock / .dock-i）
 * 选中态由 pathname 前缀匹配实时推导；非主 Tab 模块（如 /calendar）高亮落在 ☰。
 */
export function BottomDock({ onGo }: BottomDockProps) {
  const { pathname } = useLocation();

  // 命中任一主 Tab 路径即高亮该 Tab；未命中（其余 12 个模块）则高亮 ☰
  const hit = DOCK_TABS.find((t) => t.path && pathname.startsWith(t.path));
  const activeKey = hit ? hit.key : 'drawer';

  return (
    <nav id="dock" className="glass" aria-label="主导航">
      {DOCK_TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          className={`dock-i${activeKey === t.key ? ' on' : ''}`}
          aria-current={activeKey === t.key ? 'page' : undefined}
          onClick={() => onGo(t.path || 'drawer')}
        >
          <span className="dock-gl" aria-hidden>
            {dockGlyph(t.key)}
          </span>
          <span>{t.cn}</span>
        </button>
      ))}
    </nav>
  );
}

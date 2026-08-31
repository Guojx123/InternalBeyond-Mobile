// 模块注册表：抽屉导航与 Home 桌面图标共用。后续每模块在此登记即可。
export interface ModuleDef {
  key: string;
  path: string;
  en: string;
  cn: string;
  glyph: string; // 桌面/抽屉用的简短标识
}

export const MODULES: ModuleDef[] = [
  { key: 'home', path: '/home', en: 'Home', cn: '主页', glyph: '⌂' },
  { key: 'chat', path: '/chat', en: 'Chat', cn: '对话', glyph: '✶' },
  { key: 'circle', path: '/circle', en: 'Circle', cn: '社交圈', glyph: '◯' },
  { key: 'calendar', path: '/calendar', en: 'Calendar', cn: '日历', glyph: '▦' },
  { key: 'blog', path: '/blog', en: 'Blog', cn: '日志', glyph: '✎' },
  { key: 'letters', path: '/letters', en: 'Letters', cn: '邮局', glyph: '✉' },
  { key: 'memory', path: '/memory', en: 'Memory', cn: '记忆', glyph: '❤' },
  { key: 'music', path: '/music', en: 'Music', cn: '音乐', glyph: '♪' },
  { key: 'icode', path: '/icode', en: 'ICode', cn: '工作区', glyph: '⟨⟩' },
  { key: 'visual', path: '/visual', en: 'Visual', cn: '视觉', glyph: '◑' },
  { key: 'diy', path: '/diy', en: 'DIY', cn: '工具', glyph: '⚙' },
  { key: 'lock', path: '/lock', en: 'Lock', cn: '锁屏', glyph: '🔒' },
  { key: 'api', path: '/api', en: 'API', cn: '接口', glyph: '🔌' },
  { key: 'data', path: '/data', en: 'Data', cn: '数据', glyph: '⛁' },
  { key: 'guide', path: '/guide', en: 'Guide', cn: '指南', glyph: '?' },
];

export function moduleByKey(key: string): ModuleDef | undefined {
  return MODULES.find((m) => m.key === key);
}

/* ============================================================================
   底部 Dock 主 Tab
   ----------------------------------------------------------------------------
   默认四项：Home / Chat / Circle / 菜单(☰)。
   末项 'drawer' 为特殊项，点击打开抽屉（其余 12 个模块仍由 Drawer 全量进入）。
   图标统一取自 MODULES[].glyph，避免 Dock / Drawer / 桌面三处漂移。
   ========================================================================== */
export interface DockTab {
  /** 模块 key；'drawer' 表示打开抽屉 */
  key: string;
  en: string;
  cn: string;
  /** 跳转路径；drawer 项为空串 */
  path: string;
}

export const DOCK_TABS: DockTab[] = [
  { key: 'home', en: 'Home', cn: '主页', path: '/home' },
  { key: 'chat', en: 'Chat', cn: '对话', path: '/chat' },
  { key: 'circle', en: 'Circle', cn: '社交圈', path: '/circle' },
  { key: 'drawer', en: 'More', cn: '菜单', path: '' },
];

/** Dock 项图标：非抽屉项读模块 glyph，抽屉项固定 ☰ */
export function dockGlyph(key: string): string {
  if (key === 'drawer') return '☰';
  return moduleByKey(key)?.glyph || '◯';
}

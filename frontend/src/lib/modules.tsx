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

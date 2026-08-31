import { GlassCard, SectionTitle } from '../../components/GlassCard';
import { MODULES } from '../../lib/modules';

const STEPS = [
  { en: 'Connect', cn: '连接', text: '在 API 页添加你的 AI 端口（Claude / GPT / DeepSeek / Gemini / 中转站）。' },
  { en: 'Talk', cn: '对话', text: '到 Chat 开始对话；Space 名片会作为上下文发给所有 AI。' },
  { en: 'Remember', cn: '记忆', text: '用 Memory 记录情感坐标，Circle 与授权 AI 互发动态。' },
  { en: 'Backup', cn: '备份', text: '在 Data 页定期导出备份（换设备 / 清缓存前必做）。' },
];

// 应用内指南：hero + 编号步骤 + 模块总览网格。
export default function GuidePage() {
  return (
    <div className="page">
      {/* Hero */}
      <GlassCard>
        <div style={{ textAlign: 'center', padding: '10px 6px 4px' }}>
          <div
            style={{
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: '1.6rem',
              color: 'var(--tx)',
              lineHeight: 1.2,
            }}
          >
            Internal<span style={{ color: 'var(--acc)' }}>Beyond</span>
          </div>
          <div className="cn" style={{ fontSize: '0.68rem', letterSpacing: '0.3em', marginTop: 6 }}>
            MOBILE
          </div>
          <p style={{ lineHeight: 1.9, fontSize: '0.84rem', color: 'var(--tx2)', marginTop: 14 }}>
            一个围绕「维系情感连续性」的个人 AI 陪伴应用：数据本地优先（IndexedDB），登录后自动同步到你的云端账户；AI
            密钥仅存服务端，浏览器不持有明文。
          </p>
        </div>
      </GlassCard>

      {/* 编号步骤 */}
      <SectionTitle en="Quick Start" cn="快速上手" />
      <GlassCard>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {STEPS.map((s, i) => (
            <li key={s.en} className="tog" style={{ alignItems: 'center' }}>
              <span
                className="glass"
                style={{
                  flex: 'none',
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  color: 'var(--acc)',
                  fontFamily: 'var(--serif)',
                }}
              >
                {i + 1}
              </span>
              <div className="tog-m">
                <div className="tog-t">
                  {s.cn} <span className="cn">· {s.en}</span>
                </div>
                <div className="tog-s">{s.text}</div>
              </div>
            </li>
          ))}
        </ol>
      </GlassCard>

      {/* 模块总览 */}
      <SectionTitle en="Modules" cn="模块一览" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
        {MODULES.filter((m) => m.key !== 'home' && m.key !== 'guide').map((m) => (
          <GlassCard key={m.key}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div
                className="glass"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--acc)',
                  flex: 'none',
                }}
              >
                {m.glyph}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>{m.cn}</div>
                <div className="muted">{m.en}</div>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

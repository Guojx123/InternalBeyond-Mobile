import { GlassCard, SectionTitle } from '../../components/GlassCard';
import { MODULES } from '../../lib/modules';

// 应用内指南：模块总览 + 快速上手（内容骨架，可后续补充图文）。
export default function GuidePage() {
  return (
    <div className="page">
      <SectionTitle en="Guide" cn="指南" />
      <GlassCard>
        <p style={{ lineHeight: 1.9, fontSize: '0.88rem' }}>
          欢迎来到 <b>InternalBeyond · Mobile</b>。这是一个围绕「维系情感连续性」的个人 AI 陪伴应用：
          数据本地优先（IndexedDB），登录后自动同步到你的云端账户；AI 密钥仅存服务端，浏览器不持有明文。
        </p>
        <ol style={{ margin: '10px 0 0 18px', lineHeight: 2, fontSize: '0.86rem', color: 'var(--tx2)' }}>
          <li>在 <b>API</b> 页添加你的 AI 端口（Claude / GPT / DeepSeek / Gemini / 中转站）。</li>
          <li>到 <b>Chat</b> 开始对话；Space 名片会作为上下文发给所有 AI。</li>
          <li>用 <b>Memory</b> 记录情感坐标，<b>Circle</b> 与授权 AI 互发动态。</li>
          <li>在 <b>Data</b> 页定期导出备份（换设备/清缓存前必做）。</li>
        </ol>
      </GlassCard>

      <SectionTitle en="Modules" cn="模块一览" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
        {MODULES.filter((m) => m.key !== 'home' && m.key !== 'guide').map((m) => (
          <GlassCard key={m.key}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div className="glass" style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--acc)' }}>{m.glyph}</div>
              <div>
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

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard, SectionTitle, Empty } from '../../components/GlassCard';
import { MODULES } from '../../lib/modules';
import { localGet, localGetAll, localPut } from '../../lib/db';

interface Profile {
  name?: string;
  bio?: string;
  avatar?: string;
}

export default function HomePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile>({});
  const [aiCount, setAiCount] = useState(0);

  useEffect(() => {
    localGet('about', 'me').then((r) => setProfile((r?.data as Profile) || {}));
    localGetAll('apiConfigs').then((rows) => setAiCount(rows.length));
  }, []);

  function saveProfile(patch: Partial<Profile>) {
    const next = { ...profile, ...patch };
    setProfile(next);
    localPut('about', 'me', next);
  }

  const deskModules = MODULES.filter((m) => m.key !== 'home');

  return (
    <div className="page">
      {/* Space：液态玻璃个人名片 */}
      <GlassCard>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              border: '1.5px solid rgba(255,255,255,0.6)',
              background: profile.avatar ? `center/cover no-repeat url(${profile.avatar})` : 'var(--soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--serif)',
              fontSize: 26,
              color: 'var(--tx3)',
              flex: 'none',
            }}
          >
            {!profile.avatar && (profile.name?.[0] || 'IB')}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              value={profile.name || ''}
              placeholder="你的名字"
              onChange={(e) => saveProfile({ name: e.target.value })}
              style={{ fontWeight: 600, fontSize: '1.05rem', border: 'none', background: 'transparent', padding: 2 }}
            />
            <textarea
              value={profile.bio || ''}
              placeholder="一句话简介，会作为上下文发给所有 AI"
              onChange={(e) => saveProfile({ bio: e.target.value })}
              style={{ width: '100%', border: 'none', background: 'transparent', resize: 'none', color: 'var(--tx2)', fontFamily: 'inherit', fontSize: '0.82rem', marginTop: 4 }}
              rows={2}
            />
          </div>
        </div>
        <div className="hint">已配置 AI 端口：{aiCount} · 数据本地优先，登录后自动同步到云端</div>
      </GlassCard>

      {/* Desk：应用矩阵 */}
      <SectionTitle en="Desk" cn="桌面" />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
        }}
      >
        {deskModules.map((m) => (
          <div
            key={m.key}
            onClick={() => navigate(m.path)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              padding: '10px 4px',
            }}
          >
            <div
              className="glass"
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                color: 'var(--acc)',
              }}
            >
              {m.glyph}
            </div>
            <div style={{ fontSize: '0.66rem', color: 'var(--tx3)' }}>{m.cn}</div>
          </div>
        ))}
      </div>

      {/* Circle：进入社交圈 */}
      <SectionTitle en="Circle" cn="社交圈名片" />
      <GlassCard onClick={() => navigate('/circle')}>
        <Empty text="进入社交圈，与已授权的 AI 互发动态、评论与转发" />
      </GlassCard>
    </div>
  );
}

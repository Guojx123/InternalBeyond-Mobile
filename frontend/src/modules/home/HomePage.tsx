import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard, SectionTitle } from '../../components/GlassCard';
import { Avatar } from '../../components/ui/Avatar';
import { Textarea } from '../../components/ui/Textarea';
import { MODULES } from '../../lib/modules';
import { localGet, localGetAll, localPut, kvGet, kvSet } from '../../lib/db';

interface Profile {
  name?: string;
  bio?: string;
  avatar?: string;
}

interface AiCard {
  docId: string;
  nickname?: string;
  name?: string;
  relation?: string;
  aiModel?: string;
}

interface CalEvent {
  docId: string;
  title: string;
  type: string;
  date: string; // yyyy-mm-dd
  repeat: string;
  createdAt: number;
}

interface AutoMem {
  docId: string;
  aiName: string;
  category: string;
  content: string;
}

type Panel = 'desk' | 'space' | 'circle';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function HomePage() {
  const navigate = useNavigate();
  const [panel, setPanel] = useState<Panel>('desk');
  const [profile, setProfile] = useState<Profile>({});
  const [aiCards, setAiCards] = useState<AiCard[]>([]);
  const [autoMems, setAutoMems] = useState<AutoMem[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [note, setNote] = useState('');
  const [memCount, setMemCount] = useState(0);

  useEffect(() => {
    localGet('about', 'me').then((r) => setProfile((r?.data as Profile) || {}));
    localGetAll('apiConfigs').then((rows) =>
      setAiCards(rows.map((r) => ({ ...(r.data as object), docId: r.docId } as AiCard)))
    );
    localGetAll('autoMemory').then((rows) =>
      setAutoMems(rows.map((r) => r.data as unknown as AutoMem))
    );
    localGetAll('calEvents').then((rows) =>
      setEvents(rows.map((r) => r.data as unknown as CalEvent).sort((a, b) => a.date.localeCompare(b.date)))
    );
    localGetAll('memories').then((rows) => setMemCount(rows.length));
    kvGet<string>('deskNote').then((n) => n && setNote(n));
  }, []);

  function saveProfile(patch: Partial<Profile>) {
    const next = { ...profile, ...patch };
    setProfile(next);
    localPut('about', 'me', next);
  }

  function saveNote(v: string) {
    setNote(v);
    kvSet('deskNote', v);
  }

  const deskModules = MODULES.filter((m) => m.key !== 'home');

  /* ── 挂件：迷你月历 ── */
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const pad = first.getDay();
  const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const todayKey = ymd(today);

  /* ── 挂件：下一个日程 ── */
  const nextEvent = events.find((e) => e.date >= todayKey);
  const nextEvents = events.filter((e) => e.date >= todayKey).slice(0, 3);

  return (
    <div className="page">
      {/* 三面板分段切换 */}
      <div className="seg" style={{ marginBottom: 14 }}>
        {(
          [
            ['desk', 'Desk 桌面'],
            ['space', 'Space 空间'],
            ['circle', 'Circle 圈子'],
          ] as [Panel, string][]
        ).map(([k, label]) => (
          <button key={k} className={`seg-i${panel === k ? ' on' : ''}`} onClick={() => setPanel(k)}>
            {label}
          </button>
        ))}
      </div>

      {/* ───────────────────────── Desk ───────────────────────── */}
      {panel === 'desk' && (
        <>
          <SectionTitle en="Widgets" cn="挂件" />
          <div className="widget-row" style={{ marginBottom: 14 }}>
            {/* 月历 mini */}
            <div className="widget glass" onClick={() => navigate('/calendar')}>
              <div style={{ fontSize: '0.62rem', letterSpacing: '0.2em', color: 'var(--tx3)', marginBottom: 6 }}>
                {today.getMonth() + 1} 月
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
                {WEEK.map((w) => (
                  <span key={w} style={{ fontSize: '0.5rem', color: 'var(--tx3)', textAlign: 'center' }}>
                    {w}
                  </span>
                ))}
                {[...Array(pad).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)].map((d, i) =>
                  d === null ? (
                    <span key={i} />
                  ) : (
                    <span
                      key={i}
                      style={{
                        fontSize: '0.56rem',
                        textAlign: 'center',
                        lineHeight: '14px',
                        borderRadius: '50%',
                        color: d === today.getDate() ? '#fff' : 'var(--tx2)',
                        background: d === today.getDate() ? 'var(--acc)' : 'transparent',
                      }}
                    >
                      {d}
                    </span>
                  )
                )}
              </div>
            </div>

            {/* 便笺 mini */}
            <div className="widget glass" style={{ cursor: 'default' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: '0.62rem', letterSpacing: '0.2em', color: 'var(--tx3)', marginBottom: 6 }}>
                便笺
              </div>
              <textarea
                value={note}
                onChange={(e) => saveNote(e.target.value)}
                placeholder="随手记一句…"
                rows={3}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--tx2)',
                  fontSize: '0.76rem',
                  lineHeight: 1.6,
                  resize: 'none',
                  padding: 0,
                  fontFamily: 'inherit',
                  width: '100%',
                }}
              />
            </div>

            {/* 日程 mini */}
            <div className="widget glass" onClick={() => navigate('/calendar')}>
              <div style={{ fontSize: '0.62rem', letterSpacing: '0.2em', color: 'var(--tx3)', marginBottom: 6 }}>
                日程
              </div>
              {nextEvents.length === 0 ? (
                <div className="muted" style={{ fontSize: '0.72rem' }}>近期没有安排</div>
              ) : (
                nextEvents.map((e) => (
                  <div key={e.docId} style={{ fontSize: '0.74rem', color: 'var(--tx2)', marginBottom: 3 }}>
                    <span className="cn" style={{ marginRight: 6 }}>{e.date.slice(5)}</span>
                    {e.title}
                  </div>
                ))
              )}
            </div>

            {/* 音乐 mini */}
            <div className="widget glass" onClick={() => navigate('/music')}>
              <div style={{ fontSize: '0.62rem', letterSpacing: '0.2em', color: 'var(--tx3)', marginBottom: 6 }}>
                Music
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'var(--soft)',
                    border: '1px solid var(--glass-line)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--acc)',
                    fontSize: 17,
                  }}
                >
                  ♪
                </span>
                <span className="muted" style={{ fontSize: '0.72rem' }}>
                  黑胶 · 歌词
                  <br />
                  一起听
                </span>
              </div>
            </div>
          </div>

          <SectionTitle en="Desk" cn="全部应用" />
          <div className="desk-grid">
            {deskModules.map((m) => (
              <div key={m.key} className="desk-tile" onClick={() => navigate(m.path)}>
                <div className="tile-ico glass">{m.glyph}</div>
                <div className="tile-tx">{m.cn}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ───────────────────────── Space ───────────────────────── */}
      {panel === 'space' && (
        <>
          <div
            className="glass"
            style={{ borderRadius: 22, overflow: 'hidden', padding: 0, marginBottom: 12 }}
          >
            {/* 封面渐变 */}
            <div
              style={{
                height: 92,
                background:
                  'linear-gradient(135deg, color-mix(in srgb, var(--acc) 55%, transparent), color-mix(in srgb, var(--gold) 40%, transparent))',
              }}
            />
            <div style={{ padding: '0 18px 18px', marginTop: -34 }}>
              <Avatar
                src={profile.avatar || null}
                name={profile.name || 'IB'}
                size={68}
                className="ava-tap"
              />
              <input
                value={profile.name || ''}
                placeholder="你的名字"
                onChange={(e) => saveProfile({ name: e.target.value })}
                style={{
                  fontWeight: 600,
                  fontSize: '1.05rem',
                  border: 'none',
                  background: 'transparent',
                  padding: '8px 2px 0',
                  color: 'var(--tx)',
                  fontFamily: 'var(--disp)',
                }}
              />
              <Textarea
                value={profile.bio || ''}
                placeholder="一句话简介，会作为上下文发给所有 AI"
                onChange={(e) => saveProfile({ bio: e.target.value })}
                rows={2}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: '4px 2px 0',
                  color: 'var(--tx2)',
                  fontSize: '0.82rem',
                  resize: 'none',
                }}
              />
              {/* 作品集三图占位槽 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 12 }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="glass"
                    style={{
                      aspectRatio: '1',
                      borderRadius: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--tx3)',
                      fontSize: '1.1rem',
                      opacity: 0.75,
                    }}
                  >
                    ✦
                  </div>
                ))}
              </div>
              <div className="hint">
                已配置 AI 端口：{aiCards.length} · 记忆 {memCount} 条 · 数据本地优先，登录后自动同步
              </div>
            </div>
          </div>
        </>
      )}

      {/* ───────────────────────── Circle ───────────────────────── */}
      {panel === 'circle' && (
        <>
          <SectionTitle en="Circle" cn="AI 名片" />
          {aiCards.length === 0 && (
            <GlassCard onClick={() => navigate('/api')}>
              <div style={{ textAlign: 'center', padding: 14 }}>
                <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>✦</div>
                <div style={{ fontSize: '0.86rem', color: 'var(--tx2)' }}>还没有 AI 名片</div>
                <div className="hint">到「接口」页添加你的第一个 AI 端口</div>
              </div>
            </GlassCard>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
            {aiCards.map((c) => {
              const mems = autoMems.filter((m) => m.aiName === (c.nickname || c.name)).length;
              return (
                <GlassCard key={c.docId} onClick={() => navigate('/chat')}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                    <Avatar glyph="✶" name={c.nickname || c.name} size={44} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--tx)' }}>
                        {c.nickname || c.name || '未命名'}
                      </div>
                      {c.relation && <div className="muted" style={{ fontSize: '0.7rem' }}>{c.relation}</div>}
                    </div>
                    <div className="cn" style={{ fontSize: '0.68rem' }}>
                      Auto Memory · {mems}
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
          {nextEvent && (
            <GlassCard onClick={() => navigate('/calendar')} style={{ marginTop: 12 }}>
              <div className="muted" style={{ marginBottom: 4 }}>临近事项</div>
              <div style={{ fontSize: '0.86rem', color: 'var(--tx)' }}>
                {nextEvent.date} · {nextEvent.title}
              </div>
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { GlassCard, SectionTitle, Empty } from '../../components/GlassCard';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { localGetAll, localPut, localDelete } from '../../lib/db';

interface CalEvent {
  docId: string;
  title: string;
  type: 'anniversary' | 'birthday' | 'plan' | 'memo';
  date: string; // yyyy-mm-dd
  repeat: 'none' | 'year' | 'month' | 'week' | 'day';
  createdAt: number;
}

const TYPES: Record<CalEvent['type'], string> = {
  anniversary: '纪念日',
  birthday: '生日',
  plan: '计划',
  memo: '备忘',
};
const REPEATS: Record<CalEvent['repeat'], string> = {
  none: '单次',
  year: '每年',
  month: '每月',
  week: '每周',
  day: '每天',
};
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<CalEvent['type']>('plan');
  const [repeat, setRepeat] = useState<CalEvent['repeat']>('none');
  const [sel, setSel] = useState(ymd(now));

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const rows = await localGetAll('calEvents');
    setEvents(rows.map((r) => r.data as unknown as CalEvent));
  }

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(startPad).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  function eventsOn(day: number): CalEvent[] {
    const key = ymd(new Date(year, month, day));
    return events.filter((e) => {
      if (e.repeat === 'none') return e.date === key;
      if (e.repeat === 'year') return e.date.slice(5) === key.slice(5);
      if (e.repeat === 'month') return e.date.slice(8) === key.slice(8);
      if (e.repeat === 'week') return new Date(key).getDay() === new Date(e.date).getDay();
      if (e.repeat === 'day') return true;
      return false;
    });
  }

  async function add() {
    if (!title.trim()) return;
    const ev: CalEvent = { docId: uid(), title, type, repeat, date: sel, createdAt: Date.now() };
    await localPut('calEvents', ev.docId, ev as unknown as Record<string, unknown>);
    setTitle('');
    load();
  }

  async function del(id: string) {
    await localDelete('calEvents', id);
    load();
  }

  const selEvents = eventsOn(parseInt(sel.slice(8), 10));

  /* Hero：相遇纪念日（最早的 anniversary / birthday） */
  const heroEv = events
    .filter((e) => e.type === 'anniversary' || e.type === 'birthday')
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const todayKey = ymd(now);
  function daysLabel(ev: CalEvent) {
    // 距下一次周年纪念的天数
    const mmdd = ev.date.slice(5);
    const thisYear = `${todayKey.slice(0, 4)}-${mmdd}`;
    const next = thisYear >= todayKey ? thisYear : `${now.getFullYear() + 1}-${mmdd}`;
    const days = Math.round((new Date(next).getTime() - new Date(todayKey).getTime()) / 86400000);
    return days === 0 ? '就是今天' : days > 0 ? `还有 ${days} 天` : '';
  }

  return (
    <div className="page">
      <SectionTitle en="Calendar" cn="日历" />
      <p className="hint">纪念日 / 生日 / 计划 / 备忘，支持每年 / 每月 / 每周 / 每天 / 单次重复。授权 AI 可读临近事项并自然提起。</p>

      {/* Hero 相遇纪念卡 */}
      {heroEv && (
        <div
          className="glass"
          style={{
            borderRadius: 20,
            padding: '16px 18px',
            marginBottom: 12,
            background:
              'linear-gradient(135deg, color-mix(in srgb, var(--gold) 22%, transparent), color-mix(in srgb, var(--acc) 14%, transparent))',
            border: '1px solid color-mix(in srgb, var(--gold) 40%, transparent)',
          }}
        >
          <div className="cn" style={{ fontSize: '0.66rem', letterSpacing: '0.24em' }}>
            {heroEv.type === 'birthday' ? 'BIRTHDAY' : 'ANNIVERSARY'}
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: '1.3rem', color: 'var(--tx)', margin: '4px 0' }}>
            {heroEv.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ color: 'var(--gold)', fontSize: '0.86rem' }}>{daysLabel(heroEv)}</span>
            <span className="muted" style={{ fontSize: '0.72rem' }}>始于 {heroEv.date}</span>
          </div>
        </div>
      )}

      {/* 吸顶月份导航（参考 .cvcal-bar） */}
      <div className="cvcal-bar">
        <button className="cvcal-nav" onClick={() => shiftMonth(-1)} aria-label="上月">‹</button>
        <div className="cvcal-t">{year} 年 {month + 1} 月</div>
        <button className="cvcal-nav" onClick={() => shiftMonth(1)} aria-label="下月">›</button>
      </div>

      <div className="glass" style={{ borderRadius: 18, padding: 12, marginBottom: 12 }}>
        <div className="cvcal-grid" style={{ marginBottom: 4 }}>
          {WEEK.map((w) => (
            <div key={w} className="muted" style={{ fontSize: '0.62rem', textAlign: 'center', padding: 2 }}>
              {w}
            </div>
          ))}
        </div>
        <div className="cvcal-grid">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const key = ymd(new Date(year, month, d));
            const evs = eventsOn(d);
            const hasGold = evs.some((e) => e.type === 'anniversary' || e.type === 'birthday');
            const active = key === sel;
            return (
              <div
                key={i}
                className={`cvcal-cell${evs.length ? ' has-ev' : ''}${active ? ' sel' : ''}`}
                onClick={() => setSel(key)}
              >
                <span className="cvcal-day">{d}</span>
                {evs.length > 0 && <span className={`cvcal-dot${hasGold ? ' gold' : ''}`} />}
              </div>
            );
          })}
        </div>
      </div>

      <SectionTitle en="On this day" cn={`${sel.slice(5)} 的事项`} />
      {selEvents.length === 0 && <Empty text="这一天还没有安排" />}
      {selEvents.map((e) => (
        <GlassCard key={e.docId}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: e.type === 'anniversary' || e.type === 'birthday' ? 'var(--gold)' : 'var(--tx)' }}>
                {e.title}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <span className="chip" style={{ padding: '2px 9px', fontSize: '0.64rem', cursor: 'default' }}>{TYPES[e.type]}</span>
                <span className="chip" style={{ padding: '2px 9px', fontSize: '0.64rem', cursor: 'default' }}>{REPEATS[e.repeat]}</span>
              </div>
            </div>
            <button className="btn danger" style={{ flex: 'none', padding: '5px 12px' }} onClick={() => del(e.docId)}>×</button>
          </div>
        </GlassCard>
      ))}

      <SectionTitle en="Add" cn="新增事项" />
      <GlassCard>
        <div className="field">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题" />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Select value={type} onChange={(e) => setType(e.target.value as CalEvent['type'])} style={{ flex: 1 }}>
            {Object.entries(TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <Select value={repeat} onChange={(e) => setRepeat(e.target.value as CalEvent['repeat'])} style={{ flex: 1 }}>
            {Object.entries(REPEATS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
          <input type="date" value={sel} onChange={(e) => setSel(e.target.value)} style={{ flex: 1 }} />
          <button className="btn primary" onClick={add}>添加</button>
        </div>
      </GlassCard>
    </div>
  );
}

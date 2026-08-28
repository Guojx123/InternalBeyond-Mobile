import { useEffect, useState } from 'react';
import { GlassCard, SectionTitle, Empty } from '../../components/GlassCard';
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

  return (
    <div className="page">
      <SectionTitle en="Calendar" cn="日历" />
      <p className="hint">纪念日 / 生日 / 计划 / 备忘，支持每年 / 每月 / 每周 / 每天 / 单次重复。授权 AI 可读临近事项并自然提起。</p>

      <GlassCard>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <button className="btn" onClick={() => shiftMonth(-1)}>‹</button>
          <div style={{ fontWeight: 600 }}>{year} 年 {month + 1} 月</div>
          <button className="btn" onClick={() => shiftMonth(1)}>›</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, textAlign: 'center' }}>
          {WEEK.map((w) => (
            <div key={w} className="muted" style={{ fontSize: '0.66rem', padding: 4 }}>{w}</div>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const key = ymd(new Date(year, month, d));
            const evs = eventsOn(d);
            const active = key === sel;
            return (
              <div
                key={i}
                onClick={() => setSel(key)}
                style={{
                  borderRadius: 10,
                  padding: '6px 0',
                  cursor: 'pointer',
                  background: active ? 'var(--acc)' : evs.length ? 'var(--soft)' : 'transparent',
                  color: active ? '#fff' : 'var(--tx)',
                  fontSize: '0.78rem',
                  minHeight: 30,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span>{d}</span>
                {evs.length > 0 && <span style={{ fontSize: 6, lineHeight: 1 }}>●</span>}
              </div>
            );
          })}
        </div>
      </GlassCard>

      <SectionTitle en="On this day" cn={`${sel.slice(5)} 的事项`} />
      {selEvents.length === 0 && <Empty text="这一天还没有安排" />}
      {selEvents.map((e) => (
        <GlassCard key={e.docId}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <b>{e.title}</b>
              <div className="muted">{TYPES[e.type]} · {REPEATS[e.repeat]}</div>
            </div>
            <button className="btn danger" onClick={() => del(e.docId)}>×</button>
          </div>
        </GlassCard>
      ))}

      <SectionTitle en="Add" cn="新增事项" />
      <GlassCard>
        <div style={{ display: 'grid', gap: 10 }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题" />
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="fld" value={type} onChange={(e) => setType(e.target.value as CalEvent['type'])} style={{ flex: 1 }}>
              {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="fld" value={repeat} onChange={(e) => setRepeat(e.target.value as CalEvent['repeat'])} style={{ flex: 1 }}>
              {Object.entries(REPEATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" value={sel} onChange={(e) => setSel(e.target.value)} className="fld" style={{ flex: 1 }} />
            <button className="btn primary" onClick={add}>添加</button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

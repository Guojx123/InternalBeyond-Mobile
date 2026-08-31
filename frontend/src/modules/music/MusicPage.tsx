import { useEffect, useRef, useState } from 'react';
import { GlassCard, SectionTitle, Empty } from '../../components/GlassCard';
import { Input } from '../../components/ui/Input';
import { api } from '../../lib/apiClient';
import { kvGet, kvSet } from '../../lib/db';

interface Track {
  id: string;
  name: string;
  url: string; // object URL（会话内有效）
  /** 本地只读封面（object URL / dataURL），不进 Dexie / 同步 */
  cover?: string;
  lrc: { time: number; text: string }[];
}
interface RoomState {
  track: string;
  position: number;
  playing: boolean;
  by: string;
  updatedAt: number;
}

function parseLrc(text: string): { time: number; text: string }[] {
  const out: { time: number; text: string }[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(/\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/);
    if (!m) continue;
    const time = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + (m[3] ? parseInt(m[3], 10) / (m[3].length === 3 ? 1000 : 100) : 0);
    const txt = line.replace(/\[.*?\]/g, '').trim();
    if (txt) out.push({ time, text: txt });
  }
  return out.sort((a, b) => a.time - b.time);
}

export default function MusicPage() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lrcBoxRef = useRef<HTMLDivElement>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [pendingSeek, setPendingSeek] = useState<number | null>(null);

  // 一起听（跨端）
  const [roomOn, setRoomOn] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState('本机');
  const [remote, setRemote] = useState<RoomState | null>(null);
  const lastLocalAt = useRef(0);
  const applyingRef = useRef(false);
  // 实时播放快照，供轮询闭包读取最新值（避免 effect 捕获过期 state）
  const liveRef = useRef({ trackName: '', time: 0, playing: false, tracks: [] as Track[] });

  const track = tracks[current];
  liveRef.current.trackName = track?.name || '';
  liveRef.current.time = time;
  liveRef.current.playing = playing;
  liveRef.current.tracks = tracks;

  function addFiles(audioFile: File, lrcFile?: File) {
    const url = URL.createObjectURL(audioFile);
    const name = audioFile.name.replace(/\.[^.]+$/, '');
    if (lrcFile) {
      lrcFile.text().then((t) => setTracks((p) => [...p, { id: Math.random().toString(36).slice(2), name, url, lrc: parseLrc(t) }]));
    } else {
      setTracks((p) => [...p, { id: Math.random().toString(36).slice(2), name, url, lrc: [] }]);
    }
  }

  /** 给当前曲目附带本地封面（不持久化） */
  function attachCover(file: File | undefined) {
    if (!file || !track) return;
    const cover = URL.createObjectURL(file);
    setTracks((p) => p.map((t) => (t.id === track.id ? { ...t, cover } : t)));
  }

  function play(idx: number) {
    setCurrent(idx);
    setPlaying(true);
    if (roomOn) publish({ track: tracks[idx]?.name || '', position: 0, playing: true });
  }

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.play().catch(() => {});
    else a.pause();
  }, [playing, current]);

  // 逐句歌词跟随滚动
  const activeLyric = track?.lrc.findIndex((l, i) => l.time <= time && (track.lrc[i + 1]?.time ?? Infinity) > time) ?? -1;
  useEffect(() => {
    if (activeLyric < 0 || !lrcBoxRef.current) return;
    const el = lrcBoxRef.current.querySelector<HTMLElement>(`[data-lrc="${activeLyric}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeLyric]);

  function onTime() {
    const a = audioRef.current;
    if (!a) return;
    setTime(a.currentTime);
    setDur(a.duration || 0);
  }

  // 切换一起听：初始化设备标签 + 立即上报 + 启动轮询
  useEffect(() => {
    if (!roomOn) return;
    kvGet<string>('deviceLabel').then((d) => {
      if (d) setDeviceLabel(d);
      else {
        const l = '设备-' + Math.random().toString(36).slice(2, 6);
        setDeviceLabel(l);
        kvSet('deviceLabel', l);
      }
    });
    // 立即上报当前状态
    publish();

    const poll = setInterval(async () => {
      try {
        const r = await api<{ room: RoomState | null }>('/api/listen');
        const room = r.room;
        setRemote(room);
        if (room && room.updatedAt > lastLocalAt.current && room.by !== deviceLabel && !applyingRef.current) {
          applyRemote(room);
        }
      } catch {
        /* 忽略轮询失败 */
      }
    }, 2000);

    // 播放中定期上报进度，让对端跟随
    const tick = setInterval(() => {
      if (roomOn && playing && !applyingRef.current) publish({ playing: true });
    }, 4000);

    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomOn]);

  function applyRemote(room: RoomState) {
    applyingRef.current = true;
    lastLocalAt.current = room.updatedAt;
    setRemote(room);
    const idx = liveRef.current.tracks.findIndex((t) => t.name === room.track);
    if (idx >= 0 && idx !== current) setCurrent(idx);
    if (room.position > 0) setPendingSeek(room.position);
    setPlaying(room.playing);
    setTimeout(() => (applyingRef.current = false), 300);
  }

  async function publish(overrides?: { track?: string; position?: number; playing?: boolean }) {
    const state = {
      track: overrides?.track ?? liveRef.current.trackName,
      position: overrides?.position ?? liveRef.current.time,
      playing: overrides?.playing ?? liveRef.current.playing,
    };
    try {
      const r = await api<{ room: RoomState }>('/api/listen', {
        method: 'POST',
        body: JSON.stringify({ ...state, by: deviceLabel }),
      });
      lastLocalAt.current = r.room.updatedAt;
    } catch {
      /* 忽略上报失败 */
    }
  }

  function togglePlay() {
    const next = !playing;
    setPlaying(next);
    if (roomOn) publish({ track: track?.name || '', position: time, playing: next });
  }

  function onSeek(v: number) {
    if (audioRef.current) audioRef.current.currentTime = v;
    if (roomOn) publish({ track: track?.name || '', position: v, playing });
  }

  return (
    <div className="page">
      <SectionTitle en="Music" cn="音乐 · 黑胶" />
      <p className="hint">页内沉浸黑胶：碟片旋转、封面糊化为背景、逐句滚动歌词。「一起听」开启后，同一账号的其它设备会通过云端房间实时跟随播放进度（两端需各自存有该曲目）。</p>

      {!track && <Empty text="添加音频开始播放（可附带 .lrc 歌词）" />}

      {track && (
        /* Hero 播放器（页面内沉浸，不做全屏遮罩，避免与 Dock/TopBar 打架） */
        <div className="glass" style={{ borderRadius: 22, padding: 18, marginBottom: 12 }}>
          {/* 封面糊化为背景 */}
          {track.cover && (
            <>
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: '-12%',
                  background: `url(${track.cover}) center/cover no-repeat`,
                  filter: 'blur(36px) saturate(1.4)',
                  transform: 'scale(1.25)',
                }}
              />
              <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'var(--panel)' }} />
            </>
          )}

          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
              {/* 旋转碟片：封面为中心圆，无封面时用 --soft 占位 */}
              <div
                style={{
                  width: 116,
                  height: 116,
                  borderRadius: '50%',
                  flex: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: playing ? 'spin 6s linear infinite' : 'none',
                  background:
                    'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.06) 30%, rgba(0,0,0,0.16) 31%, rgba(255,255,255,0.05) 33%, rgba(0,0,0,0.13) 47%, rgba(255,255,255,0.05) 49%, rgba(0,0,0,0.1) 72%, var(--soft) 74%)',
                  border: '1px solid var(--glass-line)',
                  boxShadow: '0 8px 26px rgba(20,40,80,0.22)',
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: track.cover ? `center/cover no-repeat url(${track.cover})` : 'var(--soft)',
                    border: '2px solid rgba(255,255,255,0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--tx3)',
                    fontSize: '1rem',
                  }}
                >
                  {!track.cover && '♪'}
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--tx)' }}>{track.name}</div>
                <input
                  className="ib-range"
                  type="range"
                  min={0}
                  max={dur || 0}
                  step={0.1}
                  value={time}
                  onChange={(e) => onSeek(parseFloat(e.target.value))}
                  style={{ width: '100%', marginTop: 12 }}
                />
                <div className="muted" style={{ fontSize: '0.7rem', marginTop: 2 }}>
                  {fmt(time)} / {fmt(dur)}
                </div>
                <label className="btn" style={{ marginTop: 8, padding: '4px 12px', fontSize: '0.68rem', cursor: 'pointer' }}>
                  {track.cover ? '换封面' : '附封面'}
                  <input type="file" accept="image/*" hidden onChange={(e) => attachCover(e.target.files?.[0])} />
                </label>
              </div>
            </div>

            {/* 玻璃控制条 */}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'center' }}>
              <button className="btn" onClick={() => play((current - 1 + tracks.length) % tracks.length)}>⏮</button>
              <button className="btn primary" style={{ minWidth: 62 }} onClick={togglePlay}>{playing ? '⏸' : '▶'}</button>
              <button className="btn" onClick={() => play((current + 1) % tracks.length)}>⏭</button>
            </div>

            {roomOn && (
              <div className="hint" style={{ textAlign: 'center', marginTop: 8 }}>
                {remote && remote.by && remote.by !== deviceLabel
                  ? `与 ${remote.by} 同步中：${remote.track || '（无）'}`
                  : '一起听房间已开启，其它设备将跟随本机'}
              </div>
            )}
          </div>
        </div>
      )}

      {track && track.lrc.length > 0 && (
        <GlassCard>
          <div
            ref={lrcBoxRef}
            style={{ maxHeight: 210, overflowY: 'auto', textAlign: 'center', lineHeight: 2.2, padding: '4px 0' }}
          >
            {track.lrc.map((l, i) => (
              <div
                key={i}
                data-lrc={i}
                style={{
                  color: i === activeLyric ? 'var(--acc)' : 'var(--tx3)',
                  fontWeight: i === activeLyric ? 600 : 400,
                  fontSize: i === activeLyric ? '0.92rem' : '0.82rem',
                  transition: 'color .2s, font-size .2s',
                }}
              >
                {l.text}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <SectionTitle en="Listen Together" cn="一起听（跨端）" />
      <GlassCard>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className={roomOn ? 'btn primary' : 'btn'} onClick={() => setRoomOn((v) => !v)}>
            {roomOn ? '● 一起听中' : '一起听'}
          </button>
          <Input
            value={deviceLabel}
            onChange={(e) => { setDeviceLabel(e.target.value); kvSet('deviceLabel', e.target.value); }}
            placeholder="本机设备名"
            style={{ flex: 1 }}
          />
        </div>
        <div className="hint" style={{ marginTop: 8 }}>
          开启后，同一账号在其它设备（手机/桌面）上打开音乐页并也开启一起听，即可跟随播放进度与暂停。
        </div>
      </GlassCard>

      <SectionTitle en="Add" cn="添加曲目" />
      <GlassCard>
        <label className="btn">
          选择音频（可多选）
          <input
            type="file"
            accept="audio/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              files.forEach((f) => addFiles(f));
            }}
          />
        </label>
        <label className="btn" style={{ marginLeft: 8 }}>
          附加 .lrc
          <input
            type="file"
            accept=".lrc,.srt,.vtt,text/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              const last = tracks[tracks.length - 1];
              if (f && last) {
                f.text().then((t) => {
                  const lrc = parseLrc(t);
                  setTracks((p) => p.map((x) => (x.id === last.id ? { ...x, lrc } : x)));
                });
              }
            }}
          />
        </label>
      </GlassCard>

      {tracks.length > 0 && (
        <GlassCard>
          <SectionTitle en="Queue" cn="播放队列" />
          {tracks.map((t, i) => (
            <div key={t.id} className="li" onClick={() => play(i)} style={{ marginBottom: 8 }}>
              {t.cover ? (
                <img src={t.cover} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', flex: 'none' }} />
              ) : (
                <span style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: 'var(--tx3)' }}>♪</span>
              )}
              <div className="li-main"><div className="li-name">{t.name}</div></div>
              {i === current && <span className="li-side">{playing ? '▶' : '❚❚'}</span>}
            </div>
          ))}
        </GlassCard>
      )}

      <audio
        ref={audioRef}
        src={track?.url}
        onTimeUpdate={onTime}
        onEnded={() => play((current + 1) % tracks.length)}
        onLoadedMetadata={() => {
          if (pendingSeek != null && audioRef.current) {
            audioRef.current.currentTime = pendingSeek;
            setPendingSeek(null);
          }
        }}
      />
    </div>
  );
}

function fmt(s: number): string {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, '0')}`;
}

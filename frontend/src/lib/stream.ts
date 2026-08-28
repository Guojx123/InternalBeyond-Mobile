import { auth } from './apiClient';

export interface StreamCallbacks {
  onDelta: (raw: string) => void;
  onDone?: () => void;
  onError?: (msg: string) => void;
}

// 调用后端 /api/ai/chat（SSE 流式），解析事件并回调。
// 后端原样透传上游厂商的 SSE，这里只做事件分发。
export async function streamChat(
  body: { configId: string; messages: Array<{ role: string; content: string }>; temperature?: number; maxTokens?: number },
  cb: StreamCallbacks
): Promise<void> {
  const token = auth.token;
  const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    cb.onError?.(`HTTP ${res.status}`);
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    // 按 SSE 事件分片解析
    let idx: number;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const ev = parseEvent(chunk);
      if (ev.event === 'delta') cb.onDelta(ev.data.raw || '');
      else if (ev.event === 'error') cb.onError?.(typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data));
      else if (ev.event === 'done') cb.onDone?.();
    }
  }
  cb.onDone?.();
}

function parseEvent(chunk: string): { event: string; data: any } {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of chunk.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  try {
    return { event, data: JSON.parse(dataLines.join('')) };
  } catch {
    return { event, data: dataLines.join('') };
  }
}

import { streamChat } from './stream';

// 非流式便捷封装：累积 SSE 增量，返回完整文本。用于 Memory/Letters 的 AI 生成等一次性补全场景。
export function completeChat(body: {
  configId: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    let acc = '';
    streamChat(body, {
      onDelta: (d) => (acc += d),
      onDone: () => resolve(acc),
      onError: (e) => reject(new Error(e)),
    });
  });
}

// 从本地 about（Space 名片）拼出简短上下文，供 AI 生成时带入人格。
export async function spaceContext(): Promise<string> {
  const rows = await import('./db').then((m) => m.localGetAll('about'));
  const items = rows.map((r) => r.data as Record<string, unknown>);
  if (!items.length) return '';
  const lines = items.map((it) => `${it.mode ?? ''} ${it.content ?? ''}`.trim()).filter(Boolean);
  return lines.length ? `【关于我的名片】\n${lines.join('\n')}\n` : '';
}

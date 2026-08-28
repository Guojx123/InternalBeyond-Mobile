import { Request, Response } from 'express';
import { IApiConfig } from '../models/ApiConfig';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiChatBody {
  configId: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}

// 根据 provider 选择上游端点与转发方式，并原样流式回传（SSE）。
// 密钥取自 ApiConfig（服务端），浏览器不持有明文。
export async function proxyChat(req: Request, res: Response, config: IApiConfig): Promise<void> {
  const body = req.body as AiChatBody;
  const key = config.getApiKey();
  const provider = (config.provider || 'custom').toLowerCase();
  const baseUrl = config.baseUrl || defaultBaseUrl(provider);
  const model = config.aiModel || defaultModel(provider);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    let upstreamUrl = '';
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let payload: unknown = {};

    if (provider === 'claude' || provider === 'anthropic') {
      upstreamUrl = `${baseUrl}/v1/messages`;
      headers['x-api-key'] = key;
      headers['anthropic-version'] = '2023-06-01';
      payload = {
        model,
        max_tokens: body.maxTokens ?? 4096,
        system: body.messages.find((m) => m.role === 'system')?.content || '',
        messages: body.messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      };
    } else if (provider === 'gemini') {
      upstreamUrl = `${baseUrl}/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${key}`;
      payload = {
        contents: body.messages.filter((m) => m.role !== 'system').map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
      };
    } else {
      // OpenAI 兼容（gpt / deepseek / 自定义中转站）
      upstreamUrl = `${baseUrl}/v1/chat/completions`;
      headers['Authorization'] = `Bearer ${key}`;
      payload = {
        model,
        messages: body.messages,
        stream: true,
        temperature: body.temperature ?? 0.8,
        max_tokens: body.maxTokens ?? 4096,
      };
    }

    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!upstream.ok || !upstream.body) {
      const txt = await upstream.text().catch(() => '');
      send('error', { status: upstream.status, message: txt.slice(0, 400) });
      res.end();
      return;
    }

    // 透传上游 SSE 流
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      // 原样转发给前端；前端按厂商格式解析操作卡标签等
      send('delta', { raw: chunk });
    }
    send('done', {});
    res.end();
  } catch (err) {
    send('error', { message: (err as Error).message });
    res.end();
  }
}

// 非流式一次性补全（后端内部使用，如社交圈 AI 自动评论）。
export async function completeChat(
  config: IApiConfig,
  messages: ChatMessage[],
  opts?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const key = config.getApiKey();
  const provider = (config.provider || 'custom').toLowerCase();
  const baseUrl = config.baseUrl || defaultBaseUrl(provider);
  const model = config.aiModel || defaultModel(provider);
  const temperature = opts?.temperature ?? 0.8;
  const maxTokens = opts?.maxTokens ?? 300;

  let upstreamUrl = '';
  let headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let payload: unknown = {};

  if (provider === 'claude' || provider === 'anthropic') {
    upstreamUrl = `${baseUrl}/v1/messages`;
    headers['x-api-key'] = key;
    headers['anthropic-version'] = '2023-06-01';
    payload = {
      model,
      max_tokens: maxTokens,
      system: messages.find((m) => m.role === 'system')?.content || '',
      messages: messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content })),
      stream: false,
    };
  } else if (provider === 'gemini') {
    upstreamUrl = `${baseUrl}/v1beta/models/${model}:generateContent?key=${key}`;
    payload = {
      contents: messages.filter((m) => m.role !== 'system').map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    };
  } else {
    upstreamUrl = `${baseUrl}/v1/chat/completions`;
    headers['Authorization'] = `Bearer ${key}`;
    payload = { model, messages, stream: false, temperature, max_tokens: maxTokens };
  }

  const upstream = await fetch(upstreamUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
  if (!upstream.ok) throw new Error(`${provider} ${upstream.status}`);
  const j = (await upstream.json()) as any;
  if (provider === 'claude' || provider === 'anthropic') return j.content?.[0]?.text || '';
  if (provider === 'gemini') return j.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return j.choices?.[0]?.message?.content || '';
}

function defaultBaseUrl(provider: string): string {
  switch (provider) {
    case 'claude':
    case 'anthropic':
      return 'https://api.anthropic.com';
    case 'gpt':
    case 'openai':
      return 'https://api.openai.com';
    case 'deepseek':
      return 'https://api.deepseek.com';
    case 'gemini':
      return 'https://generativelanguage.googleapis.com';
    default:
      return '';
  }
}

function defaultModel(provider: string): string {
  switch (provider) {
    case 'claude':
    case 'anthropic':
      return 'claude-opus-4-6';
    case 'gpt':
    case 'openai':
      return 'gpt-5';
    case 'deepseek':
      return 'deepseek-chat';
    case 'gemini':
      return 'gemini-2.0-pro';
    default:
      return '';
  }
}

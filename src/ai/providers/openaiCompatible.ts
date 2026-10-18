import type { AIProvider, AIMessage } from '../provider';
import { log } from '../../core/logger';

export class OpenAICompatibleProvider implements AIProvider {
  name: string;
  vision: boolean;
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private visionModels: string[];

  constructor(opts: {
    name: string; baseUrl: string; apiKey: string; model: string;
    vision?: boolean; visionModels?: string[];
  }) {
    this.visionModels = opts.visionModels ?? [];
    this.name = opts.name;
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.vision = opts.vision ?? false;
  }

  private buildChatUrl(): string {
    if (this.baseUrl.includes('/api/paas/v4')) return `${this.baseUrl}/chat/completions`;
    return `${this.baseUrl}/v1/chat/completions`;
  }

  /** 模型名看起来是否支持图片（glm-4v / glm-4.6v / *-vision / gpt-4o 等） */
  private static looksVision(m: string): boolean {
    return /\dv|vision|-vl|4o/i.test(m);
  }

  async chat(messages: AIMessage[]): Promise<string> {
    const hasImage = messages.some(
      (m) => Array.isArray(m.content) && m.content.some((p) => p.type === 'image_url')
    );

    // 带图片：当前模型不支持图片时，自动换成视觉模型（备选依次尝试）
    let candidates = [this.model];
    if (hasImage && !OpenAICompatibleProvider.looksVision(this.model) && this.visionModels.length) {
      candidates = this.visionModels;
      log('info', `请求含图片，改用视觉模型：${candidates.join(' → ')}`, this.name);
    }

    let lastErr: Error | null = null;
    for (const model of candidates) {
      try {
        return await this.request(messages, model, hasImage);
      } catch (e) {
        lastErr = e as Error;
        const msg = lastErr.message;
        // 只在"模型不存在/参数不被接受"这类错误时换下一个备选
        if (!/\b(400|404)\b/.test(msg)) break;
        log('warn', `模型 ${model} 失败，尝试下一个`, this.name);
      }
    }
    throw lastErr ?? new Error('请求失败');
  }

  private async request(messages: AIMessage[], model: string, hasImage: boolean): Promise<string> {
    const url = this.buildChatUrl();
    const t0 = Date.now();

    log('ai-req', `POST ${url}`, this.name, `模型：${model}\n消息数：${messages.length}${hasImage ? '（含图片）' : ''}`);

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey || 'sk-local'}`,
        },
        body: JSON.stringify({
          model: model || 'local-model',
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          temperature: 0.3,
          // 视觉模型可能先输出推理再给答案，留足长度避免正文被截空
          max_tokens: hasImage ? 6000 : 3000,
        }),
      });
    } catch (e) {
      log('error', `请求失败：${(e as Error).message}`, this.name);
      throw e;
    }

    const elapsed = Date.now() - t0;

    if (!res.ok) {
      const text = await res.text();
      log('error', `HTTP ${res.status}，耗时 ${elapsed}ms`, this.name, text.slice(0, 300));
      throw new Error(`${this.name}：${res.status} ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? '';
    log('ai-res', `响应 ${content.length} 字，耗时 ${elapsed}ms`, this.name, content.slice(0, 800));
    if (!content) {
      throw new Error(`${this.name}：模型返回了空内容（可能被限流或推理超长），请稍后重试`);
    }
    return content;
  }
}

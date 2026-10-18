import type { AIProvider, AIMessage } from '../provider';

// wllama 3.8.1：wasm 资源走 CDN，AssetsPathConfig 仍是 { default: '...' } 格式
const CONFIG_PATHS = {
  default:
    'https://cdn.jsdelivr.net/npm/@wllama/wllama@3.8.1/esm/wasm/wllama.wasm',
};

let wllamaCache: { file: string; mmproj: string; instance: any } | null = null;

export function isWllamaLoaded(file: string): boolean {
  return wllamaCache?.file === file;
}

export interface LoadProgress {
  loaded: number;
  total: number;
  percent: number;
  text: string;
}

type ProgressListener = (p: LoadProgress) => void;
const listeners = new Set<ProgressListener>();

export function onWllamaProgress(fn: ProgressListener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function emit(p: LoadProgress) {
  listeners.forEach((l) => l(p));
}

/** dataURL → ArrayBuffer（wllama 的图片格式） */
async function dataUrlToArrayBuffer(dataUrl: string): Promise<ArrayBuffer> {
  const res = await fetch(dataUrl);
  return res.arrayBuffer();
}

/** 去掉 Qwen3.5 的 thinking 段和常见前缀 */
function cleanOutput(text: string): string {
  let t = text;
  // 去掉 <think>...</think> 段
  t = t.replace(/<think>[\s\S]*?<\/think>/g, '');
  // 去掉未闭合的 thinking 段（生成被截断时）
  t = t.replace(/<think>[\s\S]*$/g, '');
  // 去掉孤立的 think 标记
  t = t.replace(/<\/?think>/g, '');
  // 去掉 "assistant" 之类的前缀
  t = t.replace(/^(assistant|AI|助手)[：:]\s*/i, '');
  return t.trim();
}

export class WllamaProvider implements AIProvider {
  name = '本地模型';
  vision: boolean;
  private file: string;
  private mmprojFile: string;

  constructor(opts: { file: string; mmprojFile?: string }) {
    this.file = opts.file;
    this.mmprojFile = opts.mmprojFile ?? '';
    this.vision = !!this.mmprojFile;
  }

  private async getInstance(): Promise<any> {
    if (wllamaCache?.file === this.file && wllamaCache.mmproj === this.mmprojFile) {
      return wllamaCache.instance;
    }

    emit({ loaded: 0, total: 1, percent: 0, text: '正在初始化引擎…' });

    const { Wllama } = await import('@wllama/wllama');
    const wllama = new Wllama(CONFIG_PATHS, { allowOffline: true });

    const modelUrl = `${import.meta.env.BASE_URL}models/${this.file}`;
    const mmprojUrl = this.mmprojFile
      ? `${import.meta.env.BASE_URL}models/${this.mmprojFile}`
      : undefined;

    console.log('[wllama] 主模型:', modelUrl);
    console.log('[wllama] mmproj:', mmprojUrl);

    emit({ loaded: 0, total: 1, percent: 0, text: `正在读取 ${this.file}…` });

    try {
      // 3.8.1 签名：loadModelFromUrl(ModelSource, LoadModelParams & DownloadOptions)
      // （旧版是把所有参数混在第一个对象里，3.8.1 拆成了两个参数）
      await wllama.loadModelFromUrl(
        { url: modelUrl, mmprojUrl },
        {
          n_ctx: 4096,
          n_batch: 512,
          progressCallback: ({ loaded, total }: { loaded: number; total: number }) => {
            const percent = total > 0 ? loaded / total : 0;
            emit({ loaded, total, percent, text: `读取中 ${(percent * 100).toFixed(0)}%` });
          },
        }
      );
      console.log('[wllama] 加载成功');
    } catch (e) {
      console.error('[wllama] 加载失败:', e);
      throw e;
    }

    wllamaCache = { file: this.file, mmproj: this.mmprojFile, instance: wllama };
    emit({ loaded: 1, total: 1, percent: 1, text: '模型已就绪' });
    return wllama;
  }

  async chat(messages: AIMessage[]): Promise<string> {
    const wllama = await this.getInstance();

    // 带图片的请求必须走 createChatCompletion（原生多模态，图片不会被丢弃）
    const hasImage = messages.some((m) => Array.isArray(m.content));

    if (hasImage) {
      const wllamaMessages: any[] = [];
      for (const m of messages) {
        if (typeof m.content === 'string') {
          let content = m.content;
          if (m.role === 'system') content = content + '\n\n/no_think';
          wllamaMessages.push({ role: m.role, content });
        } else {
          const parts: any[] = [];
          for (const p of m.content) {
            if (p.type === 'text') {
              parts.push({ type: 'text', text: p.text });
            } else if (p.type === 'image_url') {
              const buf = await dataUrlToArrayBuffer(p.image_url.url);
              parts.push({ type: 'image', data: buf });
            }
          }
          wllamaMessages.push({ role: m.role, content: parts });
        }
      }

      console.log('[wllama] 视觉请求，共', wllamaMessages.length, '条消息');

      let result: any;
      try {
        // Qwen3 系列原生开关：关闭思考模式
        result = await wllama.createChatCompletion({
          messages: wllamaMessages,
          max_tokens: 2048,
          temperature: 0.3,
          top_p: 0.9,
          chat_template_kwargs: { enable_thinking: false },
        });
      } catch (e) {
        // 模型的 chat template 不认 enable_thinking 时兜底重试
        console.warn('[wllama] enable_thinking 不被支持，重试：', e);
        result = await wllama.createChatCompletion({
          messages: wllamaMessages,
          max_tokens: 2048,
          temperature: 0.3,
          top_p: 0.9,
        });
      }

      const raw: string = result.choices?.[0]?.message?.content ?? '';
      const cleaned = cleanOutput(raw);
      console.log('[wllama] 原始输出:', raw.slice(0, 300));
      console.log('[wllama] 清理后:', cleaned.slice(0, 300));
      return cleaned;
    }

    // ---- 纯文本：手动 ChatML 模板（比 createChatCompletion 更可控）----
    const wllamaMessages = messages.map((m) => {
      let content = typeof m.content === 'string'
        ? m.content
        : m.content.filter((p) => p.type === 'text').map((p) => p.text).join('\n');
      // 系统提示词末尾加 /no_think，抑制思考段
      if (m.role === 'system') content = content + '\n\n/no_think';
      return { role: m.role, content };
    });

    console.log('[wllama] 发送 messages，共', wllamaMessages.length, '条');

    const prompt = wllamaMessages
      .map((m) => `<|im_start|>${m.role}\n${m.content}<|im_end|>`)
      .join('\n') + '\n<|im_start|>assistant\n';

    let result = '';
    try {
      // 3.8.1 签名：createCompletion(options) → { choices: [{ text }] }
      // （旧版是 createCompletion(prompt, options)，3.8.1 改为单对象参数）
      const res = await wllama.createCompletion({
        prompt,
        max_tokens: 1500,
        stop: ['<|im_end|>', '<|im_start|>'],
        temp: 0.2,
        top_p: 0.9,
        top_k: 40,
        penalty_repeat: 1.05,
      });
      result = res.choices?.[0]?.text ?? '';
    } catch (e) {
      console.error('[wllama] 生成失败:', e);
      throw e;
    }

    const cleaned = cleanOutput(result);
    console.log('[wllama] 原始输出:', result.slice(0, 300));
    console.log('[wllama] 清理后:', cleaned.slice(0, 300));
    return cleaned;
  }
}

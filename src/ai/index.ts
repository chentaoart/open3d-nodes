import type { AIProvider, AIConfig, AIMessage } from './provider';
import { OpenAICompatibleProvider } from './providers/openaiCompatible';
import { WllamaProvider } from './providers/wllama';
import { RuleBasedProvider } from './providers/ruleBased';
import {
  buildSystemPrompt, buildVisionPrompt, buildMultiViewPrompt,
  buildTutorPrompt, buildChatPrompt, buildSceneAnalysisPrompt,
} from './prompt';
import { getPreset, configSupportsVision } from './presets';
import { detectIntent } from './intent';
import type { Graph } from '../core/types';
import type { AIAction, VoxelStrokesData } from './actions';

export { configSupportsVision };

export function createProvider(config: AIConfig): AIProvider {
  const preset = getPreset(config.provider);
  if (!preset || preset.id === 'rule') return new RuleBasedProvider();

  if (preset.id === 'wllama') {
    return new WllamaProvider({
      file: config.model ?? preset.defaultModel ?? 'Qwen3.5-4B-Q4_K_M.gguf',
      mmprojFile: config.mmprojFile ?? preset.defaultMmproj ?? '',
    });
  }

  return new OpenAICompatibleProvider({
    name: preset.name,
    baseUrl: config.baseUrl ?? preset.baseUrl ?? '',
    apiKey: config.apiKey ?? '',
    model: config.model ?? preset.defaultModel ?? '',
    visionModels: preset.visionModels,
    vision: preset.vision,
  });
}

export interface AIResult {
  nodes: { id: string; type: string; params: Record<string, unknown> }[];
  links: { from: string; fromPort: string; to: string; toPort: string }[];
  updates?: { id: string; params: Record<string, unknown> }[];
  actions?: AIAction[];
  chatReply?: string;
  mode?: 'lathe' | 'sdf' | 'unknown';
  lathe?: { profile: [number, number][]; segments?: number; color?: string };
  strokes?: VoxelStrokesData['strokes'];
  smooth?: number;
  size?: number;
  color?: string;
  subject?: string;
  observation?: string;
  next?: string;
  done?: boolean;
  memory?: string;
  wrapAsGroup?: boolean;
  groupName?: string;
  error?: string;
  raw: string;
  via: string;
}

/**
 * 连接检测：
 * - 本地服务（strata/lmstudio/llamacpp/vllm）：查 /v1/models（秒回）
 * - 云 API（智谱/openai/deepseek 等）：发最小 chat 请求（max_tokens=1）
 */
export async function pingAI(config: AIConfig): Promise<{ ok: boolean; error?: string }> {
  const preset = getPreset(config.provider);
  if (!preset || preset.id === 'rule') return { ok: true };
  if (preset.id === 'wllama') return { ok: true };
  if (preset.needsKey && !config.apiKey) return { ok: false, error: '未填 API Key' };

  const baseUrl = (config.baseUrl ?? preset.baseUrl ?? '').replace(/\/$/, '');
  const isZhipu = baseUrl.includes('/api/paas/v4');
  const isLocal =
    baseUrl.startsWith('/proxy/strata') ||
    baseUrl.startsWith('/proxy/lmstudio') ||
    baseUrl.startsWith('/proxy/llamacpp') ||
    baseUrl.startsWith('/proxy/vllm');

  if (isLocal) {
    const url = `${baseUrl}/v1/models`;
    console.log('[ping] GET', url);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.ok) return { ok: true };
      return { ok: false, error: `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  const chatUrl = isZhipu
    ? `${baseUrl}/chat/completions`
    : `${baseUrl}/v1/chat/completions`;

  console.log('[ping] POST', chatUrl);

  try {
    const res = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model ?? preset.defaultModel,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (res.ok) return { ok: true };

    const text = await res.text();
    if (res.status === 401) return { ok: false, error: '401 未授权：API Key 错误或为空' };
    if (res.status === 404) return { ok: false, error: `404：模型名 "${config.model ?? preset.defaultModel}" 不存在` };
    return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 100)}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function trimHistory(
  history: { role: 'user' | 'assistant'; content: string }[]
): { role: 'user' | 'assistant'; content: string }[] {
  return history
    .filter((h) => !/^\s*[✓✔❌]/.test(h.content))
    .slice(-4)
    .map((h) => ({
      role: h.role,
      content: h.content.length > 300 ? h.content.slice(0, 300) + '…' : h.content,
    }));
}

export async function askAI(
  config: AIConfig,
  userText: string,
  scene: Graph,
  history: { role: 'user' | 'assistant'; content: string }[],
  memory?: string,
  selectedNodeId?: string | null
): Promise<AIResult> {
  const intent = detectIntent(userText);
  console.log('[askAI] 意图：', intent, '输入：', userText, '选中：', selectedNodeId);

  const errors: string[] = [];
  const trimmed = trimHistory(history);

  const tryProvider = async (p: AIProvider): Promise<AIResult | null> => {
    try {
      let messages: AIMessage[];

      if (intent === 'chat') {
        messages = [
          { role: 'system', content: buildChatPrompt(scene) },
          ...trimmed,
          { role: 'user', content: userText },
        ];
        const raw = await p.chat(messages);
        let text = raw.trim();
        text = stripThink(text);
        text = text.replace(/```[\s\S]*?```/g, '').trim();
        const bs = text.indexOf('{');
        const be = text.lastIndexOf('}');
        if (bs >= 0 && be > bs) {
          text = [text.slice(0, bs).trim(), text.slice(be + 1).trim()].filter(Boolean).join('\n').trim();
        }
        text = text.replace(/^(你|assistant|AI|助手)[：:]\s*/i, '').trim();
        text = text.replace(/^\[已执行操作\]\s*[✓✔]?\s*[^\n]*\n?/, '').trim();

        if (!text || text.length < 2) {
          text = smartFallback(userText, scene);
        }

        return { nodes: [], links: [], chatReply: text, raw, via: p.name };
      }

      messages = [
        { role: 'system', content: buildSystemPrompt(scene, memory, selectedNodeId) },
        ...trimmed,
        { role: 'user', content: userText },
      ];
      const raw = await p.chat(messages);
      const parsed = parseAIJson(raw);
      const isEmpty = (r: Omit<AIResult, 'raw' | 'via'>) =>
        !r.nodes.length && !r.updates?.length && !r.actions?.length && !r.mode && !r.strokes?.length;
      if (isEmpty(parsed) && p.name !== '规则模式') {
        // 小模型常把"指令"当成聊天只回一句话：带上提醒再试一次
        const retry = await p.chat([
          ...messages,
          { role: 'assistant', content: raw },
          { role: 'user', content: `你刚才没有输出 JSON。请按系统提示把"${userText}"转成 JSON 执行，只输出 JSON，id 必须取自场景清单。` },
        ]);
        const second = parseAIJson(retry);
        if (!isEmpty(second)) return { ...second, raw: retry, via: p.name };
      }
      return { ...parsed, raw, via: p.name };
    } catch (e) {
      errors.push(`${p.name}: ${(e as Error).message}`);
      return null;
    }
  };

  const main = createProvider(config);
  const mainResult = await tryProvider(main);
  if (mainResult) return mainResult;

  if (config.fallbackToRule !== false) {
    const rule = new RuleBasedProvider();
    const ruleResult = await tryProvider(rule);
    if (ruleResult) {
      ruleResult.via = `${ruleResult.via}（降级）`;
      return ruleResult;
    }
  }

  throw new Error(`所有 AI 通道失败：${errors.join('; ')}`);
}

export async function askSceneAnalysis(
  config: AIConfig,
  scene: Graph
): Promise<string> {
  const preset = getPreset(config.provider);
  if (!preset || preset.id === 'rule') {
    return '规则模式不支持场景分析。请切换到本地大模型或外部 API。';
  }

  const provider = createProvider(config);
  try {
    const raw = await provider.chat([
      { role: 'system', content: buildSceneAnalysisPrompt(scene) },
      { role: 'user', content: '分析一下' },
    ]);
    let text = raw.trim();
    text = text.replace(/^["'""]|["'""]$/g, '').trim();
    text = text.replace(/^分析[：:]\s*/, '');
    return text || '场景看起来还可以。试试加点灯光，或者换换材质。';
  } catch (e) {
    return `分析失败：${(e as Error).message}`;
  }
}

function smartFallback(userText: string, scene: Graph): string {
  const t = userText.toLowerCase();
  const n = scene.nodes.length;

  if (/你好|hi|hello|嗨|哈喽/.test(t)) return '你好，我是 3D 建模助手。你可以让我做花瓶、椅子、桌子、金属茶壶。';
  if (/能做什么|会什么|功能|怎么用/.test(t)) return '我能根据描述生成 3D 模型。试试"做一把椅子"或"做一个金属花瓶"。';
  if (/怎么样|好不好|如何|评价/.test(t)) return n > 0 ? `当前有 ${n} 个节点。你想改成什么样？` : '场景是空的。试试"做一个花瓶"。';
  if (/谢谢|感谢/.test(t)) return '不客气。';
  return '我在。试试"做一把椅子"或"做一个金属花瓶"。';
}

export async function askAIWithImage(
  config: AIConfig,
  userText: string,
  imageDataUrl: string,
  scene: Graph,
  goal: string,
  round: number
): Promise<AIResult> {
  const preset = getPreset(config.provider);
  if (!configSupportsVision(config)) {
    throw new Error(`当前通道不支持图片。`);
  }

  const provider = createProvider(config);
  const messages: AIMessage[] = [
    { role: 'system', content: buildVisionPrompt(scene, goal, round) },
    {
      role: 'user',
      content: [
        { type: 'text', text: userText || '看这张图' },
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ],
    },
  ];

  const raw = await provider.chat(messages);
  return { ...parseAIJson(raw), raw, via: provider.name };
}

export async function askAIMultiView(
  config: AIConfig,
  images: { data: string; label: string }[],
  goal: string
): Promise<AIResult> {
  const preset = getPreset(config.provider);
  if (!configSupportsVision(config)) {
    throw new Error(`当前通道不支持图片。`);
  }

  const provider = createProvider(config);
  const content: any[] = [
    { type: 'text', text: `共 ${images.length} 张图。目标：${goal || '生成 3D 模型'}` },
  ];
  for (const img of images) {
    content.push({ type: 'image_url', image_url: { url: img.data } });
  }

  const messages: AIMessage[] = [
    { role: 'system', content: buildMultiViewPrompt(images.map((i) => ({ label: i.label })), goal) },
    { role: 'user', content },
  ];

  const raw = await provider.chat(messages);
  return { ...parseAIJson(raw), raw, via: provider.name };
}

export async function askTutorSuggestion(
  config: AIConfig,
  scene: Graph
): Promise<string> {
  const preset = getPreset(config.provider);
  if (!preset || preset.id === 'rule') return ruleTutor(scene);

  const provider = createProvider(config);
  try {
    const raw = await provider.chat([
      { role: 'system', content: buildTutorPrompt(scene) },
      { role: 'user', content: '建议' },
    ]);
    let text = raw.trim();
    text = text.replace(/^["'""]|["'""]$/g, '').trim();
    text = text.replace(/^(建议|回答|输出)[：:]\s*/, '');
    if (text.length > 80) text = text.slice(0, 80) + '…';
    return text || ruleTutor(scene);
  } catch {
    return ruleTutor(scene);
  }
}

function ruleTutor(scene: Graph): string {
  const n = scene.nodes.length;
  if (n <= 2) return '在 AI 输入框里说"加一个花瓶"，试试看。';
  return '试试右上角"导出 OBJ"，把模型带进其他软件。';
}

function stripThink(t: string): string {
  return t
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/i, '')
    .replace(/<\/?think>/gi, '')
    .trim();
}

/** 修复小模型常见的 JSON 毛病：尾逗号、被截断（按括号栈补全）。 */
function repairJson(src: string): any | null {
  const t = src.replace(/,\s*([}\]])/g, '$1');
  try { return JSON.parse(t); } catch { /* continue */ }

  const scan = (str: string) => {
    const stack: string[] = [];
    let inStr = false, esc = false, lastClose = -1;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '{') stack.push('}');
      else if (ch === '[') stack.push(']');
      else if (ch === '}' || ch === ']') { stack.pop(); lastClose = i; }
    }
    return { stack, lastClose };
  };

  const { lastClose } = scan(t);
  if (lastClose < 0) return null;
  const head = t.slice(0, lastClose + 1).replace(/,\s*$/, '');
  const { stack } = scan(head);
  const fixed = (head + stack.reverse().join('')).replace(/,\s*([}\]])/g, '$1');
  try { return JSON.parse(fixed); } catch { return null; }
}

function extractJson(raw: string): any | null {
  let text = stripThink(raw);
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  const start = text.indexOf('{');
  if (start < 0) return null;
  const end = text.lastIndexOf('}');
  if (end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* try repair */ }
  }
  return repairJson(text.slice(start));
}

function parseAIJson(raw: string): Omit<AIResult, 'raw' | 'via'> {
  const obj = extractJson(raw);

  if (obj) {
    // ★ 加了 wrapAsGroup 作为有效内容判断
    const hasRealContent =
      obj.wrapAsGroup === true ||
      (Array.isArray(obj.nodes) && obj.nodes.length > 0) ||
      (Array.isArray(obj.updates) && obj.updates.length > 0) ||
      (Array.isArray(obj.actions) && obj.actions.length > 0) ||
      obj.mode === 'lathe' || obj.mode === 'sdf' ||
      (Array.isArray(obj.strokes) && obj.strokes.length > 0) ||
      (obj.lathe && Array.isArray(obj.lathe.profile) && obj.lathe.profile.length > 0);

    if (hasRealContent) {
      return {
        nodes: Array.isArray(obj.nodes) ? obj.nodes : [],
        links: Array.isArray(obj.links) ? obj.links : [],
        updates: Array.isArray(obj.updates) ? obj.updates : undefined,
        actions: Array.isArray(obj.actions) ? obj.actions : undefined,
        mode: obj.mode,
        lathe: obj.lathe,
        strokes: Array.isArray(obj.strokes) ? obj.strokes : undefined,
        smooth: typeof obj.smooth === 'number' ? obj.smooth : undefined,
        size: typeof obj.size === 'number' ? obj.size : undefined,
        color: typeof obj.color === 'string' ? obj.color : undefined,
        subject: typeof obj.subject === 'string' ? obj.subject : undefined,
        observation: typeof obj.observation === 'string' ? obj.observation : undefined,
        next: typeof obj.next === 'string' ? obj.next : undefined,
        done: obj.done === true,
        memory: typeof obj.memory === 'string' ? obj.memory : undefined,
        wrapAsGroup: obj.wrapAsGroup === true,
        groupName: typeof obj.groupName === 'string' ? obj.groupName : undefined,
        error: typeof obj.error === 'string' ? obj.error : undefined,
      };
    }
  }

  let chatText = raw.trim();
  const start = chatText.indexOf('{');
  const end = chatText.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const before = chatText.slice(0, start).trim();
    const after = chatText.slice(end + 1).trim();
    chatText = [before, after].filter(Boolean).join('\n').trim();
  }
  chatText = stripThink(chatText);
  chatText = chatText.replace(/```[\s\S]*?```/g, '').trim();
  chatText = chatText.replace(/^(你|assistant|AI|助手)[：:]\s*/i, '').trim();
  chatText = chatText.replace(/^\[已执行操作\]\s*[✓✔]?\s*[^\n]*\n?/, '').trim();

  if (!chatText || chatText.length < 2) {
    chatText = '我在。试试"做一把椅子"或"做一个金属花瓶"。';
  }

  return { nodes: [], links: [], chatReply: chatText };
}
import type { ProviderPreset } from './provider';

export const PRESETS: ProviderPreset[] = [
  {
    id: 'rule',
    name: '规则模式（无 AI）',
    local: true,
    needsKey: false,
    vision: false,
  },
  {
    id: 'strata',
    name: '本地大模型（Strata Lite / LM Studio）',
    local: true,
    needsKey: false,
    baseUrl: '/proxy/strata',
    defaultModel: 'strata-lite',
    vision: true,
  },
  {
    id: 'wllama',
    name: '浏览器内 GGUF（4B，较慢）',
    local: true,
    needsKey: false,
    defaultModel: 'Qwen3.5-4B-Q4_K_M.gguf',
    defaultMmproj: 'mmproj-F16.gguf',
    vision: true,
  },
  {
    id: 'zhipu',
    name: '智谱 GLM-4-Flash（免费）',
    local: false,
    needsKey: true,
    baseUrl: '/proxy/zhipu/api/paas/v4',
    defaultModel: 'glm-4-flash',
    visionModels: ['glm-4.6v-flash', 'glm-4v-flash'],
    models: ['glm-4-flash', 'glm-4.6v-flash', 'glm-4v-flash', 'glm-4-plus'],
    vision: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek（很便宜）',
    local: false,
    needsKey: true,
    baseUrl: '/proxy/deepseek',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat'],
    vision: false,
  },
  {
    id: 'moonshot',
    name: 'Kimi',
    local: false,
    needsKey: true,
    baseUrl: '/proxy/moonshot',
    defaultModel: 'moonshot-v1-8k',
    visionModels: ['moonshot-v1-8k-vision-preview'],
    models: ['moonshot-v1-8k', 'moonshot-v1-8k-vision-preview'],
    vision: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    local: false,
    needsKey: true,
    baseUrl: '/proxy/openai',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o'],
    vision: true,
  },
  {
    id: 'custom',
    name: '自定义（OpenAI 兼容）',
    local: false,
    needsKey: false,
    vision: true,
  },
];

export function getPreset(id: string): ProviderPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export function configSupportsVision(config: { provider: string; mmprojFile?: string }): boolean {
  const p = getPreset(config.provider);
  if (p?.id === 'wllama') return !!config.mmprojFile;
  return p?.vision === true;
}
/** AI 消息内容分段（OpenAI 兼容格式，image_url 为 dataURL） */
export type AIMessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

/** 一条对话消息：content 为字符串或分段数组（含图片时） */
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | AIMessageContentPart[];
}

/** AI 通道统一接口，所有 provider 实现此类 */
export interface AIProvider {
  readonly name: string;
  readonly vision: boolean;
  chat(messages: AIMessage[]): Promise<string>;
}

/** 用户 AI 配置（localStorage 'ai-config' 持久化） */
export interface AIConfig {
  /** presets.ts 里的通道 id */
  provider: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  /** wllama 专用：视觉投影 GGUF 文件名 */
  mmprojFile?: string;
  /** 主通道失败时是否降级到规则模式，默认 true */
  fallbackToRule?: boolean;
}

/** 内置通道预置（presets.ts） */
export interface ProviderPreset {
  id: string;
  name: string;
  /** 本地运行，无需联网 */
  local: boolean;
  needsKey: boolean;
  /** 该通道是否支持图片输入 */
  vision: boolean;
  baseUrl?: string;
  defaultModel?: string;
  /** 请求里带图片时自动改用的视觉模型（按顺序尝试），文字请求仍用 defaultModel */
  visionModels?: string[];
  defaultMmproj?: string;
  /** 设置面板下拉可选的模型名 */
  models?: string[];
}

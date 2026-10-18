import type { AIProvider, AIMessage } from '../provider';
import { LATHE_PRESETS } from '../../nodes/lathe';

export class RuleBasedProvider implements AIProvider {
  name = '规则模式';
  vision = false;

  async chat(messages: AIMessage[]): Promise<string> {
    const userMsg = [...messages].reverse().find((m) => m.role === 'user')?.content;
    const text = typeof userMsg === 'string' ? userMsg : '';

    const nodes: unknown[] = [];
    let id = 1;

    let preset: keyof typeof LATHE_PRESETS | null = null;
    if (/花瓶/.test(text)) preset = 'vase';
    else if (/杯子|杯/.test(text)) preset = 'cup';
    else if (/碗/.test(text)) preset = 'bowl';
    else if (/瓶子|瓶/.test(text)) preset = 'bottle';
    else if (/灯罩|台灯/.test(text)) preset = 'lamp';

    if (preset) {
      const p = LATHE_PRESETS[preset];
      const color = /红/.test(text) ? '#ff5555'
        : /蓝/.test(text) ? '#a8d8ff'
        : /绿/.test(text) ? '#4dd699'
        : /黑/.test(text) ? '#333333'
        : /白/.test(text) ? '#f0f0f0'
        : '#a8d8ff';

      nodes.push({
        id: `n${id++}`,
        type: 'lathe',
        params: {
          profile: JSON.stringify(p.profile),
          segments: 48, color,
          ox: 0, oy: 0, oz: 0,
        },
      });
    } else if (/球/.test(text)) {
      nodes.push({
        id: `n${id++}`, type: 'sphere',
        params: { radius: 0.6, color: /红/.test(text) ? '#ff3333' : '#ff7a59', ox: 0, oy: 0, oz: 0 },
      });
    } else if (/圆柱|柱子/.test(text)) {
      nodes.push({
        id: `n${id++}`, type: 'cylinder',
        params: { topR: 0.5, bottomR: 0.6, height: 1.8, segments: 32, color: /红/.test(text) ? '#ff5555' : '#9b6bff', ox: 0, oy: 0, oz: 0 },
      });
    } else if (/立方|方块|盒子/.test(text)) {
      nodes.push({
        id: `n${id++}`, type: 'box',
        params: { width: 1, height: 1, depth: 1, color: /红/.test(text) ? '#ff3333' : '#4f8cff', ox: 0, oy: 0, oz: 0 },
      });
    }

    return JSON.stringify({ nodes, links: [] });
  }
}
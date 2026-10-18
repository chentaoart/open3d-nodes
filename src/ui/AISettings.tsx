import { useState, useEffect } from 'react';
import type { AIConfig } from '../ai/provider';
import { PRESETS, getPreset } from '../ai/presets';
import { onWllamaProgress, type LoadProgress } from '../ai/providers/wllama';

interface Props {
  config: AIConfig;
  onChange: (c: AIConfig) => void;
}

export function AISettings({ config, onChange }: Props) {
  const [local, setLocal] = useState<AIConfig>(config);
  const [progress, setProgress] = useState<LoadProgress | null>(null);

  useEffect(() => {
    localStorage.setItem('ai-config', JSON.stringify(local));
    onChange(local);
  }, [local, onChange]);

  useEffect(() => {
    const off = onWllamaProgress((p) => {
      setProgress(p);
      if (p.percent >= 1) setTimeout(() => setProgress(null), 2500);
    });
    return off;
  }, []);

  const preset = getPreset(local.provider);
  const isWllama = preset?.id === 'wllama';

  return (
    <div style={{ padding: 12, fontSize: 12, background: '#16181d', borderTop: '1px solid #2a2f3a' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: '#b8bfcc', fontWeight: 600, flex: 1 }}>AI 大脑</span>
        <span style={{
          fontSize: 10, padding: '2px 6px', borderRadius: 3,
          background: preset?.local ? '#1e3a2e' : '#3a1e2e',
          color: preset?.local ? '#6c6' : '#f99',
        }}>
          {preset?.local ? '本地' : '外部'}
        </span>
      </div>

      <select
        value={local.provider}
        onChange={(e) => {
          const p = getPreset(e.target.value);
          setLocal({
            ...local,
            provider: e.target.value,
            baseUrl: p?.baseUrl,
            model: p?.defaultModel,
            mmprojFile: p?.defaultMmproj,
            apiKey: '',
          });
        }}
        style={sel}
      >
        <optgroup label="本地（无需联网）">
          {PRESETS.filter((p) => p.local).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </optgroup>
        <optgroup label="外部 API（需要 Key）">
          {PRESETS.filter((p) => !p.local).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </optgroup>
      </select>

      {preset?.needsKey && (
        <input
          placeholder="API Key"
          type="password"
          value={local.apiKey ?? ''}
          onChange={(e) => setLocal({ ...local, apiKey: e.target.value })}
          style={inp}
        />
      )}

      {preset && preset.id !== 'rule' && (
        <input
          placeholder="模型名 / 文件名"
          value={local.model ?? ''}
          onChange={(e) => setLocal({ ...local, model: e.target.value })}
          style={inp}
        />
      )}

      {isWllama && (
        <>
          <input
            placeholder="视觉投影文件（mmproj.gguf）"
            value={local.mmprojFile ?? ''}
            onChange={(e) => setLocal({ ...local, mmprojFile: e.target.value })}
            style={inp}
          />

          <div style={{
            fontSize: 10, color: '#7a8292', marginTop: 8,
            padding: 8, background: '#1a1d24', borderRadius: 5, lineHeight: 1.6,
          }}>
            把 GGUF 文件放到：<br />
            <code style={{ color: '#a97aff' }}>public/models/{local.model || 'Qwen3.5-4B-Q4_K_M.gguf'}</code><br />
                        <code style={{ color: '#a97aff' }}>public/models/{local.mmprojFile || 'mmproj-F16.gguf'}</code><br />
            <span style={{ color: '#4dd699' }}>✓ 有 mmproj 文件时，本地模型支持看图迭代、参考图、视频生 3D</span>
          </div>
        </>
      )}

      {progress && (
        <div style={{
          marginTop: 8, padding: 8, background: '#1a1d24',
          border: '1px solid #2a2f3a', borderRadius: 5, fontSize: 11, color: '#b8bfcc',
        }}>
          <div style={{ marginBottom: 4 }}>{progress.text}</div>
          <div style={{ height: 4, background: '#2a2f3a', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${(progress.percent * 100).toFixed(0)}%`,
              background: 'linear-gradient(90deg, #3a5bff, #5b8cff)',
              transition: 'width 0.3s',
            }} />
          </div>
        </div>
      )}

      <div style={{ color: '#4d5460', fontSize: 10, marginTop: 8 }}>
        Key 只存浏览器本地，不上传。
      </div>
    </div>
  );
}

const sel: React.CSSProperties = {
  width: '100%', background: '#242832', color: '#eef1f6',
  border: '1px solid #2a2f3a', padding: '6px 10px',
  borderRadius: 5, marginBottom: 6, fontSize: 12,
};

const inp: React.CSSProperties = {
  width: '100%', background: '#1e2129', color: '#eef1f6',
  border: '1px solid #2a2f3a', padding: '6px 10px',
  borderRadius: 5, marginTop: 6, fontSize: 12, outline: 'none',
};
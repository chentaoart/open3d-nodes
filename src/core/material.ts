export interface MaterialPreset {
  label: string;
  metalness: number;
  roughness: number;
  opacity?: number;
  emissiveIntensity?: number;
}

export const MATERIAL_PRESETS: Record<string, MaterialPreset> = {
  matte:    { label: '哑光',   metalness: 0.0,  roughness: 0.9  },
  plastic:  { label: '塑料',   metalness: 0.0,  roughness: 0.4  },
  ceramic:  { label: '陶瓷',   metalness: 0.05, roughness: 0.2  },
  metal:    { label: '金属',   metalness: 0.9,  roughness: 0.25 },
  chrome:   { label: '镜面',   metalness: 1.0,  roughness: 0.05 },
  glass:    { label: '玻璃',   metalness: 0.0,  roughness: 0.05, opacity: 0.35 },
  rubber:   { label: '橡胶',   metalness: 0.0,  roughness: 1.0  },
  wood:     { label: '木头',   metalness: 0.0,  roughness: 0.6  },
  gold:     { label: '黄金',   metalness: 1.0,  roughness: 0.2  },
  copper:   { label: '铜',     metalness: 1.0,  roughness: 0.35 },
  stone:    { label: '石头',   metalness: 0.0,  roughness: 0.95 },
  fabric:   { label: '布料',   metalness: 0.0,  roughness: 0.85 },
};

export const MATERIAL_OPTIONS = Object.entries(MATERIAL_PRESETS).map(([value, p]) => ({
  value,
  label: p.label,
}));

export function getMaterial(name: string | undefined): MaterialPreset {
  return MATERIAL_PRESETS[name ?? 'matte'] ?? MATERIAL_PRESETS.matte;
}
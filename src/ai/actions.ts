export type AIAction =
  | { type: 'delete'; targets: string[] }
  | { type: 'duplicate'; target: string; offset?: [number, number, number]; count?: number };

export interface VoxelStroke {
  type: 'sphere' | 'capsule' | 'box';
  at?: [number, number, number];
  from?: [number, number, number];
  to?: [number, number, number];
  r?: number;
  size?: [number, number, number];
}

export interface VoxelStrokesData {
  strokes: VoxelStroke[];
  smooth: number;
  resolution: number;
  size: number;
  voxelPreview?: boolean;
}
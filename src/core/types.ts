import type * as THREE from 'three';

export type DataType = 'mesh' | 'sdf' | 'number' | 'string' | 'color';

export interface PortSpec {
  name: string;
  label?: string;
  type: DataType;
}

export interface ParamSpec {
  name: string;
  label?: string;
  type: 'number' | 'string' | 'color' | 'file' | 'enum';
  default: unknown;
  min?: number;
  max?: number;
  step?: number;
  accept?: string;
  options?: { value: string; label: string }[];
}

export interface Mesh3D {
  geometry: THREE.BufferGeometry;
  color?: string;
  material?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  __nodeId?: string;
}

export interface Light3D {
  kind: 'ambient' | 'directional' | 'point';
  color: string;
  intensity: number;
  position?: [number, number, number];
  target?: [number, number, number];
  __nodeId?: string;
}

export interface Camera3D {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  __nodeId?: string;
}

export interface NodeDefinition {
  type: string;
  label: string;
  category: string;
  inputs: PortSpec[];
  outputs: PortSpec[];
  params: ParamSpec[];
  execute: (
    inputs: Record<string, unknown>,
    params: Record<string, unknown>
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
}

export interface GraphNode {
  id: string;
  type: string;
  params: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface GraphLink {
  id: string;
  from: { node: string; port: string };
  to: { node: string; port: string };
}

export interface Graph {
  nodes: GraphNode[];
  links: GraphLink[];
}
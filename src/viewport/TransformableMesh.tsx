import { useRef, useState } from 'react';
import * as THREE from 'three';
import { TransformControls } from '@react-three/drei';
import type { Mesh3D } from '../core/types';

interface Props {
  mesh: Mesh3D;
  selected: boolean;
  onSelect: () => void;
  onTransform: (t: {
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
  }) => void;
}

export function TransformableMesh({ mesh, selected, onSelect, onTransform }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [mode, setMode] = useState<'translate' | 'rotate' | 'scale'>('translate');

  const body = (
    <mesh
      ref={meshRef}
      geometry={mesh.geometry}
      position={mesh.position ?? [0, 0, 0]}
      rotation={mesh.rotation ?? [0, 0, 0]}
      scale={mesh.scale ?? [1, 1, 1]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      castShadow
    >
      <meshStandardMaterial
        color={mesh.color ?? '#cccccc'}
        metalness={0.1}
        roughness={0.6}
        emissive={selected ? '#5b8cff' : '#000000'}
        emissiveIntensity={selected ? 0.3 : 0}
      />
    </mesh>
  );

  if (!selected) return body;

  return (
    <>
      <TransformControls
        mode={mode}
        onMouseUp={() => {
          const obj = meshRef.current;
          if (!obj) return;
          onTransform({
            position: [obj.position.x, obj.position.y, obj.position.z],
            rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
            scale: [obj.scale.x, obj.scale.y, obj.scale.z],
          });
        }}
      >
        {body}
      </TransformControls>

      {/* 模式切换按钮，固定屏幕右下 */}
      <group />
      {/* 实际按钮用 DOM 叠加实现，放在 Viewport 里 */}
    </>
  );
}
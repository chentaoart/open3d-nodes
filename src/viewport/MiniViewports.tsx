import { Canvas } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import type { Mesh3D } from '../core/types';

type MiniView = 'top' | 'front' | 'side';

function MiniMesh({ mesh }: { mesh: Mesh3D }) {
  return (
    <mesh
      geometry={mesh.geometry}
      position={mesh.position ?? [0, 0, 0]}
      rotation={mesh.rotation ?? [0, 0, 0]}
      scale={mesh.scale ?? [1, 1, 1]}
    >
      <meshStandardMaterial
        color={mesh.color ?? '#cccccc'}
        metalness={0.1}
        roughness={0.6}
      />
    </mesh>
  );
}

function MiniCanvas({
  meshes, view, size = 70,
}: {
  meshes: Mesh3D[];
  view: MiniView;
  size?: number;
}) {
  const cameraConfig = (() => {
    if (view === 'top') return { position: [0, 10, 0] as [number, number, number], zoom: 25 };
    if (view === 'front') return { position: [0, 0, 10] as [number, number, number], zoom: 25 };
    return { position: [10, 0, 0] as [number, number, number], zoom: 25 };
  })();

  const up = view === 'top'
    ? [0, 0, -1] as [number, number, number]
    : [0, 1, 0] as [number, number, number];

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <Canvas
        orthographic
        camera={{ ...cameraConfig, up, near: -100, far: 100 }}
        gl={{ antialias: false, alpha: false, preserveDrawingBuffer: false }}
        dpr={1}
        frameloop="demand"
      >
        <color attach="background" args={['#12141a']} />
        <ambientLight intensity={1} />
        <directionalLight position={[5, 10, 7]} intensity={1.2} />
        {meshes.map((m, i) => (
          <MiniMesh key={i} mesh={m} />
        ))}
      </Canvas>
      <div style={{
        position: 'absolute',
        bottom: 2,
        right: 4,
        fontSize: 9,
        color: '#7a8292',
        pointerEvents: 'none',
        fontFamily: 'monospace',
      }}>
        {view === 'top' ? '顶' : view === 'front' ? '正' : '侧'}
      </div>
    </div>
  );
}

export function MiniViewports({ meshes }: { meshes: Mesh3D[] }) {
  // 延迟挂载，避免和主 Canvas 抢 WebGL context
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 400);
    return () => clearTimeout(t);
  }, []);

  if (!ready) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 12,
      right: 12,
      display: 'flex',
      gap: 4,
      padding: 4,
      background: 'rgba(20,22,28,0.85)',
      backdropFilter: 'blur(8px)',
      border: '1px solid #2a2f3a',
      borderRadius: 8,
      zIndex: 10,
      pointerEvents: 'none',
    }}>
      <MiniCanvas meshes={meshes} view="top" />
      <MiniCanvas meshes={meshes} view="front" />
      <MiniCanvas meshes={meshes} view="side" />
    </div>
  );
}
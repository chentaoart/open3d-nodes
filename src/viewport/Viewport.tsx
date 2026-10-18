import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, TransformControls, Environment } from '@react-three/drei';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ContextMenu, type MenuItem } from '../ui/ContextMenu';
import { MiniViewports } from './MiniViewports';
import { PositionPanel } from './PositionPanel';
import { getMaterial } from '../core/material';
import type { Mesh3D, Light3D, Camera3D } from '../core/types';

export interface TransformData {
  deltaPos?: [number, number, number];
  deltaRot?: [number, number, number];
  deltaScale?: [number, number, number];
}

type TransformMode = 'translate' | 'rotate' | 'scale';

interface Props {
  meshes: Mesh3D[];
  lights: Light3D[];
  cameras: Camera3D[];
  selectedMeshNodeId: string | null;
  onSelectMesh: (nodeId: string | null) => void;
  onTransformMesh: (nodeId: string, data: TransformData) => void;
  onDuplicateMesh?: (nodeId: string) => void;
  onDeleteMesh?: (nodeId: string) => void;
  onExportFormat?: (format: 'obj' | 'gltf' | 'stl') => void;
  onIsTransformingChange?: (v: boolean) => void;
  selectedPosition?: { x: number; y: number; z: number } | null;
  onPositionChange?: (x: number, y: number, z: number) => void;
}

function TransformableMesh({
  mesh, selected, onSelect, onTransform, mode, onIsTransforming,
}: {
  mesh: Mesh3D;
  selected: boolean;
  onSelect: () => void;
  onTransform: (data: TransformData) => void;
  mode: TransformMode;
  onIsTransforming?: (v: boolean) => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const startPos = useRef<THREE.Vector3 | null>(null);
  const startRot = useRef<THREE.Euler | null>(null);
  const startScale = useRef<THREE.Vector3 | null>(null);

  const mat = getMaterial(mesh.material);

  return (
    <TransformControls
      enabled={selected}
      mode={mode}
      onMouseDown={() => {
        const obj = ref.current;
        if (!obj) return;
        onIsTransforming?.(true);
        startPos.current = obj.position.clone();
        startRot.current = obj.rotation.clone();
        startScale.current = obj.scale.clone();
      }}
      onMouseUp={() => {
        onIsTransforming?.(false);
        const obj = ref.current;
        if (!obj || !startPos.current || !startRot.current || !startScale.current) return;

        const dp: [number, number, number] = [
          obj.position.x - startPos.current.x,
          obj.position.y - startPos.current.y,
          obj.position.z - startPos.current.z,
        ];
        const dr: [number, number, number] = [
          obj.rotation.x - startRot.current.x,
          obj.rotation.y - startRot.current.y,
          obj.rotation.z - startRot.current.z,
        ];
        const ds: [number, number, number] = [
          startScale.current.x > 0 ? obj.scale.x / startScale.current.x : 1,
          startScale.current.y > 0 ? obj.scale.y / startScale.current.y : 1,
          startScale.current.z > 0 ? obj.scale.z / startScale.current.z : 1,
        ];

        const moved = Math.abs(dp[0]) + Math.abs(dp[1]) + Math.abs(dp[2]) > 1e-4;
        const rotated = Math.abs(dr[0]) + Math.abs(dr[1]) + Math.abs(dr[2]) > 1e-4;
        const scaled = Math.abs(ds[0] - 1) + Math.abs(ds[1] - 1) + Math.abs(ds[2] - 1) > 1e-4;

        const data: TransformData = {};
        if (moved) data.deltaPos = dp;
        if (rotated) data.deltaRot = dr;
        if (scaled) data.deltaScale = ds;

        if (Object.keys(data).length > 0) onTransform(data);

        startPos.current = null;
        startRot.current = null;
        startScale.current = null;
      }}
    >
      <mesh
        ref={ref}
        geometry={mesh.geometry}
        position={mesh.position ?? [0, 0, 0]}
        rotation={mesh.rotation ?? [0, 0, 0]}
        scale={mesh.scale ?? [1, 1, 1]}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        castShadow
      >
        <meshStandardMaterial
          color={mesh.color ?? '#cccccc'}
          metalness={mat.metalness}
          roughness={mat.roughness}
          transparent={mat.opacity !== undefined && mat.opacity < 1}
          opacity={mat.opacity ?? 1}
          emissive={selected ? '#5b8cff' : '#000000'}
          emissiveIntensity={selected ? 0.25 : 0}
        />
      </mesh>
    </TransformControls>
  );
}

function CaptureHelper() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    (window as any).__capture3D = (): string => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL('image/png', 0.85);
    };
    return () => { delete (window as any).__capture3D; };
  }, [gl, scene, camera]);
  return null;
}

/**
 * 相机跳转：通过 OrbitControls 的 ref 设置，不直接改 camera。
 * 直接改 camera 会和 OrbitControls 内部状态打架，导致崩溃。
 */
function CameraController({
  target,
  controlsRef,
}: {
  target: { position: [number, number, number]; lookAt: [number, number, number] } | null;
  controlsRef: React.MutableRefObject<any>;
}) {
  const { camera } = useThree();

  useEffect(() => {
    if (!target) return;
    try {
      const controls = controlsRef.current;
      const px = Number(target.position[0]);
      const py = Number(target.position[1]);
      const pz = Number(target.position[2]);
      const tx = Number(target.lookAt[0]);
      const ty = Number(target.lookAt[1]);
      const tz = Number(target.lookAt[2]);

      // 检查 NaN
      if ([px, py, pz, tx, ty, tz].some((n) => !isFinite(n))) {
        console.warn('[camera] 无效坐标，跳过', target);
        return;
      }

      // 位置和 target 完全重合 → 会导致 lookAt 得到 NaN
      if (
        Math.abs(px - tx) < 1e-6 &&
        Math.abs(py - ty) < 1e-6 &&
        Math.abs(pz - tz) < 1e-6
      ) {
        console.warn('[camera] 位置与目标重合，跳过');
        return;
      }

      camera.position.set(px, py, pz);

      if (controls) {
        controls.target.set(tx, ty, tz);
        controls.update();
      } else {
        camera.lookAt(tx, ty, tz);
      }
    } catch (e) {
      console.error('[camera] 切换失败:', e);
    }
  }, [target, camera, controlsRef]);

  return null;
}

export function Viewport({
  meshes, lights, cameras, selectedMeshNodeId, onSelectMesh, onTransformMesh,
  onDuplicateMesh, onDeleteMesh, onExportFormat, onIsTransformingChange,
  selectedPosition, onPositionChange,
}: Props) {
  const [mode, setMode] = useState<TransformMode>('translate');
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [cameraTarget, setCameraTarget] = useState<{ position: [number, number, number]; lookAt: [number, number, number] } | null>(null);
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      const key = e.key.toLowerCase();
      if (key === 'w') setMode('translate');
      else if (key === 'e') setMode('rotate');
      else if (key === 'r') setMode('scale');
      else if (e.key === 'Escape') onSelectMesh(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSelectMesh]);

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  }

  const hasSelection = selectedMeshNodeId !== null;

  const menuItems: MenuItem[] = [];

  if (hasSelection) {
    menuItems.push(
      { label: '↔ 移动模式', shortcut: 'W', onClick: () => setMode('translate') },
      { label: '↻ 旋转模式', shortcut: 'E', onClick: () => setMode('rotate') },
      { label: '⤢ 缩放模式', shortcut: 'R', onClick: () => setMode('scale') },
      { divider: true, label: '', onClick: () => {} },
      { label: '复制模型', onClick: () => onDuplicateMesh?.(selectedMeshNodeId!) },
      { label: '删除模型', shortcut: 'Del', onClick: () => onDeleteMesh?.(selectedMeshNodeId!) },
      { divider: true, label: '', onClick: () => {} },
    );
  }

  menuItems.push(
    { label: '导出 OBJ', onClick: () => onExportFormat?.('obj') },
    { label: '导出 GLTF/GLB', onClick: () => onExportFormat?.('gltf') },
    { label: '导出 STL', onClick: () => onExportFormat?.('stl') },
  );

  if (hasSelection) {
    menuItems.push(
      { divider: true, label: '', onClick: () => {} },
      { label: '取消选中', shortcut: 'Esc', onClick: () => onSelectMesh(null) },
    );
  }

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%' }}
      onContextMenu={handleContextMenu}
    >
      <Canvas
        camera={{ position: [4, 4, 6], fov: 50 }}
        gl={{ preserveDrawingBuffer: true }}
        onPointerMissed={() => onSelectMesh(null)}
      >
        <color attach="background" args={['#1e1e22']} />

        <Environment preset="studio" background={false} resolution={128} />

        {lights.length === 0 ? (
          <>
            <ambientLight intensity={0.7} />
            <directionalLight position={[5, 10, 7]} intensity={1.8} />
            <directionalLight position={[-5, 3, -4]} intensity={0.5} />
          </>
        ) : (
          <>
            {lights.map((l, i) => {
              if (l.kind === 'ambient') {
                return <ambientLight key={i} color={l.color} intensity={l.intensity} />;
              }
              if (l.kind === 'directional') {
                return (
                  <directionalLight
                    key={i}
                    color={l.color}
                    intensity={l.intensity}
                    position={l.position ?? [5, 10, 7]}
                  />
                );
              }
              if (l.kind === 'point') {
                return (
                  <pointLight
                    key={i}
                    color={l.color}
                    intensity={l.intensity}
                    position={l.position ?? [2, 2, 2]}
                    distance={0}
                    decay={2}
                  />
                );
              }
              return null;
            })}
          </>
        )}

        <Grid
          args={[20, 20]}
          cellColor="#333"
          sectionColor="#555"
          fadeDistance={30}
          cellSize={0.5}
          sectionSize={2}
        />

        {meshes.map((m, i) => {
          const nodeId = m.__nodeId ?? `__mesh_${i}`;
          return (
            <TransformableMesh
              key={nodeId}
              mesh={m}
              selected={selectedMeshNodeId === nodeId}
              onSelect={() => onSelectMesh(nodeId)}
              onTransform={(data) => onTransformMesh(nodeId, data)}
              mode={mode}
              onIsTransforming={onIsTransformingChange}
            />
          );
        })}

        <OrbitControls
          ref={controlsRef}
          makeDefault
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: -1 as any,
          }}
        />

        <CameraController target={cameraTarget} controlsRef={controlsRef} />
        <CaptureHelper />
      </Canvas>

      <div style={{
        position: 'absolute', top: 12, left: 12,
        display: 'flex', gap: 4, alignItems: 'center',
        background: 'rgba(20, 22, 28, 0.85)', backdropFilter: 'blur(8px)',
        border: '1px solid #2a2f3a', borderRadius: 8, padding: 4,
        zIndex: 20,
      }}>
        {(['translate', 'rotate', 'scale'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            title={{ translate: '移动 (W)', rotate: '旋转 (E)', scale: '缩放 (R)' }[m]}
            style={{
              background: mode === m ? 'rgba(91,140,255,0.2)' : 'transparent',
              color: mode === m ? '#7ba4ff' : '#b8bfcc',
              border: 'none',
              padding: '5px 10px', borderRadius: 5,
              fontSize: 11, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {{ translate: '↔ 移动', rotate: '↻ 旋转', scale: '⤢ 缩放' }[m]}
          </button>
        ))}

        {cameras.length > 0 && (
          <>
            <span style={{ width: 1, height: 18, background: '#2a2f3a', margin: '0 2px' }} />
            {cameras.map((c, i) => (
              <button
                key={i}
                onClick={() => setCameraTarget({ position: c.position, lookAt: c.target })}
                title={`切换到相机 ${i + 1}`}
                style={{
                  background: 'rgba(169,122,255,0.15)',
                  color: '#a97aff',
                  border: '1px solid rgba(169,122,255,0.35)',
                  padding: '5px 10px', borderRadius: 5,
                  fontSize: 11, cursor: 'pointer',
                }}
              >
                📷 机位 {i + 1}
              </button>
            ))}
          </>
        )}
      </div>

      <MiniViewports meshes={meshes} />

      {onPositionChange && selectedPosition && (
        <PositionPanel
          visible={true}
          x={selectedPosition.x}
          y={selectedPosition.y}
          z={selectedPosition.z}
          onChange={onPositionChange}
        />
      )}

      {!hasSelection && (
        <div style={{
          position: 'absolute', bottom: 12, right: 14,
          background: 'rgba(20, 22, 28, 0.72)', backdropFilter: 'blur(8px)',
          border: '1px solid #2a2f3a', borderRadius: 8, padding: '6px 10px',
          fontSize: 11, color: '#b8bfcc',
          display: 'flex', flexDirection: 'column', gap: 4,
          pointerEvents: 'none',
          zIndex: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff4d4d' }} />
            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#eef1f6' }}>X</span>
            <span style={{ color: '#4d5460', fontSize: 10 }}>右</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4dff88' }} />
            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#eef1f6' }}>Y</span>
            <span style={{ color: '#4d5460', fontSize: 10 }}>上</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4d88ff' }} />
            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#eef1f6' }}>Z</span>
            <span style={{ color: '#4d5460', fontSize: 10 }}>前</span>
          </div>
        </div>
      )}

      {!hasSelection && (
        <div style={{
          position: 'absolute', bottom: 12, left: 14,
          background: 'rgba(20, 22, 28, 0.72)', backdropFilter: 'blur(8px)',
          border: '1px solid #2a2f3a', borderRadius: 8, padding: '6px 10px',
          fontSize: 10, color: '#7a8292',
          pointerEvents: 'none',
          zIndex: 20, lineHeight: 1.6,
        }}>
          左键旋转 · 中键平移 · 滚轮缩放 · 右键菜单
        </div>
      )}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
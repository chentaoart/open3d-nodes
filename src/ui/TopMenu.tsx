interface Props {
  onAddNode: (type: string) => void;
  onExport: (format: 'obj' | 'gltf' | 'stl') => void;
  onNewProject: () => void;
  onOpenProject: () => void;
  onSaveProject: () => void;
  onLoadSDFTemplate: (id: 'peanut' | 'mushroom' | 'blob') => void;
  onLoadCSGTemplate: (id: 'cube-hole' | 'sphere-cut' | 'ring-ring') => void;
  onOpenSketch: () => void;
  onPackGroup: () => void;
  canPack: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasModel: boolean;
}

export function TopMenu({
  onAddNode, onExport, onNewProject, onOpenProject, onSaveProject,
  onLoadSDFTemplate, onLoadCSGTemplate, onOpenSketch,
  onPackGroup, canPack,
  onUndo, onRedo, canUndo, canRedo, hasModel,
}: Props) {
  return (
    <div style={{
      height: 48, display: 'flex', alignItems: 'center', gap: 8,
      padding: '0 16px', background: '#16181d',
      borderBottom: '1px solid #2a2f3a', flexShrink: 0,
      overflowX: 'auto',
    }}>
      <strong style={{ color: '#5b8cff', letterSpacing: 0.3, marginRight: 8, flexShrink: 0 }}>
        Open3D Nodes
      </strong>

      <select
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'new') onNewProject();
          else if (v === 'open') onOpenProject();
          else if (v === 'save') onSaveProject();
          e.target.value = '';
        }}
        style={selStyle}
      >
        <option value="">文件</option>
        <option value="new">新建</option>
        <option value="open">打开…</option>
        <option value="save">保存</option>
      </select>

      <button
        onClick={onUndo}
        disabled={!canUndo}
        title="撤销 (Ctrl+Z)"
        style={{
          ...iconBtnStyle,
          opacity: canUndo ? 1 : 0.35,
          cursor: canUndo ? 'pointer' : 'not-allowed',
        }}
      >↶</button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        title="重做 (Ctrl+Shift+Z)"
        style={{
          ...iconBtnStyle,
          opacity: canRedo ? 1 : 0.35,
          cursor: canRedo ? 'pointer' : 'not-allowed',
        }}
      >↷</button>

      <div style={{ width: 1, height: 20, background: '#2a2f3a', margin: '0 4px', flexShrink: 0 }} />

      <button
        onClick={onOpenSketch}
        title="画一张草图，AI 生成 3D"
        style={{
          ...smallBtnStyle,
          background: 'linear-gradient(135deg, #3555cc, #5b8cff)',
          color: '#fff', border: 'none',
        }}
      >
        ✏️ 草图生 3D
      </button>

      <button
        onClick={onPackGroup}
        disabled={!canPack}
        title={canPack ? '把选中的节点打包成一个组' : '先选中至少两个节点'}
        style={{
          ...smallBtnStyle,
          background: canPack ? 'linear-gradient(135deg, #3555cc, #5b8cff)' : '#242832',
          color: canPack ? '#fff' : '#4d5460',
          border: canPack ? 'none' : '1px solid #2a2f3a',
          cursor: canPack ? 'pointer' : 'not-allowed',
        }}
      >
        📦 打包为组
      </button>

      <select
        onChange={(e) => { if (e.target.value) { onAddNode(e.target.value); e.target.value = ''; } }}
        style={selStyle}
      >
        <option value="">+ 节点</option>
        <optgroup label="基础体">
          <option value="box">立方体</option>
          <option value="sphere">球体</option>
          <option value="cylinder">圆柱体</option>
          <option value="lathe">旋转体</option>
        </optgroup>
        <optgroup label="SDF（圆滑有机）">
          <option value="sdfSphere">SDF 球</option>
          <option value="sdfBox">SDF 方</option>
          <option value="sdfCapsule">SDF 胶囊</option>
          <option value="sdfTorus">SDF 环</option>
          <option value="sdfUnion">SDF 并集（平滑）</option>
          <option value="sdfSubtract">SDF 差集</option>
          <option value="sdfIntersect">SDF 交集</option>
          <option value="sdfToMesh">SDF → 网格</option>
          <option value="voxelPreview">体素预览</option>
        </optgroup>
        <optgroup label="修改">
          <option value="transform">变换</option>
          <option value="boolean">CSG 布尔</option>
        </optgroup>
        <optgroup label="IO">
          <option value="loadModel">导入模型</option>
          <option value="exportOBJ">导出 OBJ</option>
          <option value="exportGLTF">导出 GLTF</option>
          <option value="exportSTL">导出 STL</option>
        </optgroup>
        <option value="output">输出</option>
      </select>

      <div style={{ width: 1, height: 20, background: '#2a2f3a', margin: '0 4px', flexShrink: 0 }} />

      <span style={{ color: '#7a8292', fontSize: 11, marginRight: 4, flexShrink: 0 }}>SDF：</span>
      <button onClick={() => onLoadSDFTemplate('peanut')} style={smallBtnStyle}>花生</button>
      <button onClick={() => onLoadSDFTemplate('mushroom')} style={smallBtnStyle}>蘑菇</button>
      <button onClick={() => onLoadSDFTemplate('blob')} style={smallBtnStyle}>糨糊球</button>

      <div style={{ width: 1, height: 20, background: '#2a2f3a', margin: '0 4px', flexShrink: 0 }} />

      <span style={{ color: '#7a8292', fontSize: 11, marginRight: 4, flexShrink: 0 }}>CSG：</span>
      <button onClick={() => onLoadCSGTemplate('cube-hole')} style={smallBtnStyle}>方块挖洞</button>
      <button onClick={() => onLoadCSGTemplate('sphere-cut')} style={smallBtnStyle}>球切半</button>
      <button onClick={() => onLoadCSGTemplate('ring-ring')} style={smallBtnStyle}>环中环</button>

      <div style={{ flex: 1, minWidth: 20 }} />

      <select
        disabled={!hasModel}
        onChange={(e) => {
          const v = e.target.value as 'obj' | 'gltf' | 'stl';
          if (v) { onExport(v); e.target.value = ''; }
        }}
        style={{
          ...selStyle,
          flexShrink: 0,
          background: hasModel ? 'linear-gradient(135deg, #3555cc, #5b8cff)' : '#242832',
          color: hasModel ? '#ffffff' : '#7a8292',
          border: hasModel ? '1px solid transparent' : '1px solid #2a2f3a',
          cursor: hasModel ? 'pointer' : 'not-allowed',
          fontWeight: 600,
        }}
      >
        <option value="">{hasModel ? '⤓ 导出' : '无模型'}</option>
        <option value="obj">导出 OBJ</option>
        <option value="gltf">导出 GLTF/GLB</option>
        <option value="stl">导出 STL</option>
      </select>
    </div>
  );
}

const selStyle: React.CSSProperties = {
  background: '#242832', color: '#eef1f6', border: '1px solid #2a2f3a',
  padding: '5px 10px', borderRadius: 5, fontSize: 12, flexShrink: 0,
  colorScheme: 'dark',
};

const smallBtnStyle: React.CSSProperties = {
  background: '#242832', color: '#eef1f6', border: '1px solid #2a2f3a',
  padding: '4px 10px', borderRadius: 5, fontSize: 11,
  cursor: 'pointer', flexShrink: 0,
};

const iconBtnStyle: React.CSSProperties = {
  background: '#242832', color: '#eef1f6', border: '1px solid #2a2f3a',
  width: 32, height: 30, borderRadius: 5, fontSize: 15,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0, transition: 'all 0.15s',
};
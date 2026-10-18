import * as THREE from 'three';

export type SDF = (x: number, y: number, z: number) => number;

let _lowQuality = false;
export function setLowQuality(v: boolean) { _lowQuality = v; }
export function getEffectiveResolution(userRes: number): number {
  return _lowQuality ? Math.max(8, Math.floor(userRes / 3)) : userRes;
}

export function sdfSphere(r: number): SDF {
  return (x, y, z) => Math.sqrt(x * x + y * y + z * z) - r;
}

export function sdfBox(hx: number, hy: number, hz: number): SDF {
  return (x, y, z) => {
    const qx = Math.abs(x) - hx;
    const qy = Math.abs(y) - hy;
    const qz = Math.abs(z) - hz;
    const mx = Math.max(qx, 0);
    const my = Math.max(qy, 0);
    const mz = Math.max(qz, 0);
    return Math.sqrt(mx * mx + my * my + mz * mz) + Math.min(Math.max(qx, qy, qz), 0);
  };
}

export function sdfCapsule(h: number, r: number): SDF {
  return (x, y, z) => {
    const py = y - Math.max(-h, Math.min(h, y));
    return Math.sqrt(x * x + py * py + z * z) - r;
  };
}

export function sdfTorus(R: number, r: number): SDF {
  return (x, y, z) => {
    const q = Math.sqrt(x * x + z * z) - R;
    return Math.sqrt(q * q + y * y) - r;
  };
}

export function sdfUnion(a: SDF, b: SDF): SDF {
  return (x, y, z) => Math.min(a(x, y, z), b(x, y, z));
}

export function sdfSmoothUnion(a: SDF, b: SDF, k: number): SDF {
  return (x, y, z) => {
    const da = a(x, y, z);
    const db = b(x, y, z);
    const h = Math.max(k - Math.abs(da - db), 0) / k;
    return Math.min(da, db) - h * h * k * 0.25;
  };
}

export function sdfSubtract(a: SDF, b: SDF): SDF {
  return (x, y, z) => Math.max(a(x, y, z), -b(x, y, z));
}

export function sdfSmoothSubtract(a: SDF, b: SDF, k: number): SDF {
  return (x, y, z) => {
    const da = a(x, y, z);
    const db = -b(x, y, z);
    const h = Math.max(k - Math.abs(da - db), 0) / k;
    return Math.max(da, db) + h * h * k * 0.25;
  };
}

export function sdfIntersect(a: SDF, b: SDF): SDF {
  return (x, y, z) => Math.max(a(x, y, z), b(x, y, z));
}

export function translateSDF(s: SDF, tx: number, ty: number, tz: number): SDF {
  return (x, y, z) => s(x - tx, y - ty, z - tz);
}

export function sdfToGeometry(
  sdf: SDF,
  bounds: { min: [number, number, number]; max: [number, number, number] },
  resolution: number
): THREE.BufferGeometry {
  const [x0, y0, z0] = bounds.min;
  const [x1, y1, z1] = bounds.max;
  const dx = (x1 - x0) / resolution;
  const dy = (y1 - y0) / resolution;
  const dz = (z1 - z0) / resolution;

  const N = resolution + 1;
  const total = N * N * N;
  const grid = new Float32Array(total);
  const px = new Float32Array(total);
  const py = new Float32Array(total);
  const pz = new Float32Array(total);

  for (let k = 0; k < N; k++) {
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = x0 + i * dx;
        const y = y0 + j * dy;
        const z = z0 + k * dz;
        const id = i + j * N + k * N * N;
        grid[id] = sdf(x, y, z);
        px[id] = x;
        py[id] = y;
        pz[id] = z;
      }
    }
  }

  const positions: number[] = [];
  const idx = (i: number, j: number, k: number) => i + j * N + k * N * N;

  const CUBE: [number, number, number][] = [
    [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
    [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
  ];
  const TETRA: [number, number, number, number][] = [
    [0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6],
    [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6],
  ];
  const EDGES: [number, number][] = [
    [0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3],
  ];

  for (let k = 0; k < resolution; k++) {
    for (let j = 0; j < resolution; j++) {
      for (let i = 0; i < resolution; i++) {
        for (const tet of TETRA) {
          const cg: number[] = [];
          const cx: number[] = [];
          const cy: number[] = [];
          const cz: number[] = [];

          for (const ci of tet) {
            const cc = CUBE[ci];
            const id = idx(i + cc[0], j + cc[1], k + cc[2]);
            cg.push(grid[id]);
            cx.push(px[id]);
            cy.push(py[id]);
            cz.push(pz[id]);
          }

          const cross: [number, number, number][] = [];
          for (const [a, b] of EDGES) {
            const ga = cg[a];
            const gb = cg[b];
            if ((ga < 0) !== (gb < 0)) {
              const t = ga / (ga - gb);
              cross.push([
                cx[a] + (cx[b] - cx[a]) * t,
                cy[a] + (cy[b] - cy[a]) * t,
                cz[a] + (cz[b] - cz[a]) * t,
              ]);
            }
          }

          if (cross.length < 3) continue;
          const flip = cg[0] > 0;

          const tris: [number, number, number][] = [];
          if (cross.length === 3) tris.push([0, 1, 2]);
          else if (cross.length === 4) tris.push([0, 1, 2], [0, 2, 3]);

          for (const [a, b, c] of tris) {
            const A = cross[a];
            const B = cross[b];
            const C = cross[c];
            if (flip) {
              positions.push(A[0], A[1], A[2], C[0], C[1], C[2], B[0], B[1], B[2]);
            } else {
              positions.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2]);
            }
          }
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}
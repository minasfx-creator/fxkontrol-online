/**
 * FX KONTROL · Niagara Data Interfaces
 * UE5.7-style data interface system for reading external engine data into particle modules.
 */

import * as THREE from 'three';

// ── Base Interface ──────────────────────────────────────────────────

export type DataInterfaceType = 'curve' | 'mesh' | 'texture' | 'skeletal';

export interface DataInterface {
  type: DataInterfaceType;
  id: string;
  enabled: boolean;
}

// ── Curve Data Interface ────────────────────────────────────────────

export interface CurveKeyframe {
  t: number;
  value: number;
}

export interface ColorCurveKeyframe {
  t: number;
  color: THREE.Color;
}

export interface CurveDataInterface extends DataInterface {
  type: 'curve';
  floatCurves: Record<string, CurveKeyframe[]>;
  colorCurves: Record<string, ColorCurveKeyframe[]>;
}

export function createCurveDataInterface(id: string, config?: {
  floatCurves?: Record<string, CurveKeyframe[]>;
  colorCurves?: Record<string, ColorCurveKeyframe[]>;
}): CurveDataInterface {
  return {
    type: 'curve',
    id,
    enabled: true,
    floatCurves: config?.floatCurves ?? {},
    colorCurves: config?.colorCurves ?? {},
  };
}

export function sampleFloatCurve(di: CurveDataInterface, curveName: string, t: number): number {
  const curve = di.floatCurves[curveName];
  if (!curve || curve.length === 0) return 0;
  if (t <= curve[0].t) return curve[0].value;
  if (t >= curve[curve.length - 1].t) return curve[curve.length - 1].value;
  for (let i = 0; i < curve.length - 1; i++) {
    if (t >= curve[i].t && t <= curve[i + 1].t) {
      const frac = (t - curve[i].t) / (curve[i + 1].t - curve[i].t);
      return THREE.MathUtils.lerp(curve[i].value, curve[i + 1].value, frac);
    }
  }
  return 0;
}

export function sampleColorCurve(di: CurveDataInterface, curveName: string, t: number): THREE.Color {
  const curve = di.colorCurves[curveName];
  if (!curve || curve.length === 0) return new THREE.Color(1, 1, 1);
  if (t <= curve[0].t) return curve[0].color.clone();
  if (t >= curve[curve.length - 1].t) return curve[curve.length - 1].color.clone();
  for (let i = 0; i < curve.length - 1; i++) {
    if (t >= curve[i].t && t <= curve[i + 1].t) {
      const frac = (t - curve[i].t) / (curve[i + 1].t - curve[i].t);
      return curve[i].color.clone().lerp(curve[i + 1].color, frac);
    }
  }
  return new THREE.Color(1, 1, 1);
}

// ── Mesh Data Interface ─────────────────────────────────────────────

export interface MeshSampleResult {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  uv?: THREE.Vector2;
}

export interface MeshDataInterface extends DataInterface {
  type: 'mesh';
  geometry: THREE.BufferGeometry;
  /** Precomputed cumulative triangle areas for weighted sampling */
  _triangleAreas?: Float32Array;
  _totalArea?: number;
}

export function createMeshDataInterface(id: string, geometry: THREE.BufferGeometry): MeshDataInterface {
  const di: MeshDataInterface = { type: 'mesh', id, enabled: true, geometry };
  precomputeTriangleAreas(di);
  return di;
}

function precomputeTriangleAreas(di: MeshDataInterface) {
  const pos = di.geometry.getAttribute('position');
  const index = di.geometry.index;
  if (!pos || !index) return;

  const triCount = Math.floor(index.count / 3);
  const areas = new Float32Array(triCount);
  let total = 0;
  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
  const edge1 = new THREE.Vector3(), edge2 = new THREE.Vector3();

  for (let i = 0; i < triCount; i++) {
    v0.fromBufferAttribute(pos, index.getX(i * 3));
    v1.fromBufferAttribute(pos, index.getX(i * 3 + 1));
    v2.fromBufferAttribute(pos, index.getX(i * 3 + 2));
    edge1.subVectors(v1, v0);
    edge2.subVectors(v2, v0);
    const area = edge1.cross(edge2).length() * 0.5;
    total += area;
    areas[i] = total;
  }
  di._triangleAreas = areas;
  di._totalArea = total;
}

export function sampleMesh(di: MeshDataInterface): MeshSampleResult {
  const pos = di.geometry.getAttribute('position');
  const normalAttr = di.geometry.getAttribute('normal');
  const uvAttr = di.geometry.getAttribute('uv');
  const index = di.geometry.index;

  if (!pos || !index || !di._triangleAreas || !di._totalArea) {
    return { position: new THREE.Vector3(), normal: new THREE.Vector3(0, 1, 0) };
  }

  // Area-weighted triangle selection via binary search
  const target = Math.random() * di._totalArea;
  let lo = 0, hi = di._triangleAreas.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (di._triangleAreas[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  const triIdx = lo * 3;

  const i0 = index.getX(triIdx);
  const i1 = index.getX(triIdx + 1);
  const i2 = index.getX(triIdx + 2);

  // Barycentric
  let u = Math.random(), v = Math.random();
  if (u + v > 1) { u = 1 - u; v = 1 - v; }
  const w = 1 - u - v;

  const v0 = new THREE.Vector3().fromBufferAttribute(pos, i0);
  const v1 = new THREE.Vector3().fromBufferAttribute(pos, i1);
  const v2 = new THREE.Vector3().fromBufferAttribute(pos, i2);
  const position = v0.multiplyScalar(w).add(v1.multiplyScalar(u)).add(v2.multiplyScalar(v));

  let normal = new THREE.Vector3(0, 1, 0);
  if (normalAttr) {
    const n0 = new THREE.Vector3().fromBufferAttribute(normalAttr, i0);
    const n1 = new THREE.Vector3().fromBufferAttribute(normalAttr, i1);
    const n2 = new THREE.Vector3().fromBufferAttribute(normalAttr, i2);
    normal = n0.multiplyScalar(w).add(n1.multiplyScalar(u)).add(n2.multiplyScalar(v)).normalize();
  }

  let uv: THREE.Vector2 | undefined;
  if (uvAttr) {
    const uv0 = new THREE.Vector2().fromBufferAttribute(uvAttr, i0);
    const uv1 = new THREE.Vector2().fromBufferAttribute(uvAttr, i1);
    const uv2 = new THREE.Vector2().fromBufferAttribute(uvAttr, i2);
    uv = uv0.multiplyScalar(w).add(uv1.multiplyScalar(u)).add(uv2.multiplyScalar(v));
  }

  return { position, normal, uv };
}

// ── Texture Data Interface ──────────────────────────────────────────

export interface TextureDataInterface extends DataInterface {
  type: 'texture';
  width: number;
  height: number;
  data: Float32Array | Uint8Array;
  channels: number;
}

export function createTextureDataInterface(
  id: string,
  width: number, height: number,
  data: Float32Array | Uint8Array,
  channels: number = 4
): TextureDataInterface {
  return { type: 'texture', id, enabled: true, width, height, data, channels };
}

export function sampleTexture(di: TextureDataInterface, u: number, v: number): { r: number; g: number; b: number; a: number } {
  const x = Math.floor(THREE.MathUtils.clamp(u, 0, 1) * (di.width - 1));
  const y = Math.floor(THREE.MathUtils.clamp(v, 0, 1) * (di.height - 1));
  const idx = (y * di.width + x) * di.channels;
  const isFloat = di.data instanceof Float32Array;
  const scale = isFloat ? 1 : 1 / 255;
  return {
    r: (di.data[idx] ?? 0) * scale,
    g: (di.data[idx + 1] ?? 0) * scale,
    b: (di.data[idx + 2] ?? 0) * scale,
    a: di.channels >= 4 ? (di.data[idx + 3] ?? (isFloat ? 1 : 255)) * scale : 1,
  };
}

// ── Skeletal Data Interface ─────────────────────────────────────────

export interface BoneTransform {
  name: string;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
}

export interface SkeletalDataInterface extends DataInterface {
  type: 'skeletal';
  bones: BoneTransform[];
  boneMap: Map<string, number>;
}

export function createSkeletalDataInterface(id: string, bones: BoneTransform[]): SkeletalDataInterface {
  const boneMap = new Map<string, number>();
  bones.forEach((b, i) => boneMap.set(b.name, i));
  return { type: 'skeletal', id, enabled: true, bones, boneMap };
}

export function updateSkeletalBones(di: SkeletalDataInterface, newBones: BoneTransform[]) {
  di.bones = newBones;
  di.boneMap.clear();
  newBones.forEach((b, i) => di.boneMap.set(b.name, i));
}

export function getBoneTransform(di: SkeletalDataInterface, boneName: string): BoneTransform | undefined {
  const idx = di.boneMap.get(boneName);
  return idx !== undefined ? di.bones[idx] : undefined;
}

export function sampleRandomBonePosition(di: SkeletalDataInterface): THREE.Vector3 {
  if (di.bones.length === 0) return new THREE.Vector3();
  const bone = di.bones[Math.floor(Math.random() * di.bones.length)];
  return bone.position.clone();
}

/** Extract bones from a THREE.Skeleton for use as data interface */
export function bonesFromSkeleton(skeleton: THREE.Skeleton): BoneTransform[] {
  return skeleton.bones.map(bone => ({
    name: bone.name,
    position: bone.getWorldPosition(new THREE.Vector3()),
    quaternion: bone.getWorldQuaternion(new THREE.Quaternion()),
    scale: bone.getWorldScale(new THREE.Vector3()),
  }));
}

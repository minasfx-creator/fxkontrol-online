/**
 * SwarmGPT — glTF/GLB → MeshLike adapter (DOM/Three side).
 *
 * The advanced/model3d module is pure (no Three.js, no DOM). This adapter
 * lives in /lib so it can import three.js safely. It walks a loaded
 * THREE.Object3D (typically the `scene` from useGLTF), bakes each mesh's
 * world transform into vertex positions, and merges everything into a
 * single MeshLike { vertices, indices? } usable by extractFormationFromMesh.
 *
 * Notes:
 *  - Skinned/morph targets are sampled from their *base* geometry only.
 *  - Non-triangle primitives are skipped (we only emit triangle indices).
 *  - Optional vertex/triangle caps protect downstream samplers.
 */
import * as THREE from 'three';
import type { MeshLike } from '@/modules/swarmgpt/advanced/model3d/types';
import type { Vec3 } from '@/modules/swarmgpt/types';

export interface GltfToMeshLikeOptions {
  /** Bake world matrix into vertex positions (default true). */
  applyWorldMatrix?: boolean;
  /** Hard cap on emitted vertices — extra meshes are truncated. Default 200_000. */
  maxVertices?: number;
  /** Hard cap on emitted triangles. Default 400_000. */
  maxTriangles?: number;
  /** Include indices when every visited mesh is indexed-triangle. Default true. */
  preserveIndices?: boolean;
  /** Mesh name (for diagnostics). */
  name?: string;
}

const DEFAULTS: Required<Omit<GltfToMeshLikeOptions, 'name'>> = {
  applyWorldMatrix: true,
  maxVertices: 200_000,
  maxTriangles: 400_000,
  preserveIndices: true,
};

/**
 * Walk an Object3D tree and produce a single MeshLike.
 * Returns `null` when the root contains no triangle meshes.
 */
export function gltfToMeshLike(
  root: THREE.Object3D,
  options: GltfToMeshLikeOptions = {},
): MeshLike | null {
  const opts = { ...DEFAULTS, ...options };

  // Make sure world matrices are current before reading.
  root.updateWorldMatrix(true, true);

  const vertices: Vec3[] = [];
  const indices: number[] = [];
  let allTriangleIndexed = true;
  let truncated = false;

  const tmp = new THREE.Vector3();

  root.traverse((child) => {
    if (truncated) return;
    if (!(child as THREE.Mesh).isMesh) return;

    const mesh = child as THREE.Mesh;
    const geom = mesh.geometry as THREE.BufferGeometry | undefined;
    if (!geom) return;

    const posAttr = geom.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!posAttr || posAttr.count === 0) return;

    // Only emit triangle topology. Skip lines/points/non-triangle-strips.
    // BufferGeometry has no `mode` field; we infer from drawRange/groups left
    // at defaults and treat indexed/un-indexed buffers as triangle soup.
    const indexAttr = geom.getIndex();

    const baseOffset = vertices.length;
    const remainingVerts = opts.maxVertices - vertices.length;
    if (remainingVerts <= 0) {
      truncated = true;
      return;
    }

    const vertsToCopy = Math.min(posAttr.count, remainingVerts);
    if (vertsToCopy < posAttr.count) truncated = true;

    // Bake world transform once per mesh.
    const matrix = opts.applyWorldMatrix ? mesh.matrixWorld : null;

    for (let i = 0; i < vertsToCopy; i++) {
      tmp.fromBufferAttribute(posAttr, i);
      if (matrix) tmp.applyMatrix4(matrix);
      vertices.push({ x: tmp.x, y: tmp.y, z: tmp.z });
    }

    if (!indexAttr) {
      allTriangleIndexed = false;
      return;
    }

    // Copy triangle indices (re-based to baseOffset) up to triangle cap.
    const remainingTris = opts.maxTriangles - Math.floor(indices.length / 3);
    if (remainingTris <= 0) {
      truncated = true;
      return;
    }
    const triCount = Math.min(Math.floor(indexAttr.count / 3), remainingTris);
    if (triCount < indexAttr.count / 3) truncated = true;

    // Reject any index that lies outside our (possibly-truncated) vertex range.
    const maxLocal = vertsToCopy;
    for (let t = 0; t < triCount; t++) {
      const a = indexAttr.getX(t * 3);
      const b = indexAttr.getX(t * 3 + 1);
      const c = indexAttr.getX(t * 3 + 2);
      if (a >= maxLocal || b >= maxLocal || c >= maxLocal) continue;
      indices.push(baseOffset + a, baseOffset + b, baseOffset + c);
    }
  });

  if (vertices.length === 0) return null;

  const out: MeshLike = {
    vertices,
    name: opts.name ?? root.name ?? undefined,
  };
  if (opts.preserveIndices && allTriangleIndexed && indices.length >= 3) {
    out.indices = indices;
  }
  return out;
}

/**
 * Convenience: extract MeshLike from a GLTF result (e.g. from useGLTF).
 * Accepts either the gltf object or its `scene`.
 */
export function gltfResultToMeshLike(
  gltfOrScene: { scene: THREE.Object3D } | THREE.Object3D,
  options?: GltfToMeshLikeOptions,
): MeshLike | null {
  const root =
    (gltfOrScene as { scene?: THREE.Object3D }).scene ??
    (gltfOrScene as THREE.Object3D);
  return gltfToMeshLike(root, options);
}

/**
 * FX KONTROL · Asset Gate
 * Validates 3D assets (GLB/GLTF/FBX/textures) before loading.
 * Blocks oversized, malicious, or non-conforming assets.
 */

// ── Asset Limits ─────────────────────────────────────────────
export interface AssetLimits {
  maxFileSizeMB: number;           // e.g. 50
  maxTriangles: number;            // e.g. 500_000
  maxTextureDimension: number;     // e.g. 4096
  maxTextureCount: number;         // e.g. 32
  maxAnimationCount: number;       // e.g. 50
  maxNodeDepth: number;            // e.g. 20
  allowedExtensions: string[];     // e.g. ['.glb', '.gltf', '.fbx', '.obj']
  allowedTextureFormats: string[]; // e.g. ['.png', '.jpg', '.jpeg', '.webp', '.ktx2']
}

const DEFAULT_LIMITS: AssetLimits = {
  maxFileSizeMB: 50,
  maxTriangles: 500_000,
  maxTextureDimension: 4096,
  maxTextureCount: 32,
  maxAnimationCount: 50,
  maxNodeDepth: 20,
  allowedExtensions: ['.glb', '.gltf', '.fbx', '.obj', '.stl', '.ply'],
  allowedTextureFormats: ['.png', '.jpg', '.jpeg', '.webp', '.ktx2', '.basis'],
};

let _limits = { ...DEFAULT_LIMITS };
export function setAssetLimits(l: Partial<AssetLimits>) { _limits = { ..._limits, ...l }; }
export function getAssetLimits(): Readonly<AssetLimits> { return _limits; }

// ── Validation Result ────────────────────────────────────────
export interface AssetValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    fileSizeMB: number;
    extension: string;
  };
}

// ── Pre-Load Validation (file metadata) ──────────────────────
export function validateAssetFile(file: File): AssetValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ext = getExtension(file.name);
  const sizeMB = file.size / (1024 * 1024);

  // Extension check
  if (!_limits.allowedExtensions.includes(ext)) {
    errors.push(`Blocked extension: "${ext}". Allowed: ${_limits.allowedExtensions.join(', ')}`);
  }

  // Size check
  if (sizeMB > _limits.maxFileSizeMB) {
    errors.push(`File too large: ${sizeMB.toFixed(1)}MB (max: ${_limits.maxFileSizeMB}MB)`);
  } else if (sizeMB > _limits.maxFileSizeMB * 0.8) {
    warnings.push(`File approaching size limit: ${sizeMB.toFixed(1)}MB / ${_limits.maxFileSizeMB}MB`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: { fileSizeMB: sizeMB, extension: ext },
  };
}

// ── Post-Load Validation (GLTF scene graph) ──────────────────
export interface GLTFSceneStats {
  triangleCount: number;
  nodeCount: number;
  maxDepth: number;
  textureCount: number;
  maxTextureDim: number;
  animationCount: number;
}

export function validateGLTFScene(stats: GLTFSceneStats): AssetValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (stats.triangleCount > _limits.maxTriangles) {
    errors.push(`Too many triangles: ${stats.triangleCount.toLocaleString()} (max: ${_limits.maxTriangles.toLocaleString()})`);
  }

  if (stats.maxTextureDim > _limits.maxTextureDimension) {
    errors.push(`Texture too large: ${stats.maxTextureDim}px (max: ${_limits.maxTextureDimension}px)`);
  }

  if (stats.textureCount > _limits.maxTextureCount) {
    warnings.push(`High texture count: ${stats.textureCount} (max: ${_limits.maxTextureCount})`);
  }

  if (stats.maxDepth > _limits.maxNodeDepth) {
    warnings.push(`Deep node hierarchy: ${stats.maxDepth} (max: ${_limits.maxNodeDepth})`);
  }

  if (stats.animationCount > _limits.maxAnimationCount) {
    warnings.push(`Many animations: ${stats.animationCount} (max: ${_limits.maxAnimationCount})`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: { fileSizeMB: 0, extension: '' },
  };
}

// ── Scene Graph Analyzer ─────────────────────────────────────
export function analyzeSceneGraph(root: any): GLTFSceneStats {
  let triangleCount = 0;
  let nodeCount = 0;
  let maxDepth = 0;
  let textureCount = 0;
  let maxTextureDim = 0;
  let animationCount = 0;
  const textures = new Set<any>();

  function walk(node: any, depth: number) {
    nodeCount++;
    if (depth > maxDepth) maxDepth = depth;

    if (node.geometry) {
      const index = node.geometry.index;
      const pos = node.geometry.attributes?.position;
      if (index) triangleCount += index.count / 3;
      else if (pos) triangleCount += pos.count / 3;
    }

    if (node.material) {
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      for (const mat of mats) {
        for (const key of Object.keys(mat)) {
          const val = mat[key];
          if (val && val.isTexture && !textures.has(val)) {
            textures.add(val);
            textureCount++;
            const img = val.image;
            if (img) {
              const dim = Math.max(img.width || 0, img.height || 0);
              if (dim > maxTextureDim) maxTextureDim = dim;
            }
          }
        }
      }
    }

    if (node.children) {
      for (const child of node.children) walk(child, depth + 1);
    }
  }

  walk(root, 0);
  return { triangleCount, nodeCount, maxDepth, textureCount, maxTextureDim, animationCount };
}

// ── Texture Validation ───────────────────────────────────────
export function validateTextureFile(file: File): AssetValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ext = getExtension(file.name);
  const sizeMB = file.size / (1024 * 1024);

  if (!_limits.allowedTextureFormats.includes(ext)) {
    errors.push(`Blocked texture format: "${ext}"`);
  }

  if (sizeMB > 20) {
    errors.push(`Texture file too large: ${sizeMB.toFixed(1)}MB (max: 20MB)`);
  }

  return { valid: errors.length === 0, errors, warnings, stats: { fileSizeMB: sizeMB, extension: ext } };
}

// ── Helpers ──────────────────────────────────────────────────
function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx).toLowerCase() : '';
}

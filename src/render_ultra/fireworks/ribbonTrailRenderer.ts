/**
 * FX KONTROL · Ribbon Trail Renderer
 * Niagara-style ribbon trails for comets, weapon trails, and beam effects.
 * Generates triangle-strip geometry from ordered particle chains.
 */

import * as THREE from 'three';

// ── Types ───────────────────────────────────────────────────────────

export type RibbonUVMode = 'stretch' | 'tile';

export interface RibbonPoint {
  position: THREE.Vector3;
  width: number;
  color: THREE.Color;
  opacity: number;
  age: number;
}

export interface RibbonConfig {
  maxPoints: number;
  lifetime: number;
  baseWidth: number;
  widthCurve: { t: number; value: number }[];
  uvMode: RibbonUVMode;
  uvTileScale: number;
  blendMode: 'additive' | 'screen' | 'normal';
  textureRepeat: number;
}

// ── Shaders ─────────────────────────────────────────────────────────

const RIBBON_VERTEX = `
  attribute vec3 aColor;
  attribute float aOpacity;
  attribute vec2 aUV;
  
  varying vec3 vColor;
  varying float vOpacity;
  varying vec2 vUV;
  
  void main() {
    vColor = aColor;
    vOpacity = aOpacity;
    vUV = aUV;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RIBBON_FRAGMENT = `
  uniform sampler2D uTexture;
  uniform bool uHasTexture;
  
  varying vec3 vColor;
  varying float vOpacity;
  varying vec2 vUV;
  
  void main() {
    float alpha = vOpacity;
    vec3 color = vColor;
    
    if (uHasTexture) {
      vec4 texColor = texture2D(uTexture, vUV);
      color *= texColor.rgb;
      alpha *= texColor.a;
    }
    
    // Soft edge falloff along V (cross-ribbon)
    float edgeFade = 1.0 - pow(abs(vUV.y * 2.0 - 1.0), 3.0);
    alpha *= edgeFade;
    
    if (alpha < 0.005) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

// ── Width Curve Sampling ────────────────────────────────────────────

function sampleWidthCurve(curve: { t: number; value: number }[], t: number): number {
  if (curve.length === 0) return 1;
  if (t <= curve[0].t) return curve[0].value;
  if (t >= curve[curve.length - 1].t) return curve[curve.length - 1].value;
  for (let i = 0; i < curve.length - 1; i++) {
    if (t >= curve[i].t && t <= curve[i + 1].t) {
      const frac = (t - curve[i].t) / (curve[i + 1].t - curve[i].t);
      return THREE.MathUtils.lerp(curve[i].value, curve[i + 1].value, frac);
    }
  }
  return 1;
}

// ── Ribbon Trail Class ──────────────────────────────────────────────

export class RibbonTrail {
  private points: RibbonPoint[] = [];
  private config: RibbonConfig;
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  public mesh: THREE.Mesh;

  constructor(config: Partial<RibbonConfig> = {}) {
    this.config = {
      maxPoints: config.maxPoints || 64,
      lifetime: config.lifetime || 2,
      baseWidth: config.baseWidth || 2,
      widthCurve: config.widthCurve || [
        { t: 0, value: 1 },
        { t: 0.7, value: 0.5 },
        { t: 1, value: 0 },
      ],
      uvMode: config.uvMode || 'stretch',
      uvTileScale: config.uvTileScale || 1,
      blendMode: config.blendMode || 'additive',
      textureRepeat: config.textureRepeat || 1,
    };

    // Pre-allocate buffers for triangle strip (2 verts per point)
    const maxVerts = this.config.maxPoints * 2;
    const positions = new Float32Array(maxVerts * 3);
    const colors = new Float32Array(maxVerts * 3);
    const opacities = new Float32Array(maxVerts);
    const uvs = new Float32Array(maxVerts * 2);
    const indices: number[] = [];

    // Generate triangle strip indices
    for (let i = 0; i < this.config.maxPoints - 1; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      indices.push(a, b, c, b, d, c);
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aUV', new THREE.BufferAttribute(uvs, 2).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setIndex(indices);

    const blending = this.config.blendMode === 'additive' ? THREE.AdditiveBlending
      : this.config.blendMode === 'screen' ? THREE.AdditiveBlending
      : THREE.NormalBlending;

    this.material = new THREE.ShaderMaterial({
      vertexShader: RIBBON_VERTEX,
      fragmentShader: RIBBON_FRAGMENT,
      uniforms: {
        uTexture: { value: null },
        uHasTexture: { value: false },
      },
      transparent: true,
      blending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
  }

  setTexture(texture: THREE.Texture) {
    this.material.uniforms.uTexture.value = texture;
    this.material.uniforms.uHasTexture.value = true;
  }

  addPoint(position: THREE.Vector3, color: THREE.Color = new THREE.Color(1, 1, 1), opacity = 1, width?: number) {
    this.points.unshift({
      position: position.clone(),
      width: width ?? this.config.baseWidth,
      color: color.clone(),
      opacity,
      age: 0,
    });

    if (this.points.length > this.config.maxPoints) {
      this.points.pop();
    }
  }

  update(dt: number, cameraPosition?: THREE.Vector3) {
    // Age points and remove expired
    for (let i = this.points.length - 1; i >= 0; i--) {
      this.points[i].age += dt;
      if (this.points[i].age >= this.config.lifetime) {
        this.points.splice(i, 1);
      }
    }

    if (this.points.length < 2) {
      this.geometry.setDrawRange(0, 0);
      return;
    }

    const pos = this.geometry.attributes.position.array as Float32Array;
    const cols = this.geometry.attributes.aColor.array as Float32Array;
    const opacities = this.geometry.attributes.aOpacity.array as Float32Array;
    const uvs = this.geometry.attributes.aUV.array as Float32Array;

    // Compute total length for UV stretch mode
    let totalLength = 0;
    const segLengths: number[] = [0];
    for (let i = 1; i < this.points.length; i++) {
      totalLength += this.points[i].position.distanceTo(this.points[i - 1].position);
      segLengths.push(totalLength);
    }

    const camPos = cameraPosition || new THREE.Vector3(0, 50, 100);

    for (let i = 0; i < this.points.length; i++) {
      const pt = this.points[i];
      const t = pt.age / this.config.lifetime;
      const widthScale = sampleWidthCurve(this.config.widthCurve, t);
      const halfWidth = pt.width * widthScale * 0.5;

      // Compute ribbon normal: cross of tangent with camera direction
      let tangent: THREE.Vector3;
      if (i === 0 && this.points.length > 1) {
        tangent = new THREE.Vector3().subVectors(this.points[1].position, pt.position).normalize();
      } else if (i === this.points.length - 1) {
        tangent = new THREE.Vector3().subVectors(pt.position, this.points[i - 1].position).normalize();
      } else {
        tangent = new THREE.Vector3().subVectors(this.points[i + 1].position, this.points[i - 1].position).normalize();
      }

      const toCamera = new THREE.Vector3().subVectors(camPos, pt.position).normalize();
      const side = new THREE.Vector3().crossVectors(tangent, toCamera).normalize().multiplyScalar(halfWidth);

      const v0 = i * 2;
      const v1 = i * 2 + 1;

      // Left vertex
      pos[v0 * 3] = pt.position.x + side.x;
      pos[v0 * 3 + 1] = pt.position.y + side.y;
      pos[v0 * 3 + 2] = pt.position.z + side.z;

      // Right vertex
      pos[v1 * 3] = pt.position.x - side.x;
      pos[v1 * 3 + 1] = pt.position.y - side.y;
      pos[v1 * 3 + 2] = pt.position.z - side.z;

      // Colors
      cols[v0 * 3] = cols[v1 * 3] = pt.color.r;
      cols[v0 * 3 + 1] = cols[v1 * 3 + 1] = pt.color.g;
      cols[v0 * 3 + 2] = cols[v1 * 3 + 2] = pt.color.b;

      // Opacity (fade with age)
      const fadeOpacity = pt.opacity * (1 - t);
      opacities[v0] = opacities[v1] = fadeOpacity;

      // UVs
      let u: number;
      if (this.config.uvMode === 'stretch') {
        u = totalLength > 0 ? segLengths[i] / totalLength : i / (this.points.length - 1);
      } else {
        u = (totalLength > 0 ? segLengths[i] : i) * this.config.uvTileScale;
      }
      uvs[v0 * 2] = u;
      uvs[v0 * 2 + 1] = 0;
      uvs[v1 * 2] = u;
      uvs[v1 * 2 + 1] = 1;
    }

    // Zero remaining
    for (let i = this.points.length; i < this.config.maxPoints; i++) {
      const v0 = i * 2;
      const v1 = i * 2 + 1;
      pos[v0 * 3 + 1] = -1000;
      pos[v1 * 3 + 1] = -1000;
      opacities[v0] = opacities[v1] = 0;
    }

    this.geometry.attributes.position.needsUpdate = true;
    (this.geometry.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.aOpacity as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.aUV as THREE.BufferAttribute).needsUpdate = true;

    // Draw range: 6 indices per segment, (points-1) segments
    const triCount = Math.max(0, this.points.length - 1) * 6;
    this.geometry.setDrawRange(0, triCount);
  }

  get pointCount() { return this.points.length; }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

/**
 * Create a pre-configured ribbon material with custom blend and optional texture.
 */
export function createRibbonMaterial(
  blendMode: 'additive' | 'screen' | 'normal' = 'additive',
  texture?: THREE.Texture
): THREE.ShaderMaterial {
  const blending = blendMode === 'additive' ? THREE.AdditiveBlending
    : blendMode === 'screen' ? THREE.AdditiveBlending
    : THREE.NormalBlending;

  return new THREE.ShaderMaterial({
    vertexShader: RIBBON_VERTEX,
    fragmentShader: RIBBON_FRAGMENT,
    uniforms: {
      uTexture: { value: texture || null },
      uHasTexture: { value: !!texture },
    },
    transparent: true,
    blending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

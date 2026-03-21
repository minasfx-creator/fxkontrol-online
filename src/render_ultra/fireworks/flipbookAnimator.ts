/**
 * FX KONTROL · Flipbook / Sprite Sheet Animation System
 * Niagara-style SubUV animation for smoke puffs, explosions, and magic effects.
 */

import * as THREE from 'three';

// ── Types ───────────────────────────────────────────────────────────

export interface FlipbookConfig {
  rows: number;
  cols: number;
  totalFrames: number;
  fps: number;
  loop: boolean;
}

export interface FlipbookUVRect {
  uMin: number;
  vMin: number;
  uMax: number;
  vMax: number;
}

// ── UV Calculation ──────────────────────────────────────────────────

/**
 * Calculate UV rect for a given age in a flipbook animation.
 */
export function getFlipbookUV(age: number, config: FlipbookConfig): FlipbookUVRect {
  const frameFloat = age * config.fps;
  let frame: number;

  if (config.loop) {
    frame = Math.floor(frameFloat) % config.totalFrames;
  } else {
    frame = Math.min(Math.floor(frameFloat), config.totalFrames - 1);
  }

  const col = frame % config.cols;
  const row = Math.floor(frame / config.cols);

  const cellW = 1 / config.cols;
  const cellH = 1 / config.rows;

  return {
    uMin: col * cellW,
    vMin: 1 - (row + 1) * cellH, // Flip V for OpenGL convention
    uMax: (col + 1) * cellW,
    vMax: 1 - row * cellH,
  };
}

/**
 * Interpolated flipbook UV for smooth frame transitions.
 */
export function getFlipbookUVLerp(age: number, config: FlipbookConfig): { current: FlipbookUVRect; next: FlipbookUVRect; blend: number } {
  const frameFloat = age * config.fps;
  let frameA: number;
  let frameB: number;
  let blend: number;

  if (config.loop) {
    frameA = Math.floor(frameFloat) % config.totalFrames;
    frameB = (frameA + 1) % config.totalFrames;
    blend = frameFloat - Math.floor(frameFloat);
  } else {
    frameA = Math.min(Math.floor(frameFloat), config.totalFrames - 1);
    frameB = Math.min(frameA + 1, config.totalFrames - 1);
    blend = frameA === frameB ? 0 : frameFloat - Math.floor(frameFloat);
  }

  const getRect = (frame: number): FlipbookUVRect => {
    const col = frame % config.cols;
    const row = Math.floor(frame / config.cols);
    const cellW = 1 / config.cols;
    const cellH = 1 / config.rows;
    return {
      uMin: col * cellW,
      vMin: 1 - (row + 1) * cellH,
      uMax: (col + 1) * cellW,
      vMax: 1 - row * cellH,
    };
  };

  return {
    current: getRect(frameA),
    next: getRect(frameB),
    blend,
  };
}

// ── GLSL Snippets ───────────────────────────────────────────────────

/**
 * GLSL fragment snippet for single-frame flipbook sampling.
 */
export const FLIPBOOK_FRAGMENT_SINGLE = `
  uniform vec4 uFlipbookRect; // (uMin, vMin, uMax, vMax)
  
  vec4 sampleFlipbook(sampler2D tex, vec2 pointCoord) {
    vec2 uv = mix(uFlipbookRect.xy, uFlipbookRect.zw, pointCoord);
    return texture2D(tex, uv);
  }
`;

/**
 * GLSL fragment snippet for interpolated flipbook sampling (smooth transitions).
 */
export const FLIPBOOK_FRAGMENT_LERP = `
  uniform vec4 uFlipbookRectA; // current frame (uMin, vMin, uMax, vMax)
  uniform vec4 uFlipbookRectB; // next frame
  uniform float uFlipbookBlend;
  
  vec4 sampleFlipbookLerp(sampler2D tex, vec2 pointCoord) {
    vec2 uvA = mix(uFlipbookRectA.xy, uFlipbookRectA.zw, pointCoord);
    vec2 uvB = mix(uFlipbookRectB.xy, uFlipbookRectB.zw, pointCoord);
    vec4 colorA = texture2D(tex, uvA);
    vec4 colorB = texture2D(tex, uvB);
    return mix(colorA, colorB, uFlipbookBlend);
  }
`;

// ── Material Factory ────────────────────────────────────────────────

export function createFlipbookMaterial(
  texture: THREE.Texture,
  config: FlipbookConfig,
  blendMode: 'additive' | 'normal' = 'additive',
  interpolate = true
): THREE.ShaderMaterial {
  const blending = blendMode === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending;

  const vertexShader = `
    attribute float aSize;
    attribute float aOpacity;
    attribute vec3 aColor;
    attribute float aAge;
    
    varying float vOpacity;
    varying vec3 vColor;
    varying float vAge;
    
    void main() {
      vOpacity = aOpacity;
      vColor = aColor;
      vAge = aAge;
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPos;
      gl_PointSize = aSize * (300.0 / -mvPos.z);
    }
  `;

  const fragmentShader = interpolate ? `
    uniform sampler2D uTexture;
    uniform vec4 uFlipbookRectA;
    uniform vec4 uFlipbookRectB;
    uniform float uFlipbookBlend;
    
    varying float vOpacity;
    varying vec3 vColor;
    varying float vAge;
    
    void main() {
      vec2 uvA = mix(uFlipbookRectA.xy, uFlipbookRectA.zw, gl_PointCoord);
      vec2 uvB = mix(uFlipbookRectB.xy, uFlipbookRectB.zw, gl_PointCoord);
      vec4 texA = texture2D(uTexture, uvA);
      vec4 texB = texture2D(uTexture, uvB);
      vec4 texColor = mix(texA, texB, uFlipbookBlend);
      
      float alpha = texColor.a * vOpacity;
      if (alpha < 0.01) discard;
      gl_FragColor = vec4(vColor * texColor.rgb, alpha);
    }
  ` : `
    uniform sampler2D uTexture;
    uniform vec4 uFlipbookRect;
    
    varying float vOpacity;
    varying vec3 vColor;
    varying float vAge;
    
    void main() {
      vec2 uv = mix(uFlipbookRect.xy, uFlipbookRect.zw, gl_PointCoord);
      vec4 texColor = texture2D(uTexture, uv);
      
      float alpha = texColor.a * vOpacity;
      if (alpha < 0.01) discard;
      gl_FragColor = vec4(vColor * texColor.rgb, alpha);
    }
  `;

  const uniforms: Record<string, THREE.IUniform> = {
    uTexture: { value: texture },
  };

  if (interpolate) {
    const uv = getFlipbookUVLerp(0, config);
    uniforms.uFlipbookRectA = { value: new THREE.Vector4(uv.current.uMin, uv.current.vMin, uv.current.uMax, uv.current.vMax) };
    uniforms.uFlipbookRectB = { value: new THREE.Vector4(uv.next.uMin, uv.next.vMin, uv.next.uMax, uv.next.vMax) };
    uniforms.uFlipbookBlend = { value: uv.blend };
  } else {
    const uv = getFlipbookUV(0, config);
    uniforms.uFlipbookRect = { value: new THREE.Vector4(uv.uMin, uv.vMin, uv.uMax, uv.vMax) };
  }

  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    blending,
    depthWrite: false,
  });
}

/**
 * Update flipbook material uniforms for current age.
 */
export function updateFlipbookMaterial(material: THREE.ShaderMaterial, age: number, config: FlipbookConfig, interpolate = true) {
  if (interpolate) {
    const uv = getFlipbookUVLerp(age, config);
    material.uniforms.uFlipbookRectA.value.set(uv.current.uMin, uv.current.vMin, uv.current.uMax, uv.current.vMax);
    material.uniforms.uFlipbookRectB.value.set(uv.next.uMin, uv.next.vMin, uv.next.uMax, uv.next.vMax);
    material.uniforms.uFlipbookBlend.value = uv.blend;
  } else {
    const uv = getFlipbookUV(age, config);
    material.uniforms.uFlipbookRect.value.set(uv.uMin, uv.vMin, uv.uMax, uv.vMax);
  }
}

// ── Common Presets ──────────────────────────────────────────────────

export const FLIPBOOK_PRESETS: Record<string, FlipbookConfig> = {
  'smoke-4x4': { rows: 4, cols: 4, totalFrames: 16, fps: 12, loop: true },
  'smoke-8x8': { rows: 8, cols: 8, totalFrames: 64, fps: 24, loop: true },
  'explosion-4x4': { rows: 4, cols: 4, totalFrames: 16, fps: 30, loop: false },
  'explosion-8x8': { rows: 8, cols: 8, totalFrames: 64, fps: 45, loop: false },
  'fire-4x4': { rows: 4, cols: 4, totalFrames: 16, fps: 18, loop: true },
  'magic-orb-2x2': { rows: 2, cols: 2, totalFrames: 4, fps: 8, loop: true },
  'spark-flash-1x4': { rows: 1, cols: 4, totalFrames: 4, fps: 60, loop: false },
};

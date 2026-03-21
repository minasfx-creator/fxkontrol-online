/**
 * FX KONTROL · Soft Particle + Velocity Stretch Shaders
 * Niagara-grade depth-fade and velocity-aligned sprite rendering.
 */

import * as THREE from 'three';

// ── Soft Particle Vertex Shader ─────────────────────────────────────

const SOFT_PARTICLE_VERTEX = `
  attribute float aSize;
  attribute float aOpacity;
  attribute vec3 aColor;
  attribute vec3 aVelocity;

  uniform float uStretchScale;
  uniform bool uVelocityStretch;

  varying float vOpacity;
  varying vec3 vColor;
  varying vec4 vViewPos;

  void main() {
    vOpacity = aOpacity;
    vColor = aColor;
    
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mvPos;
    
    gl_Position = projectionMatrix * mvPos;
    
    // Base point size with perspective scaling
    float baseSize = aSize * (300.0 / -mvPos.z);
    
    // Velocity stretching — elongate point along velocity direction
    if (uVelocityStretch) {
      vec3 viewVel = (modelViewMatrix * vec4(aVelocity, 0.0)).xyz;
      float speed = length(viewVel);
      float stretchFactor = 1.0 + speed * uStretchScale;
      baseSize *= stretchFactor;
    }
    
    gl_PointSize = max(1.0, baseSize);
  }
`;

// ── Soft Particle Fragment Shader ───────────────────────────────────

const SOFT_PARTICLE_FRAGMENT = `
  uniform sampler2D uDepthTexture;
  uniform float uSoftRange;
  uniform float uCameraNear;
  uniform float uCameraFar;
  uniform vec2 uResolution;
  uniform bool uUseSoftParticles;

  varying float vOpacity;
  varying vec3 vColor;
  varying vec4 vViewPos;

  float linearizeDepth(float depth) {
    float ndc = depth * 2.0 - 1.0;
    return (2.0 * uCameraNear * uCameraFar) / (uCameraFar + uCameraNear - ndc * (uCameraFar - uCameraNear));
  }

  void main() {
    // Circular particle shape
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float glow = exp(-d * d * 3.0);
    
    float alpha = glow * vOpacity;
    
    // Soft particle depth fading
    if (uUseSoftParticles) {
      vec2 screenUV = gl_FragCoord.xy / uResolution;
      float sceneDepth = linearizeDepth(texture2D(uDepthTexture, screenUV).r);
      float particleDepth = -vViewPos.z;
      float depthDiff = sceneDepth - particleDepth;
      float softFade = smoothstep(0.0, uSoftRange, depthDiff);
      alpha *= softFade;
    }
    
    if (alpha < 0.005) discard;
    
    // HDR emissive color
    vec3 finalColor = vColor * (1.0 + vOpacity * 2.0);
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// ── Smoke Soft Particle Shaders ─────────────────────────────────────

const SMOKE_SOFT_VERTEX = `
  attribute float aSize;
  attribute float aOpacity;
  attribute vec3 aColor;
  
  varying float vOpacity;
  varying vec3 vColor;
  varying vec4 vViewPos;
  
  void main() {
    vOpacity = aOpacity;
    vColor = aColor;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mvPos;
    gl_Position = projectionMatrix * mvPos;
    gl_PointSize = aSize * (300.0 / -mvPos.z);
  }
`;

const SMOKE_SOFT_FRAGMENT = `
  uniform sampler2D uDepthTexture;
  uniform float uSoftRange;
  uniform float uCameraNear;
  uniform float uCameraFar;
  uniform vec2 uResolution;
  uniform bool uUseSoftParticles;
  
  varying float vOpacity;
  varying vec3 vColor;
  varying vec4 vViewPos;
  
  float linearizeDepth(float depth) {
    float ndc = depth * 2.0 - 1.0;
    return (2.0 * uCameraNear * uCameraFar) / (uCameraFar + uCameraNear - ndc * (uCameraFar - uCameraNear));
  }
  
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = exp(-d * d * 2.5) * vOpacity;
    
    if (uUseSoftParticles) {
      vec2 screenUV = gl_FragCoord.xy / uResolution;
      float sceneDepth = linearizeDepth(texture2D(uDepthTexture, screenUV).r);
      float particleDepth = -vViewPos.z;
      float depthDiff = sceneDepth - particleDepth;
      float softFade = smoothstep(0.0, uSoftRange, depthDiff);
      alpha *= softFade;
    }
    
    if (alpha < 0.005) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

// ── Material Factory ────────────────────────────────────────────────

export interface SoftParticleMaterialOptions {
  softParticles?: boolean;
  softRange?: number;
  velocityStretch?: boolean;
  stretchScale?: number;
  blending?: THREE.Blending;
  depthTexture?: THREE.Texture | null;
  cameraNear?: number;
  cameraFar?: number;
  resolution?: THREE.Vector2;
}

export function createSoftParticleMaterial(options: SoftParticleMaterialOptions = {}): THREE.ShaderMaterial {
  const {
    softParticles = false,
    softRange = 0.5,
    velocityStretch = false,
    stretchScale = 0.3,
    blending = THREE.AdditiveBlending,
    depthTexture = null,
    cameraNear = 0.1,
    cameraFar = 1000,
    resolution = new THREE.Vector2(1920, 1080),
  } = options;

  return new THREE.ShaderMaterial({
    vertexShader: SOFT_PARTICLE_VERTEX,
    fragmentShader: SOFT_PARTICLE_FRAGMENT,
    uniforms: {
      uDepthTexture: { value: depthTexture },
      uSoftRange: { value: softRange },
      uUseSoftParticles: { value: softParticles },
      uStretchScale: { value: stretchScale },
      uVelocityStretch: { value: velocityStretch },
      uCameraNear: { value: cameraNear },
      uCameraFar: { value: cameraFar },
      uResolution: { value: resolution },
    },
    transparent: true,
    blending,
    depthWrite: false,
  });
}

export function createSmokeSoftMaterial(options: SoftParticleMaterialOptions = {}): THREE.ShaderMaterial {
  const {
    softParticles = true,
    softRange = 1.0,
    depthTexture = null,
    cameraNear = 0.1,
    cameraFar = 1000,
    resolution = new THREE.Vector2(1920, 1080),
  } = options;

  return new THREE.ShaderMaterial({
    vertexShader: SMOKE_SOFT_VERTEX,
    fragmentShader: SMOKE_SOFT_FRAGMENT,
    uniforms: {
      uDepthTexture: { value: depthTexture },
      uSoftRange: { value: softRange },
      uUseSoftParticles: { value: softParticles },
      uCameraNear: { value: cameraNear },
      uCameraFar: { value: cameraFar },
      uResolution: { value: resolution },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
}

/**
 * Update soft particle material uniforms when camera changes.
 */
export function updateSoftParticleUniforms(
  material: THREE.ShaderMaterial,
  camera: THREE.PerspectiveCamera,
  depthTexture: THREE.Texture | null,
  resolution: THREE.Vector2
) {
  material.uniforms.uDepthTexture.value = depthTexture;
  material.uniforms.uCameraNear.value = camera.near;
  material.uniforms.uCameraFar.value = camera.far;
  material.uniforms.uResolution.value = resolution;
}

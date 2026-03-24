/**
 * FX KONTROL · Volumetric Fog v2 — UE5.7 Exponential Height Fog
 * Raymarched height-based density, inscattering light shafts,
 * explosion flash scattering, and wind-driven drift.
 */

import * as THREE from 'three';

export interface FogConfig {
  density: number;             // base density multiplier
  heightFalloff: number;       // exponential falloff rate
  inscatteringColor: THREE.Color;
  inscatteringIntensity: number;
  maxOpacity: number;
  startDistance: number;       // fog starts fading in at this distance from camera
  fogColor: THREE.Color;
  height: number;              // fog layer max height
  windSpeed: number;
  windDirection: [number, number];
}

const DEFAULT_FOG: FogConfig = {
  density: 0.6,
  heightFalloff: 0.08,
  inscatteringColor: new THREE.Color(0.1, 0.12, 0.2),
  inscatteringIntensity: 0.5,
  maxOpacity: 0.45,
  startDistance: 10,
  fogColor: new THREE.Color(0.03, 0.04, 0.08),
  height: 15,
  windSpeed: 2,
  windDirection: [1, 0.3],
};

const FOG_VERTEX = `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FOG_FRAGMENT = `
  uniform float uTime;
  uniform float uDensity;
  uniform float uHeightFalloff;
  uniform float uMaxOpacity;
  uniform float uStartDistance;
  uniform float uHeight;
  uniform vec3 uFogColor;
  uniform vec3 uInscatteringColor;
  uniform float uInscatteringIntensity;
  uniform vec3 uSunDirection;
  uniform vec2 uWindDir;
  uniform float uWindSpeed;
  
  // Explosion flash
  uniform float uExplosionFlash;
  uniform vec3 uExplosionColor;
  uniform vec3 uExplosionPos;

  varying vec2 vUv;
  varying vec3 vWorldPos;

  // ─── Noise ───
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1,0)), f.x),
      mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
      v += amp * noise(p);
      p *= 2.03;
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    // Wind-driven UV offset
    vec2 windOffset = uWindDir * uWindSpeed * uTime * 0.005;
    vec2 uv = vUv * 4.0 + windOffset;

    // ─── Density noise (FBM) ───
    float n = fbm(uv);
    float detailN = fbm(uv * 3.0 + vec2(uTime * 0.01));
    float density = n * 0.7 + detailN * 0.3;

    // ─── Exponential height falloff ───
    float heightFade = exp(-max(vWorldPos.y, 0.0) * uHeightFalloff);
    heightFade *= smoothstep(uHeight * 1.5, 0.0, vWorldPos.y);

    // ─── Distance from camera ───
    float cameraDist = length(cameraPosition.xz - vWorldPos.xz);
    float distFade = smoothstep(uStartDistance, uStartDistance + 50.0, cameraDist);

    // ─── Edge fade ───
    float edgeDist = min(vUv.x, min(vUv.y, min(1.0 - vUv.x, 1.0 - vUv.y)));
    float edgeFade = smoothstep(0.0, 0.25, edgeDist);

    // ─── Combined density ───
    float finalDensity = density * heightFade * edgeFade * uDensity;
    finalDensity = min(finalDensity, uMaxOpacity);

    if (finalDensity < 0.005) discard;

    // ─── Inscattering (light shafts from sun direction) ───
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float inscatter = max(dot(viewDir, normalize(uSunDirection)), 0.0);
    inscatter = pow(inscatter, 4.0) * uInscatteringIntensity;
    vec3 inscatterColor = uInscatteringColor * inscatter;

    // ─── Explosion flash scattering ───
    vec3 explosionScatter = vec3(0.0);
    if (uExplosionFlash > 0.01) {
      float distToExplosion = length(vWorldPos.xz - uExplosionPos.xz);
      float falloff = exp(-distToExplosion * distToExplosion / 80000.0);
      // Volumetric inscattering from burst
      float phase = 0.5 + 0.5 * dot(viewDir, normalize(uExplosionPos - vWorldPos));
      explosionScatter = uExplosionColor * uExplosionFlash * falloff * phase * 0.4;
    }

    // ─── Final color ───
    vec3 fogCol = uFogColor + inscatterColor + explosionScatter;

    gl_FragColor = vec4(fogCol, finalDensity);
  }
`;

export function createVolumetricFogPlane(
  size = 500,
  fogColor?: THREE.Color,
  intensity?: number,
  height?: number,
  config?: Partial<FogConfig>,
) {
  const cfg: FogConfig = {
    ...DEFAULT_FOG,
    ...(fogColor ? { fogColor } : {}),
    ...(intensity !== undefined ? { density: intensity } : {}),
    ...(height !== undefined ? { height } : {}),
    ...config,
  };

  const geometry = new THREE.PlaneGeometry(size, size, 1, 1);
  const material = new THREE.ShaderMaterial({
    vertexShader: FOG_VERTEX,
    fragmentShader: FOG_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uDensity: { value: cfg.density },
      uHeightFalloff: { value: cfg.heightFalloff },
      uMaxOpacity: { value: cfg.maxOpacity },
      uStartDistance: { value: cfg.startDistance },
      uHeight: { value: cfg.height },
      uFogColor: { value: cfg.fogColor.clone() },
      uInscatteringColor: { value: cfg.inscatteringColor.clone() },
      uInscatteringIntensity: { value: cfg.inscatteringIntensity },
      uSunDirection: { value: new THREE.Vector3(0.3, 0.8, 0.5).normalize() },
      uWindDir: { value: new THREE.Vector2(...cfg.windDirection) },
      uWindSpeed: { value: cfg.windSpeed },
      uExplosionFlash: { value: 0 },
      uExplosionColor: { value: new THREE.Color(0, 0, 0) },
      uExplosionPos: { value: new THREE.Vector3(0, 100, 0) },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.5;

  return {
    mesh,
    update(time: number) {
      material.uniforms.uTime.value = time;
      // Decay explosion flash
      const u = material.uniforms.uExplosionFlash;
      if (u.value > 0.01) u.value *= 0.92;
    },
    setIntensity(v: number) {
      material.uniforms.uDensity.value = v;
    },
    setHeightFalloff(v: number) {
      material.uniforms.uHeightFalloff.value = v;
    },
    setSunDirection(dir: THREE.Vector3) {
      material.uniforms.uSunDirection.value.copy(dir).normalize();
    },
    setWindSpeed(v: number) {
      material.uniforms.uWindSpeed.value = v;
    },
    setWindDirection(x: number, z: number) {
      material.uniforms.uWindDir.value.set(x, z);
    },
    /** Flash fog with firework explosion light (volumetric inscattering) */
    flashExplosion(position: THREE.Vector3, color: THREE.Color, intensity: number) {
      material.uniforms.uExplosionPos.value.copy(position);
      material.uniforms.uExplosionColor.value.copy(color);
      material.uniforms.uExplosionFlash.value = Math.min(intensity, 2);
    },
  };
}

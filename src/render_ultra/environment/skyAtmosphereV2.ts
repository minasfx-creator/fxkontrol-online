/**
 * FX KONTROL · Sky Atmosphere v2
 * UE5.7-grade physically-based sky with Rayleigh + Mie scattering,
 * sun/moon disc, horizon haze, and multi-scatter approximation.
 */

import * as THREE from 'three';

const SKY_V2_VERTEX = `
  varying vec3 vDirection;
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vDirection = normalize(wp.xyz - cameraPosition);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const SKY_V2_FRAGMENT = `
  uniform vec3 uSunDirection;
  uniform float uSunIntensity;
  uniform vec3 uSunColor;
  uniform float uSunDiscSize;      // angular size
  uniform float uMoonPhase;        // 0-1
  uniform vec3 uMoonDirection;

  // Scattering coefficients
  uniform vec3 uRayleighCoeff;     // wavelength-dependent scatter
  uniform float uMieCoeff;
  uniform float uMieAnisotropy;    // forward scatter directionality (0.7-0.99)
  uniform float uAtmosphereDensity;
  uniform float uHorizonHaze;
  uniform float uMultiScatter;     // multi-scatter approximation intensity

  // Time-of-day colors
  uniform vec3 uZenithTint;
  uniform vec3 uHorizonTint;
  uniform vec3 uNightColor;
  uniform float uStarBrightness;

  // Explosion scatter
  uniform vec3 uExplosionScatter;
  uniform float uScatterIntensity;

  varying vec3 vDirection;
  varying vec3 vWorldPos;

  // ─── Phase functions ───
  float rayleighPhase(float cosTheta) {
    return 0.75 * (1.0 + cosTheta * cosTheta);
  }

  float miePhase(float cosTheta, float g) {
    float g2 = g * g;
    float num = (1.0 - g2);
    float denom = pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5);
    return num / (4.0 * 3.14159265 * denom);
  }

  // ─── Stars ───
  float hash(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
  }

  float stars(vec3 dir) {
    vec3 cell = floor(dir * 800.0);
    float h = hash(cell);
    if (h > 0.997) {
      vec3 cellCenter = (cell + 0.5) / 800.0;
      float d = length(dir - normalize(cellCenter));
      float brightness = (h - 0.997) / 0.003;
      return smoothstep(0.0015, 0.0, d) * brightness * brightness;
    }
    return 0.0;
  }

  void main() {
    vec3 dir = normalize(vDirection);
    float elevation = dir.y;
    float cosTheta = dot(dir, uSunDirection);
    float cosThetaMoon = dot(dir, uMoonDirection);

    // ─── Atmospheric scattering ───
    float zenithAngle = acos(max(0.0, elevation));
    float opticalDepth = uAtmosphereDensity / (max(elevation, 0.01));

    // Rayleigh scattering (blue sky)
    vec3 rayleigh = uRayleighCoeff * rayleighPhase(cosTheta) * exp(-opticalDepth * uRayleighCoeff);
    
    // Mie scattering (sun halo, horizon glow)
    float mie = uMieCoeff * miePhase(cosTheta, uMieAnisotropy) * exp(-opticalDepth * uMieCoeff * 0.5);

    // Combined single-scatter
    vec3 scatter = (rayleigh + vec3(mie)) * uSunIntensity * uSunColor;

    // Multi-scatter approximation (brightens shadow side of sky)
    scatter += uRayleighCoeff * uMultiScatter * uSunIntensity * 0.1;

    // ─── Sky color composition ───
    vec3 sky;
    if (elevation > 0.0) {
      float t = pow(elevation, 0.45);
      vec3 baseGradient = mix(uHorizonTint, uZenithTint, t);
      sky = baseGradient + scatter;

      // Horizon haze band
      float haze = exp(-elevation * elevation * 60.0) * uHorizonHaze;
      sky += uHorizonTint * haze * 0.3;
    } else {
      sky = uNightColor * 0.5;
    }

    // ─── Sun disc ───
    float sunAngle = acos(clamp(cosTheta, -1.0, 1.0));
    float sunDisc = smoothstep(uSunDiscSize * 1.2, uSunDiscSize * 0.8, sunAngle);
    float sunCorona = exp(-sunAngle * sunAngle / (uSunDiscSize * uSunDiscSize * 8.0));
    sky += uSunColor * sunDisc * uSunIntensity * 5.0;
    sky += uSunColor * sunCorona * uSunIntensity * 0.3;

    // ─── Moon disc ───
    float moonAngle = acos(clamp(cosThetaMoon, -1.0, 1.0));
    float moonDisc = smoothstep(0.012, 0.008, moonAngle);
    sky += vec3(0.6, 0.65, 0.8) * moonDisc * 0.4;

    // ─── Stars (only at night) ───
    float nightFactor = smoothstep(0.05, -0.1, uSunDirection.y);
    if (nightFactor > 0.01 && elevation > 0.0) {
      float s = stars(dir) * uStarBrightness * nightFactor;
      sky += vec3(s);
    }

    // ─── Night sky color ───
    sky = mix(sky, uNightColor, nightFactor * smoothstep(-0.1, 0.3, elevation) * 0.5);

    // ─── Explosion light scatter ───
    sky += uExplosionScatter * uScatterIntensity * exp(-abs(elevation) * 3.0);

    gl_FragColor = vec4(max(sky, vec3(0.0)), 1.0);
  }
`;

export interface SkyAtmosphereConfig {
  sunDirection: THREE.Vector3;
  sunIntensity: number;
  sunColor: THREE.Color;
  sunDiscSize: number;
  moonDirection: THREE.Vector3;
  moonPhase: number;
  rayleighCoeff: THREE.Vector3;  // wavelength RGB scatter
  mieCoeff: number;
  mieAnisotropy: number;
  atmosphereDensity: number;
  horizonHaze: number;
  multiScatter: number;
  zenithTint: THREE.Color;
  horizonTint: THREE.Color;
  nightColor: THREE.Color;
  starBrightness: number;
}

const DEFAULT_SKY_CONFIG: SkyAtmosphereConfig = {
  sunDirection: new THREE.Vector3(0.3, -0.5, 0.5).normalize(),
  sunIntensity: 0.0,     // night scene default
  sunColor: new THREE.Color(1.0, 0.95, 0.8),
  sunDiscSize: 0.015,
  moonDirection: new THREE.Vector3(-0.3, 0.6, 0.4).normalize(),
  moonPhase: 0.7,
  rayleighCoeff: new THREE.Vector3(0.0058, 0.0135, 0.0331),  // standard atmosphere
  mieCoeff: 0.003,
  mieAnisotropy: 0.85,
  atmosphereDensity: 1.0,
  horizonHaze: 0.5,
  multiScatter: 0.3,
  zenithTint: new THREE.Color(0.01, 0.015, 0.05),
  horizonTint: new THREE.Color(0.04, 0.05, 0.12),
  nightColor: new THREE.Color(0.005, 0.008, 0.02),
  starBrightness: 1.5,
};

export function createSkyAtmosphereV2(radius = 2000, config?: Partial<SkyAtmosphereConfig>) {
  const cfg = { ...DEFAULT_SKY_CONFIG, ...config };

  const geometry = new THREE.SphereGeometry(radius, 48, 24);
  const material = new THREE.ShaderMaterial({
    vertexShader: SKY_V2_VERTEX,
    fragmentShader: SKY_V2_FRAGMENT,
    uniforms: {
      uSunDirection: { value: cfg.sunDirection.clone() },
      uSunIntensity: { value: cfg.sunIntensity },
      uSunColor: { value: cfg.sunColor.clone() },
      uSunDiscSize: { value: cfg.sunDiscSize },
      uMoonDirection: { value: cfg.moonDirection.clone() },
      uMoonPhase: { value: cfg.moonPhase },
      uRayleighCoeff: { value: cfg.rayleighCoeff.clone() },
      uMieCoeff: { value: cfg.mieCoeff },
      uMieAnisotropy: { value: cfg.mieAnisotropy },
      uAtmosphereDensity: { value: cfg.atmosphereDensity },
      uHorizonHaze: { value: cfg.horizonHaze },
      uMultiScatter: { value: cfg.multiScatter },
      uZenithTint: { value: cfg.zenithTint.clone() },
      uHorizonTint: { value: cfg.horizonTint.clone() },
      uNightColor: { value: cfg.nightColor.clone() },
      uStarBrightness: { value: cfg.starBrightness },
      uExplosionScatter: { value: new THREE.Color(0, 0, 0) },
      uScatterIntensity: { value: 0 },
    },
    side: THREE.BackSide,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, material);

  return {
    mesh,
    /** Update sun position and recalculate sky */
    setSunDirection(dir: THREE.Vector3) {
      material.uniforms.uSunDirection.value.copy(dir).normalize();
      // Auto-adjust intensity based on sun elevation
      const sunElevation = dir.y;
      material.uniforms.uSunIntensity.value = Math.max(0, sunElevation * 2);
    },
    setSunIntensity(v: number) { material.uniforms.uSunIntensity.value = v; },
    setMoonDirection(dir: THREE.Vector3) { material.uniforms.uMoonDirection.value.copy(dir).normalize(); },
    setCoverage(haze: number) { material.uniforms.uHorizonHaze.value = haze; },
    setStarBrightness(v: number) { material.uniforms.uStarBrightness.value = v; },
    /** Flash sky scatter from firework burst */
    flashScatter(color: THREE.Color, intensity: number) {
      material.uniforms.uExplosionScatter.value.copy(color);
      material.uniforms.uScatterIntensity.value = intensity;
    },
    decayScatter(dt: number) {
      material.uniforms.uScatterIntensity.value *= Math.max(0, 1 - dt * 3);
    },
    /** Apply time-of-day colors */
    setTimeOfDay(zenith: THREE.Color, horizon: THREE.Color, night: THREE.Color) {
      material.uniforms.uZenithTint.value.copy(zenith);
      material.uniforms.uHorizonTint.value.copy(horizon);
      material.uniforms.uNightColor.value.copy(night);
    },
  };
}

/** Preset atmosphere configs for different times of day */
export const SKY_PRESETS = {
  night: DEFAULT_SKY_CONFIG,
  goldenHour: {
    sunIntensity: 1.5,
    sunDirection: new THREE.Vector3(0.8, 0.15, 0.5).normalize(),
    sunColor: new THREE.Color(1.0, 0.6, 0.2),
    zenithTint: new THREE.Color(0.1, 0.15, 0.4),
    horizonTint: new THREE.Color(0.5, 0.25, 0.1),
    nightColor: new THREE.Color(0.02, 0.02, 0.05),
    starBrightness: 0.0,
  },
  twilight: {
    sunIntensity: 0.3,
    sunDirection: new THREE.Vector3(0.8, -0.05, 0.5).normalize(),
    sunColor: new THREE.Color(1.0, 0.4, 0.15),
    zenithTint: new THREE.Color(0.03, 0.04, 0.15),
    horizonTint: new THREE.Color(0.3, 0.12, 0.08),
    nightColor: new THREE.Color(0.01, 0.01, 0.03),
    starBrightness: 0.5,
  },
  blueHour: {
    sunIntensity: 0.05,
    sunDirection: new THREE.Vector3(0.8, -0.15, 0.5).normalize(),
    sunColor: new THREE.Color(0.5, 0.3, 0.2),
    zenithTint: new THREE.Color(0.02, 0.03, 0.12),
    horizonTint: new THREE.Color(0.08, 0.06, 0.15),
    nightColor: new THREE.Color(0.008, 0.01, 0.025),
    starBrightness: 1.0,
  },
} as const;

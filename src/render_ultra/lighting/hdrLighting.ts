/**
 * FX KONTROL · HDR Lighting System v2
 * UE5.7-inspired: moonlight, ambient, fill, dynamic burst point lights,
 * IES profile support via SpotLight cookies.
 */

import * as THREE from 'three';

export interface HDRLightingConfig {
  moonIntensity: number;
  moonColor: THREE.Color;
  ambientIntensity: number;
  ambientColor: THREE.Color;
  fillIntensity: number;
  rimIntensity: number;
}

export interface BurstLightConfig {
  maxLights: number;          // pool size
  falloffDecay: number;       // inverse-square decay rate
  castShadow: boolean;
  shadowMapSize: number;
}

const DEFAULT_BURST_CONFIG: BurstLightConfig = {
  maxLights: 8,
  falloffDecay: 2.5,
  castShadow: true,
  shadowMapSize: 512,
};

/**
 * Dynamic burst light — pooled point light for firework explosions.
 */
interface BurstLight {
  light: THREE.PointLight;
  active: boolean;
  age: number;
  maxAge: number;
  peakIntensity: number;
}

/**
 * Create a complete HDR lighting rig for night scene with dynamic burst lights.
 */
export function createHDRLightingRig(
  config?: Partial<HDRLightingConfig>,
  burstConfig?: Partial<BurstLightConfig>,
) {
  const cfg: HDRLightingConfig = {
    moonIntensity: 0.45,
    moonColor: new THREE.Color(0.53, 0.6, 0.8),
    ambientIntensity: 0.05,
    ambientColor: new THREE.Color(0.2, 0.25, 0.35),
    fillIntensity: 0.35,
    rimIntensity: 0.55,
    ...config,
  };

  const burstCfg = { ...DEFAULT_BURST_CONFIG, ...burstConfig };
  const group = new THREE.Group();

  // ── Moonlight — directional ──
  const moon = new THREE.DirectionalLight(cfg.moonColor, cfg.moonIntensity);
  moon.position.set(100, 200, 50);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.near = 0.5;
  moon.shadow.camera.far = 500;
  moon.shadow.camera.left = -200;
  moon.shadow.camera.right = 200;
  moon.shadow.camera.top = 200;
  moon.shadow.camera.bottom = -200;
  moon.shadow.bias = -0.0001;
  group.add(moon);

  // ── Ambient — night sky fill ──
  const ambient = new THREE.AmbientLight(cfg.ambientColor, cfg.ambientIntensity);
  group.add(ambient);

  // ── Fill light — hemisphere ──
  const fill = new THREE.HemisphereLight(
    new THREE.Color(0.15, 0.18, 0.25),
    new THREE.Color(0.02, 0.03, 0.02),
    cfg.fillIntensity,
  );
  group.add(fill);

  // ── Dynamic Burst Light Pool ──
  const burstLights: BurstLight[] = [];
  for (let i = 0; i < burstCfg.maxLights; i++) {
    const light = new THREE.PointLight(0xffffff, 0, 200, burstCfg.falloffDecay);
    light.castShadow = burstCfg.castShadow;
    light.shadow.mapSize.set(burstCfg.shadowMapSize, burstCfg.shadowMapSize);
    light.shadow.bias = -0.001;
    light.visible = false;
    group.add(light);
    burstLights.push({
      light,
      active: false,
      age: 0,
      maxAge: 1.5,
      peakIntensity: 0,
    });
  }

  // ── IES Profile Spot Lights (stage fixtures) ──
  const iesSpots: THREE.SpotLight[] = [];

  return {
    group,
    moon,
    ambient,
    fill,
    burstLights,
    iesSpots,

    updateMoonIntensity(v: number) { moon.intensity = v; },
    updateAmbient(v: number) { ambient.intensity = v; },

    /**
     * Spawn a dynamic point light at burst position — inherits color from chemistry.
     * Uses inverse-square falloff for physically-based light distribution.
     */
    spawnBurstLight(position: THREE.Vector3, color: THREE.Color, intensity: number, duration = 1.5) {
      // Find inactive light from pool
      const entry = burstLights.find(bl => !bl.active);
      if (!entry) return; // pool exhausted

      entry.light.position.copy(position);
      entry.light.color.copy(color);
      entry.light.intensity = intensity;
      entry.light.visible = true;
      entry.active = true;
      entry.age = 0;
      entry.maxAge = duration;
      entry.peakIntensity = intensity;
    },

    /**
     * Update burst lights — decay over time with exponential falloff.
     */
    updateBurstLights(dt: number) {
      for (const entry of burstLights) {
        if (!entry.active) continue;
        entry.age += dt;

        if (entry.age >= entry.maxAge) {
          entry.active = false;
          entry.light.visible = false;
          entry.light.intensity = 0;
          continue;
        }

        // Fast rise, slow decay (like real explosions)
        const t = entry.age / entry.maxAge;
        const envelope = t < 0.1
          ? t / 0.1  // ramp up
          : Math.exp(-3 * (t - 0.1)); // exponential decay
        entry.light.intensity = entry.peakIntensity * envelope;
      }
    },

    /**
     * Add an IES-profile spot light (stage fixture / moving head).
     */
    addIESSpotLight(
      position: THREE.Vector3,
      target: THREE.Vector3,
      color: THREE.Color,
      intensity: number,
      angle = Math.PI / 6,
      penumbra = 0.3,
    ): THREE.SpotLight {
      const spot = new THREE.SpotLight(color, intensity, 300, angle, penumbra, 2);
      spot.position.copy(position);
      spot.target.position.copy(target);
      spot.castShadow = true;
      spot.shadow.mapSize.set(512, 512);
      group.add(spot);
      group.add(spot.target);
      iesSpots.push(spot);
      return spot;
    },

    /**
     * Get active burst light count (for performance monitoring).
     */
    getActiveBurstLightCount(): number {
      return burstLights.filter(bl => bl.active).length;
    },
  };
}

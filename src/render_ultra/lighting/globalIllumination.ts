/**
 * FX KONTROL · Global Illumination Approximation
 * Dynamic light bounce from firework explosions — fake GI using fast color probes.
 */

import * as THREE from 'three';

export interface LightProbe {
  position: THREE.Vector3;
  color: THREE.Color;
  intensity: number;
  decay: number;        // per-second decay rate
  radius: number;       // influence radius
}

export class GlobalIlluminationSystem {
  private probes: LightProbe[] = [];
  private hemLight: THREE.HemisphereLight;
  private accumColor = new THREE.Color(0, 0, 0);
  private accumIntensity = 0;

  constructor(scene: THREE.Scene) {
    // Dynamic hemisphere light driven by explosion probes
    this.hemLight = new THREE.HemisphereLight(0x000000, 0x000000, 0);
    scene.add(this.hemLight);
  }

  /**
   * Register a light probe from an explosion.
   */
  addExplosionProbe(position: THREE.Vector3, color: THREE.Color, intensity: number) {
    this.probes.push({
      position: position.clone(),
      color: color.clone(),
      intensity,
      decay: 2.5,
      radius: 150,
    });
  }

  /**
   * Update GI system — decays probes and updates hemisphere light.
   */
  update(dt: number) {
    this.accumColor.set(0, 0, 0);
    this.accumIntensity = 0;

    this.probes = this.probes.filter(p => {
      p.intensity *= Math.max(0, 1 - p.decay * dt);
      if (p.intensity < 0.01) return false;

      this.accumColor.r += p.color.r * p.intensity;
      this.accumColor.g += p.color.g * p.intensity;
      this.accumColor.b += p.color.b * p.intensity;
      this.accumIntensity += p.intensity;
      return true;
    });

    if (this.accumIntensity > 0) {
      const scale = 1 / (this.accumIntensity + 1);
      this.hemLight.color.copy(this.accumColor).multiplyScalar(scale);
      this.hemLight.intensity = Math.min(this.accumIntensity * 0.15, 0.8);
    } else {
      this.hemLight.intensity = 0;
    }
  }

  get activeProbes() { return this.probes.length; }
}

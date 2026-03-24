/**
 * FX KONTROL · Atmosphere Scattering
 * Rayleigh-inspired sky gradient with horizon glow and light diffusion.
 */

import * as THREE from 'three';

const SKY_VERTEX = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const SKY_FRAGMENT = `
  uniform vec3 uZenithColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uGroundColor;
  uniform float uHorizonGlow;
  uniform float uSkyBrightness;
  uniform vec3 uLightScatter;  // explosion light color
  uniform float uScatterIntensity;
  varying vec3 vWorldPosition;

  void main() {
    vec3 dir = normalize(vWorldPosition);
    float elevation = dir.y;

    // Sky gradient — Rayleigh-like
    vec3 sky;
    if (elevation > 0.0) {
      float t = pow(elevation, 0.4);
      sky = mix(uHorizonColor, uZenithColor, t);
      // Horizon glow band
      float horizonBand = exp(-elevation * elevation * 80.0) * uHorizonGlow;
      sky += uHorizonColor * horizonBand * 0.5;
    } else {
      sky = uGroundColor;
    }

    // Light scatter from explosions
    sky += uLightScatter * uScatterIntensity * exp(-abs(elevation) * 3.0);

    sky *= uSkyBrightness;
    gl_FragColor = vec4(sky, 1.0);
  }
`;

export function createAtmosphereSphere(radius = 2000) {
  const geometry = new THREE.SphereGeometry(radius, 32, 16);
  const material = new THREE.ShaderMaterial({
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    uniforms: {
      uZenithColor: { value: new THREE.Color(0.01, 0.015, 0.05) },
      uHorizonColor: { value: new THREE.Color(0.04, 0.05, 0.12) },
      uGroundColor: { value: new THREE.Color(0.005, 0.005, 0.01) },
      uHorizonGlow: { value: 0.5 },
      uSkyBrightness: { value: 1.0 },
      uLightScatter: { value: new THREE.Color(0, 0, 0) },
      uScatterIntensity: { value: 0 },
    },
    side: THREE.BackSide,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, material);

  return {
    mesh,
    setHorizonGlow(v: number) { material.uniforms.uHorizonGlow.value = v; },
    setSkyBrightness(v: number) { material.uniforms.uSkyBrightness.value = v; },
    /**
     * Flash the sky with explosion light scatter.
     */
    flashScatter(color: THREE.Color, intensity: number) {
      material.uniforms.uLightScatter.value.copy(color);
      material.uniforms.uScatterIntensity.value = intensity;
    },
    decayScatter(dt: number) {
      material.uniforms.uScatterIntensity.value *= Math.max(0, 1 - dt * 3);
    },
  };
}

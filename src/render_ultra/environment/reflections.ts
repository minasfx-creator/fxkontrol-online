/**
 * FX KONTROL · Ground Reflections
 * Wet-surface specular reflections that react to firework explosions.
 */

import * as THREE from 'three';

const REFLECTION_VERTEX = `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const REFLECTION_FRAGMENT = `
  uniform float uWetness;
  uniform float uTime;
  uniform vec3 uReflectionColor;
  uniform float uReflectionIntensity;
  varying vec2 vUv;
  varying vec3 vWorldPos;

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

  void main() {
    // Distance-based fade
    float dist = length(vWorldPos.xz) / 200.0;
    float distFade = 1.0 - smoothstep(0.0, 1.0, dist);

    // Noise-based puddle mask
    float puddle = noise(vUv * 8.0 + uTime * 0.01);
    puddle = smoothstep(0.3, 0.7, puddle) * uWetness;

    // Reflection intensity
    float refl = puddle * distFade * uReflectionIntensity;

    gl_FragColor = vec4(uReflectionColor * refl, refl * 0.3);
  }
`;

export function createReflectionPlane(size = 400) {
  const geometry = new THREE.PlaneGeometry(size, size);
  const material = new THREE.ShaderMaterial({
    vertexShader: REFLECTION_VERTEX,
    fragmentShader: REFLECTION_FRAGMENT,
    uniforms: {
      uWetness: { value: 0.3 },
      uTime: { value: 0 },
      uReflectionColor: { value: new THREE.Color(0.1, 0.15, 0.2) },
      uReflectionIntensity: { value: 0.5 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.05;

  return {
    mesh,
    update(time: number) {
      material.uniforms.uTime.value = time;
    },
    /**
     * Flash ground reflections when a firework explodes.
     */
    flashExplosion(color: THREE.Color, intensity: number) {
      material.uniforms.uReflectionColor.value.copy(color);
      material.uniforms.uReflectionIntensity.value = intensity;
    },
    decayReflection(dt: number) {
      const u = material.uniforms.uReflectionIntensity;
      u.value = Math.max(0.5, u.value * (1 - dt * 2));
    },
    setWetness(v: number) {
      material.uniforms.uWetness.value = v;
    },
  };
}

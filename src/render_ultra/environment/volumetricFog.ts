/**
 * FX KONTROL · Volumetric Fog System
 * Layered ground fog with animated noise for depth perception.
 */

import * as THREE from 'three';

const FOG_VERTEX = `
  varying vec2 vUv;
  varying float vWorldY;
  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldY = worldPos.y;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const FOG_FRAGMENT = `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uHeight;
  uniform vec3 uFogColor;
  varying vec2 vUv;
  varying float vWorldY;

  // Simplex-like noise
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    v += 0.5 * noise(p); p *= 2.01;
    v += 0.25 * noise(p); p *= 2.02;
    v += 0.125 * noise(p); p *= 2.03;
    v += 0.0625 * noise(p);
    return v;
  }

  void main() {
    vec2 uv = vUv * 4.0 + vec2(uTime * 0.02, uTime * 0.01);
    float n = fbm(uv);
    float heightFade = smoothstep(uHeight, 0.0, vWorldY);
    float edgeFade = smoothstep(0.0, 0.3, min(vUv.x, min(vUv.y, min(1.0 - vUv.x, 1.0 - vUv.y))));
    float alpha = n * heightFade * edgeFade * uIntensity;
    gl_FragColor = vec4(uFogColor, alpha * 0.4);
  }
`;

export function createVolumetricFogPlane(
  size = 500,
  fogColor = new THREE.Color(0.03, 0.04, 0.08),
  intensity = 0.6,
  height = 15
) {
  const geometry = new THREE.PlaneGeometry(size, size, 1, 1);
  const material = new THREE.ShaderMaterial({
    vertexShader: FOG_VERTEX,
    fragmentShader: FOG_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: intensity },
      uHeight: { value: height },
      uFogColor: { value: fogColor },
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
    },
    setIntensity(v: number) {
      material.uniforms.uIntensity.value = v;
    },
  };
}

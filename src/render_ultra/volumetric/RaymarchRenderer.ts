/**
 * RaymarchRenderer — THREE.js WebGL fallback volumetric renderer.
 * Uses GLSL raymarching through a 3D texture on a box geometry.
 * Beer-Lambert absorption, Henyey-Greenstein scattering, ACES tonemap.
 */
import * as THREE from 'three';
import { VoxelGrid } from './VoxelGrid';

const VERT = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vLocalPos;
void main() {
  vLocalPos = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
precision highp float;
precision highp sampler3D;

uniform sampler3D uVolume;
uniform vec3 uCameraPos;
uniform float uStepSize;
uniform int uMaxSteps;
uniform float uDensityScale;
uniform float uEmissionScale;
uniform float uAbsorption;
uniform float uScattering;
uniform float uAnisotropy;

varying vec3 vWorldPos;
varying vec3 vLocalPos;

float phaseHG(float cosTheta, float g) {
  float denom = 1.0 + g * g - 2.0 * g * cosTheta;
  return (1.0 - g * g) / (4.0 * 3.14159 * denom * sqrt(denom));
}

vec3 acesTonemap(vec3 x) {
  float a = 2.51; float b = 0.03; float c = 2.43; float d = 0.59; float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec3 rayDir = normalize(vWorldPos - uCameraPos);
  vec3 rayOrigin = vLocalPos; // local space [-0.5, 0.5]

  float transmittance = 1.0;
  vec3 color = vec3(0.0);
  vec3 lightDir = normalize(vec3(0.2, 1.0, 0.3));

  for (int i = 0; i < 128; i++) {
    if (i >= uMaxSteps) break;
    if (transmittance < 0.01) break;

    vec3 pos = rayOrigin + rayDir * float(i) * uStepSize;
    vec3 uvw = pos + 0.5; // map [-0.5,0.5] → [0,1]

    if (any(lessThan(uvw, vec3(0.0))) || any(greaterThan(uvw, vec3(1.0)))) continue;

    vec4 sample_ = texture(uVolume, uvw);
    float density = sample_.r * uDensityScale;
    float emission = sample_.g * uEmissionScale;
    float temperature = sample_.b;

    float absorb = exp(-density * uAbsorption * uStepSize);
    float cosTheta = dot(rayDir, lightDir);
    float phase = phaseHG(cosTheta, uAnisotropy);
    float scatter = density * uScattering * phase;

    vec3 fireColor = vec3(1.0, mix(0.3, 0.9, temperature), mix(0.05, 0.4, temperature));
    vec3 stepColor = fireColor * emission + vec3(0.5) * scatter;

    color += stepColor * transmittance * uStepSize;
    transmittance *= absorb;
  }

  vec3 mapped = acesTonemap(color);
  gl_FragColor = vec4(mapped, 1.0 - transmittance);
}
`;

export interface RaymarchConfig {
  stepSize: number;
  maxSteps: number;
  densityScale: number;
  emissionScale: number;
  absorption: number;
  scattering: number;
  anisotropy: number;
}

export const DEFAULT_RAYMARCH_CONFIG: RaymarchConfig = {
  stepSize: 0.02,
  maxSteps: 96,
  densityScale: 8.0,
  emissionScale: 3.0,
  absorption: 1.2,
  scattering: 0.6,
  anisotropy: 0.35,
};

export class RaymarchRenderer {
  readonly mesh: THREE.Mesh;
  private _material: THREE.ShaderMaterial;
  private _texture: THREE.Data3DTexture;

  constructor(
    private _grid: VoxelGrid,
    config: Partial<RaymarchConfig> = {},
  ) {
    const c = { ...DEFAULT_RAYMARCH_CONFIG, ...config };

    this._texture = new THREE.Data3DTexture(
      new Float32Array(_grid.cellCount * 4),
      _grid.resX, _grid.resY, _grid.resZ,
    );
    this._texture.format = THREE.RGBAFormat;
    this._texture.type = THREE.FloatType;
    this._texture.minFilter = THREE.LinearFilter;
    this._texture.magFilter = THREE.LinearFilter;
    this._texture.wrapS = THREE.ClampToEdgeWrapping;
    this._texture.wrapT = THREE.ClampToEdgeWrapping;
    this._texture.wrapR = THREE.ClampToEdgeWrapping;
    this._texture.needsUpdate = true;

    this._material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      uniforms: {
        uVolume: { value: this._texture },
        uCameraPos: { value: new THREE.Vector3() },
        uStepSize: { value: c.stepSize },
        uMaxSteps: { value: c.maxSteps },
        uDensityScale: { value: c.densityScale },
        uEmissionScale: { value: c.emissionScale },
        uAbsorption: { value: c.absorption },
        uScattering: { value: c.scattering },
        uAnisotropy: { value: c.anisotropy },
      },
    });

    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.mesh = new THREE.Mesh(geo, this._material);
    this.mesh.scale.set(_grid.worldSize[0], _grid.worldSize[1], _grid.worldSize[2]);
    this.mesh.position.set(_grid.worldOrigin[0], _grid.worldOrigin[1], _grid.worldOrigin[2]);
    this.mesh.frustumCulled = false;
  }

  uploadGrid(): void {
    const data = this._grid.packTextureData();
    (this._texture.image as { data: Float32Array }).data.set(data);
    this._texture.needsUpdate = true;
  }

  updateCamera(camPos: THREE.Vector3): void {
    this._material.uniforms.uCameraPos.value.copy(camPos);
  }

  updateConfig(c: Partial<RaymarchConfig>): void {
    const u = this._material.uniforms;
    if (c.stepSize !== undefined) u.uStepSize.value = c.stepSize;
    if (c.maxSteps !== undefined) u.uMaxSteps.value = c.maxSteps;
    if (c.densityScale !== undefined) u.uDensityScale.value = c.densityScale;
    if (c.emissionScale !== undefined) u.uEmissionScale.value = c.emissionScale;
    if (c.absorption !== undefined) u.uAbsorption.value = c.absorption;
    if (c.scattering !== undefined) u.uScattering.value = c.scattering;
    if (c.anisotropy !== undefined) u.uAnisotropy.value = c.anisotropy;
  }

  dispose(): void {
    this._texture.dispose();
    this._material.dispose();
    this.mesh.geometry.dispose();
  }
}

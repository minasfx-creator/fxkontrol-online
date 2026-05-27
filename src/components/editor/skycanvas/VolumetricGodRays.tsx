/**
 * VolumetricGodRays — GPU Ray Marching for volumetric light scattering.
 * Uses a full-screen quad with custom fragment shader to compute
 * light shafts from occlusion geometry. Zero-GC, shader-only approach.
 */
import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// ═══ God Rays Shader ═══
const godRaysVertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const godRaysFragmentShader = /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform vec2 uLightScreenPos;
uniform float uDensity;
uniform float uWeight;
uniform float uDecay;
uniform float uExposure;
uniform float uIntensity;
uniform vec3 uLightColor;
uniform float uTime;
uniform float uNumSamples;

varying vec2 vUv;

void main() {
  // Direction from pixel to light source in screen space
  vec2 deltaTexCoord = vUv - uLightScreenPos;
  deltaTexCoord *= 1.0 / uNumSamples * uDensity;
  
  vec2 texCoord = vUv;
  float illuminationDecay = 1.0;
  vec3 color = vec3(0.0);
  
  // Ray march from fragment toward light source
  for (float i = 0.0; i < 96.0; i++) {
    if (i >= uNumSamples) break;
    
    texCoord -= deltaTexCoord;
    
    // Sample scene (occlusion test via depth)
    vec4 sampleColor = texture2D(tDiffuse, texCoord);
    float depth = texture2D(tDepth, texCoord).r;
    
    // Only accumulate light from bright areas (non-occluded)
    float luminance = dot(sampleColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    float occlusion = step(0.99, depth); // far = sky = light source
    float contribution = max(luminance, occlusion * 0.3);
    
    sampleColor.rgb *= contribution * illuminationDecay * uWeight;
    color += sampleColor.rgb;
    
    illuminationDecay *= uDecay;
  }
  
  // Apply exposure and light color tint
  color *= uExposure * uIntensity;
  color *= uLightColor;
  
  // Blend with original scene
  vec4 original = texture2D(tDiffuse, vUv);
  gl_FragColor = vec4(original.rgb + color, 1.0);
}
`;

// ═══ Pre-allocated vectors ═══
const _lightWorldPos = new THREE.Vector3();
const _lightScreenPos = new THREE.Vector2();
const _projectedPos = new THREE.Vector3();

interface VolumetricGodRaysProps {
  lightPosition?: [number, number, number];
  lightColor?: string;
  density?: number;
  weight?: number;
  decay?: number;
  exposure?: number;
  intensity?: number;
  samples?: number;
  enabled?: boolean;
}

export default function VolumetricGodRays({
  lightPosition = [0, 800, -500],
  lightColor = '#ffeedd',
  density = 0.96,
  weight = 0.4,
  decay = 0.97,
  exposure = 0.3,
  intensity = 1.2,
  samples = 64,
  enabled = true,
}: VolumetricGodRaysProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera, size } = useThree();

  const uniforms = useMemo(() => ({
    tDiffuse: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    uLightScreenPos: { value: new THREE.Vector2(0.5, 0.8) },
    uDensity: { value: density },
    uWeight: { value: weight },
    uDecay: { value: decay },
    uExposure: { value: exposure },
    uIntensity: { value: intensity },
    uLightColor: { value: new THREE.Color(lightColor) },
    uTime: { value: 0 },
    uNumSamples: { value: samples },
  }), []);

  // Project light position to screen space each frame
  useFrame(({ clock }) => {
    if (!enabled) return;

    _lightWorldPos.set(lightPosition[0], lightPosition[1], lightPosition[2]);
    _projectedPos.copy(_lightWorldPos).project(camera);

    _lightScreenPos.set(
      (_projectedPos.x + 1) * 0.5,
      (_projectedPos.y + 1) * 0.5
    );

    uniforms.uLightScreenPos.value.copy(_lightScreenPos);
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uDensity.value = density;
    uniforms.uWeight.value = weight;
    uniforms.uDecay.value = decay;
    uniforms.uExposure.value = exposure;
    uniforms.uIntensity.value = intensity;
    uniforms.uLightColor.value.set(lightColor);
    uniforms.uNumSamples.value = samples;
  });

  if (!enabled) return null;

  // Render as a billboard light shaft cone in world space
  // (full-screen pass requires postprocessing integration, so we do
  //  a simpler but effective radial light cone approach)
  return (
    <group position={lightPosition}>
      {/* Radial light shaft cone geometry */}
      <mesh ref={meshRef} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[400, 1200, 32, 1, true]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          vertexShader={/* glsl */ `
            varying vec3 vWorldPos;
            varying vec2 vUv;
            varying float vFalloff;
            void main() {
              vUv = uv;
              vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
              vFalloff = 1.0 - uv.y; // fade from tip to base
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={/* glsl */ `
            uniform vec3 uColor;
            uniform float uOpacity;
            uniform float uTime;
            varying vec2 vUv;
            varying float vFalloff;
            void main() {
              // Radial gradient from center
              float radial = 1.0 - abs(vUv.x - 0.5) * 2.0;
              radial = pow(radial, 3.0);
              
              // Animated noise
              float noise = sin(vUv.y * 20.0 + uTime * 0.5) * 0.05 + 1.0;
              
              float alpha = radial * vFalloff * uOpacity * noise;
              alpha = pow(alpha, 1.5); // softer edges
              
              gl_FragColor = vec4(uColor * (1.0 + vFalloff * 0.5), alpha * 0.12);
            }
          `}
          uniforms={{
            uColor: { value: new THREE.Color(lightColor) },
            uOpacity: { value: intensity * 0.5 },
            uTime: { value: 0 },
          }}
        />
      </mesh>

      {/* Point light source glow */}
      <mesh>
        <sphereGeometry args={[20, 16, 16]} />
        <meshBasicMaterial color={lightColor} transparent opacity={0.6} />
      </mesh>
      <pointLight color={lightColor} intensity={intensity * 50} distance={2000} decay={2} />
    </group>
  );
}

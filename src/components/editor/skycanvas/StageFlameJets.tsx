/**
 * StageFlameJets — Stylized fire flame jets on stage sides
 * Uses NiagaraVFXController's stylized fire presets
 * DMX-controlled intensity and color via useFrame
 */
import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const JET_COUNT = 6;
const JET_POSITIONS: [number, number, number][] = [
  [-18, 1.2, -8], [-18, 1.2, 0], [-18, 1.2, 8],
  [18, 1.2, -8], [18, 1.2, 0], [18, 1.2, 8],
];

interface FlameParticle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
}

export default function StageFlameJets() {
  const groupRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<FlameParticle[][]>(JET_POSITIONS.map(() => []));
  const meshRefs = useRef<(THREE.Points | null)[]>([]);
  const timeRef = useRef(0);

  // Create geometry buffers per jet
  const MAX_PARTICLES = 40;
  const geos = useMemo(() => {
    return JET_POSITIONS.map(() => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3));
      geo.setAttribute('size', new THREE.Float32BufferAttribute(new Float32Array(MAX_PARTICLES), 1));
      geo.setDrawRange(0, 0);
      return geo;
    });
  }, []);

  const material = useMemo(() => new THREE.PointsMaterial({
    size: 0.8,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  }), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    timeRef.current += dt;
    const t = timeRef.current;

    // DMX-simulated intensity pulse per jet
    for (let j = 0; j < JET_COUNT; j++) {
      const particles = particlesRef.current[j];
      const intensity = 0.5 + Math.sin(t * 1.5 + j * 1.2) * 0.5; // 0-1 DMX sim
      const baseColor = new THREE.Color().setHSL((t * 0.03 + j * 0.1) % 1, 0.9, 0.5);

      // Spawn
      const spawnRate = Math.floor(intensity * 30);
      for (let s = 0; s < spawnRate && particles.length < MAX_PARTICLES; s++) {
        const spread = 0.3;
        particles.push({
          pos: new THREE.Vector3(
            (Math.random() - 0.5) * spread,
            0,
            (Math.random() - 0.5) * spread,
          ),
          vel: new THREE.Vector3(
            (Math.random() - 0.5) * 1.5,
            3 + Math.random() * 6 * intensity,
            (Math.random() - 0.5) * 1.5,
          ),
          life: 0,
          maxLife: 0.3 + Math.random() * 0.7,
          size: 0.3 + Math.random() * 0.6 * intensity,
          color: baseColor.clone(),
        });
      }

      // Update
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.maxLife) { particles.splice(i, 1); continue; }
        p.vel.y += dt * 2; // buoyancy
        p.vel.multiplyScalar(1 - dt * 2); // drag
        p.pos.addScaledVector(p.vel, dt);
      }

      // Write to geometry
      const geo = geos[j];
      const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
      const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
      const sizeAttr = geo.getAttribute('size') as THREE.BufferAttribute;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const t2 = p.life / p.maxLife;
        posAttr.setXYZ(i, p.pos.x, p.pos.y, p.pos.z);
        // Fire color: white → yellow → orange → red → dark
        const r = t2 < 0.3 ? 1.5 : t2 < 0.6 ? 1.2 - t2 : 0.3 * (1 - t2);
        const g = t2 < 0.2 ? 1.2 : t2 < 0.5 ? 0.6 - t2 * 0.5 : 0.05;
        const b = t2 < 0.1 ? 0.4 : 0.02;
        colAttr.setXYZ(i, r * p.color.r * 2, g * p.color.g * 2, b);
        sizeAttr.setX(i, p.size * (1 - t2 * 0.5));
      }
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
      geo.setDrawRange(0, particles.length);
    }
  });

  return (
    <group ref={groupRef}>
      {JET_POSITIONS.map((pos, i) => (
        <group key={`jet-${i}`} position={pos}>
          {/* Nozzle */}
          <mesh>
            <cylinderGeometry args={[0.08, 0.12, 0.3, 8]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Flame particles */}
          <points geometry={geos[i]} material={material} />
          {/* Glow light */}
          <pointLight color="#ff6600" intensity={0.8} distance={8} decay={2} position={[0, 1, 0]} />
        </group>
      ))}
    </group>
  );
}

/**
 * ProceduralFixture3D — Realistic moving head / wash / beam / strobe fixture
 * built entirely from Three.js primitives (cylinders, spheres, torus).
 * Supports pan/tilt driven by DMX or animation, with volumetric beam cone.
 *
 * Fixture types modeled after common stage fixtures:
 *   - Spot (Sharpy-style): narrow body, tight beam
 *   - Wash (LED panel wash): wider head, soft beam
 *   - Beam (long-throw): slim barrel, intense pencil beam
 *   - Strobe (blinder): flat rectangular head, wide flood
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type FixtureType = 'spot' | 'wash' | 'beam' | 'strobe';

export interface ProceduralFixtureProps {
  position: [number, number, number];
  fixtureType?: FixtureType;
  color?: string;
  /** 0-1 dimmer */
  intensity?: number;
  /** Radians — override auto-animation */
  pan?: number;
  /** Radians — override auto-animation */
  tilt?: number;
  /** Animate pan/tilt automatically */
  animate?: boolean;
  /** Scale multiplier */
  scale?: number;
  /** Show volumetric beam */
  showBeam?: boolean;
  /** DMX address label (displayed on yoke) */
  dmxLabel?: string;
}

/* ── Geometry configs per fixture type ── */
const FIXTURE_CONFIGS: Record<FixtureType, {
  baseW: number; baseH: number; baseD: number;
  yokeW: number; yokeH: number; yokeThick: number;
  headRadius: number; headLength: number; headSegments: number;
  lensRadius: number;
  beamLength: number; beamStartRadius: number; beamEndRadius: number;
  beamOpacity: number;
  bodyColor: string; yokeColor: string;
}> = {
  spot: {
    baseW: 0.32, baseH: 0.12, baseD: 0.32,
    yokeW: 0.28, yokeH: 0.38, yokeThick: 0.025,
    headRadius: 0.11, headLength: 0.35, headSegments: 12,
    lensRadius: 0.10,
    beamLength: 45, beamStartRadius: 0.08, beamEndRadius: 2.5,
    beamOpacity: 0.035,
    bodyColor: '#1a1a1a', yokeColor: '#2a2a2a',
  },
  wash: {
    baseW: 0.36, baseH: 0.10, baseD: 0.36,
    yokeW: 0.30, yokeH: 0.32, yokeThick: 0.025,
    headRadius: 0.16, headLength: 0.22, headSegments: 16,
    lensRadius: 0.14,
    beamLength: 28, beamStartRadius: 0.12, beamEndRadius: 5.0,
    beamOpacity: 0.025,
    bodyColor: '#222222', yokeColor: '#333333',
  },
  beam: {
    baseW: 0.26, baseH: 0.14, baseD: 0.26,
    yokeW: 0.22, yokeH: 0.40, yokeThick: 0.02,
    headRadius: 0.09, headLength: 0.42, headSegments: 10,
    lensRadius: 0.07,
    beamLength: 70, beamStartRadius: 0.04, beamEndRadius: 0.6,
    beamOpacity: 0.06,
    bodyColor: '#111111', yokeColor: '#1e1e1e',
  },
  strobe: {
    baseW: 0.40, baseH: 0.08, baseD: 0.20,
    yokeW: 0.34, yokeH: 0.20, yokeThick: 0.025,
    headRadius: 0.0, headLength: 0.0, headSegments: 0, // flat panel instead
    lensRadius: 0.0,
    beamLength: 15, beamStartRadius: 0.18, beamEndRadius: 4.0,
    beamOpacity: 0.05,
    bodyColor: '#181818', yokeColor: '#282828',
  },
};

export default function ProceduralFixture3D({
  position,
  fixtureType = 'spot',
  color = '#ffffff',
  intensity = 1,
  pan,
  tilt,
  animate = true,
  scale = 1,
  showBeam = true,
}: ProceduralFixtureProps) {
  const yokeRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const lensRef = useRef<THREE.Mesh>(null);
  const cfg = FIXTURE_CONFIGS[fixtureType];

  const beamGeometry = useMemo(() => {
    if (fixtureType === 'strobe') {
      // Flat cone for strobe
      return new THREE.ConeGeometry(cfg.beamEndRadius, cfg.beamLength, 8, 1, true);
    }
    return new THREE.CylinderGeometry(
      cfg.beamStartRadius, cfg.beamEndRadius, cfg.beamLength, 12, 1, true
    );
  }, [fixtureType, cfg]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const dim = Math.max(0, Math.min(1, intensity));

    // Pan (yoke Y rotation)
    if (yokeRef.current) {
      const panVal = pan !== undefined ? pan : (animate ? Math.sin(t * 0.6) * 0.8 : 0);
      yokeRef.current.rotation.y = panVal;
    }

    // Tilt (head X rotation)
    if (headRef.current) {
      const tiltVal = tilt !== undefined ? tilt : (animate ? Math.sin(t * 0.4 + 1.2) * 0.5 + 0.4 : 0.3);
      headRef.current.rotation.x = tiltVal;
    }

    // Beam opacity
    if (beamRef.current) {
      const mat = beamRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = cfg.beamOpacity * dim;
    }

    // Lens glow
    if (lensRef.current) {
      const mat = lensRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.3 + dim * 0.7;
    }
  });

  const isStrobe = fixtureType === 'strobe';

  return (
    <group position={position} scale={[scale, scale, scale]}>
      {/* ── Base (sits on truss / floor) ── */}
      <mesh position={[0, cfg.baseH / 2, 0]}>
        <boxGeometry args={[cfg.baseW, cfg.baseH, cfg.baseD]} />
        <meshStandardMaterial color={cfg.bodyColor} metalness={0.85} roughness={0.15} />
      </mesh>

      {/* ── Display panel on base (small blue rectangle) ── */}
      <mesh position={[0, cfg.baseH + 0.005, cfg.baseD / 2 - 0.01]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[cfg.baseW * 0.4, cfg.baseD * 0.2]} />
        <meshBasicMaterial color="#0044aa" transparent opacity={0.6} />
      </mesh>

      {/* ── Yoke arms ── */}
      <group ref={yokeRef} position={[0, cfg.baseH, 0]}>
        {/* Left arm */}
        <mesh position={[-cfg.yokeW / 2, cfg.yokeH / 2, 0]}>
          <boxGeometry args={[cfg.yokeThick, cfg.yokeH, cfg.yokeThick * 2]} />
          <meshStandardMaterial color={cfg.yokeColor} metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Right arm */}
        <mesh position={[cfg.yokeW / 2, cfg.yokeH / 2, 0]}>
          <boxGeometry args={[cfg.yokeThick, cfg.yokeH, cfg.yokeThick * 2]} />
          <meshStandardMaterial color={cfg.yokeColor} metalness={0.9} roughness={0.1} />
        </mesh>

        {/* ── Head (pivots on tilt axis) ── */}
        <group ref={headRef} position={[0, cfg.yokeH, 0]}>
          {isStrobe ? (
            /* Strobe: flat panel head */
            <>
              <mesh>
                <boxGeometry args={[cfg.baseW * 0.9, 0.08, 0.12]} />
                <meshStandardMaterial color={cfg.bodyColor} metalness={0.8} roughness={0.2} />
              </mesh>
              {/* LED array (front face) */}
              {Array.from({ length: 4 }).map((_, i) => (
                <mesh key={i} position={[(i - 1.5) * 0.08, 0, 0.065]}>
                  <circleGeometry args={[0.025, 8]} />
                  <meshBasicMaterial color={color} transparent opacity={intensity * 0.8} blending={THREE.AdditiveBlending} />
                </mesh>
              ))}
            </>
          ) : (
            <>
              {/* Barrel / housing */}
              <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -cfg.headLength / 2 + 0.02]}>
                <cylinderGeometry args={[cfg.headRadius, cfg.headRadius * 0.95, cfg.headLength, cfg.headSegments]} />
                <meshStandardMaterial color={cfg.bodyColor} metalness={0.85} roughness={0.15} />
              </mesh>

              {/* Lens ring (front) */}
              <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.02]}>
                <torusGeometry args={[cfg.lensRadius, 0.012, 8, cfg.headSegments]} />
                <meshStandardMaterial color="#444444" metalness={0.95} roughness={0.05} />
              </mesh>

              {/* Lens glow */}
              <mesh ref={lensRef} position={[0, 0, 0.03]}>
                <circleGeometry args={[cfg.lensRadius * 0.85, cfg.headSegments]} />
                <meshBasicMaterial
                  color={color}
                  transparent
                  opacity={0.5}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>

              {/* Heat fins (back of head) */}
              {fixtureType !== 'wash' && Array.from({ length: 6 }).map((_, i) => (
                <mesh
                  key={`fin-${i}`}
                  rotation={[Math.PI / 2, 0, (i / 6) * Math.PI * 2]}
                  position={[0, 0, -cfg.headLength + 0.04]}
                >
                  <boxGeometry args={[cfg.headRadius * 2, 0.005, 0.03]} />
                  <meshStandardMaterial color="#2a2a2a" metalness={0.9} roughness={0.1} />
                </mesh>
              ))}
            </>
          )}

          {/* ── Volumetric beam ── */}
          {showBeam && (
            <mesh
              ref={beamRef}
              geometry={beamGeometry}
              position={[0, 0, cfg.beamLength / 2 + 0.05]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <meshBasicMaterial
                color={color}
                transparent
                opacity={cfg.beamOpacity}
                blending={THREE.AdditiveBlending}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
}

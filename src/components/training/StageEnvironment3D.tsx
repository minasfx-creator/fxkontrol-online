import { forwardRef, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* ───────────────────── Truss Pillar ───────────────────── */
const TrussPillar = ({ position }: { position: [number, number, number] }) => (
  <group position={position}>
    <mesh position={[0, 2, 0]}>
      <cylinderGeometry args={[0.06, 0.06, 4, 8]} />
      <meshStandardMaterial color="#888" metalness={0.8} roughness={0.3} />
    </mesh>
    {[0.5, 1.5, 2.5, 3.5].map((y) => (
      <mesh key={y} position={[0, y, 0]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.02, 0.25, 0.02]} />
        <meshStandardMaterial color="#777" metalness={0.7} roughness={0.4} />
      </mesh>
    ))}
    <mesh position={[0, 0.01, 0]}>
      <boxGeometry args={[0.4, 0.02, 0.4]} />
      <meshStandardMaterial color="#555" metalness={0.9} roughness={0.2} />
    </mesh>
  </group>
);

/* ───────────────────── Horizontal Truss ───────────────────── */
const HorizontalTruss = ({ start, end }: { start: [number, number, number]; end: [number, number, number] }) => {
  const mid: [number, number, number] = [
    (start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2,
  ];
  const length = Math.sqrt(
    (end[0] - start[0]) ** 2 + (end[1] - start[1]) ** 2 + (end[2] - start[2]) ** 2
  );
  const dir = new THREE.Vector3(end[0] - start[0], end[1] - start[1], end[2] - start[2]).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

  return (
    <group position={mid} quaternion={quat}>
      <mesh>
        <cylinderGeometry args={[0.05, 0.05, length, 8]} />
        <meshStandardMaterial color="#999" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
};

/* ───────────────────── Moving Head Fixture ───────────────────── */
interface MovingHeadProps {
  position: [number, number, number];
  color: string;
  phase: number;
  intensity?: number;
}

function MovingHead({ position, color, phase, intensity = 1 }: MovingHeadProps) {
  const groupRef = useRef<THREE.Group>(null);
  const coneRef = useRef<THREE.Mesh>(null);
  const spotRef = useRef<THREE.SpotLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      // Pan & tilt animation
      const panAngle = Math.sin(t * 0.4 + phase) * 0.6;
      const tiltAngle = Math.PI + Math.sin(t * 0.7 + phase * 1.5) * 0.35 + 0.25;
      groupRef.current.rotation.y = panAngle;
      groupRef.current.rotation.x = tiltAngle;
    }
    if (coneRef.current) {
      const mat = coneRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.06 + Math.sin(t * 1.2 + phase) * 0.02;
    }
    if (spotRef.current && targetRef.current) {
      const tgtX = position[0] + Math.sin(t * 0.4 + phase) * 4;
      const tgtZ = position[2] + Math.sin(t * 0.7 + phase * 1.5) * 3 + 2;
      targetRef.current.position.set(tgtX, 0.3, tgtZ);
      spotRef.current.target = targetRef.current as any;
    }
  });

  return (
    <group position={position}>
      {/* Yoke */}
      <mesh>
        <boxGeometry args={[0.15, 0.1, 0.15]} />
        <meshStandardMaterial color="#222" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Head */}
      <group ref={groupRef}>
        <mesh position={[0, -0.12, 0]}>
          <cylinderGeometry args={[0.08, 0.1, 0.14, 8]} />
          <meshStandardMaterial color="#111" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Lens glow */}
        <mesh position={[0, -0.2, 0]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3 * intensity} toneMapped={false} />
        </mesh>
        {/* Volumetric beam cone */}
        <mesh ref={coneRef} position={[0, -2.2, 0]}>
          <coneGeometry args={[1.2, 4, 16, 1, true]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.3 * intensity}
            transparent
            opacity={0.06}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
      {/* SpotLight for actual illumination */}
      <spotLight
        ref={spotRef}
        position={[0, -0.2, 0]}
        color={color}
        intensity={8 * intensity}
        distance={15}
        angle={0.35}
        penumbra={0.6}
        decay={2}
        castShadow={false}
      />
      <object3D ref={targetRef} position={[0, 0, 4]} />
    </group>
  );
}

/* ───────────────────── LED Wall Panel ───────────────────── */
function LEDWallPanel({ position, width, height }: { position: [number, number, number]; width: number; height: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const pixelCount = 12;

  // Create a procedural LED pixel texture
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = pixelCount * 4;
    canvas.height = pixelCount * 4;
    const ctx = canvas.getContext('2d')!;
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    return { canvas, ctx, tex };
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const { canvas, ctx, tex } = texture;
    const pw = canvas.width / pixelCount;
    const ph = canvas.height / pixelCount;

    for (let x = 0; x < pixelCount; x++) {
      for (let y = 0; y < pixelCount; y++) {
        const hue = (t * 20 + x * 15 + y * 10) % 360;
        const light = 15 + Math.sin(t * 2 + x * 0.5 + y * 0.3) * 12;
        ctx.fillStyle = `hsl(${hue}, 80%, ${light}%)`;
        ctx.fillRect(x * pw, y * ph, pw, ph);
      }
    }
    tex.needsUpdate = true;
  });

  return (
    <mesh ref={meshRef} position={position}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        map={texture.tex}
        emissiveMap={texture.tex}
        emissive="#ffffff"
        emissiveIntensity={0.8}
        toneMapped={false}
      />
    </mesh>
  );
}

/* ───────────────────── Floor Wash Lights ───────────────────── */
function FloorWash({ position, color }: { position: [number, number, number]; color: string }) {
  const ref = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.intensity = 1.5 + Math.sin(clock.getElapsedTime() * 1.5) * 0.5;
    }
  });
  return (
    <group position={position}>
      <pointLight ref={ref} color={color} intensity={1.5} distance={5} decay={2} />
      {/* Small fixture body */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.15, 0.1, 0.15]} />
        <meshStandardMaterial color="#222" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.11, 0]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ───────────────────── Auditorium Shell ───────────────────── */
function AuditoriumShell() {
  return (
    <group>
      {/* Side walls */}
      <mesh position={[-6, 3, 0]}>
        <boxGeometry args={[0.15, 6, 16]} />
        <meshStandardMaterial color="#0a0a10" roughness={0.95} />
      </mesh>
      <mesh position={[6, 3, 0]}>
        <boxGeometry args={[0.15, 6, 16]} />
        <meshStandardMaterial color="#0a0a10" roughness={0.95} />
      </mesh>
      {/* Ceiling */}
      <mesh position={[0, 6, 0]}>
        <boxGeometry args={[12.3, 0.1, 16]} />
        <meshStandardMaterial color="#080810" roughness={0.9} />
      </mesh>
      {/* Back wall */}
      <mesh position={[0, 3, 8]}>
        <boxGeometry args={[12.3, 6, 0.15]} />
        <meshStandardMaterial color="#0c0c14" roughness={0.9} />
      </mesh>
    </group>
  );
}

/* ───────────────────── Haze / Atmosphere ───────────────────── */
function AtmosphereHaze() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.035 + Math.sin(clock.getElapsedTime() * 0.3) * 0.01;
    }
  });
  return (
    <mesh ref={ref} position={[0, 2.5, 0]}>
      <boxGeometry args={[12, 5, 12]} />
      <meshStandardMaterial
        color="#8888ff"
        transparent
        opacity={0.035}
        side={THREE.BackSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/* ═══════════════════ MAIN STAGE COMPONENT ═══════════════════ */
const StageEnvironment3D = forwardRef<THREE.Group>(function StageEnvironment3D(_props, ref) {
  return (
    <group ref={ref} scale={[3, 3, 3]}>
      {/* ── Ground ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#08080e" roughness={0.95} />
      </mesh>
      <gridHelper args={[60, 60, '#12121e', '#0e0e18']} />

      {/* ── Stage platform ── */}
      <mesh position={[0, 0.15, 0]} receiveShadow castShadow>
        <boxGeometry args={[8, 0.3, 4]} />
        <meshStandardMaterial color="#111118" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Stage edge LED strip */}
      <mesh position={[0, 0.31, 2]}>
        <boxGeometry args={[8, 0.02, 0.05]} />
        <meshStandardMaterial color="#ff6633" emissive="#ff4400" emissiveIntensity={0.5} />
      </mesh>

      {/* ── Auditorium ── */}
      <AuditoriumShell />

      {/* ── Truss pillars ── */}
      <TrussPillar position={[-3.5, 0.3, -1.8]} />
      <TrussPillar position={[3.5, 0.3, -1.8]} />
      <TrussPillar position={[-3.5, 0.3, 1.8]} />
      <TrussPillar position={[3.5, 0.3, 1.8]} />

      {/* ── Extra rear truss for moving heads ── */}
      <TrussPillar position={[-5, 0.3, -1.8]} />
      <TrussPillar position={[5, 0.3, -1.8]} />

      {/* ── Horizontal truss bars ── */}
      <HorizontalTruss start={[-5, 4.3, -1.8]} end={[5, 4.3, -1.8]} />
      <HorizontalTruss start={[-3.5, 4.3, 1.8]} end={[3.5, 4.3, 1.8]} />
      <HorizontalTruss start={[-3.5, 4.3, -1.8]} end={[-3.5, 4.3, 1.8]} />
      <HorizontalTruss start={[3.5, 4.3, -1.8]} end={[3.5, 4.3, 1.8]} />
      {/* Mid-stage cross truss */}
      <HorizontalTruss start={[-5, 4.3, -0.5]} end={[5, 4.3, -0.5]} />

      {/* ── LED Wall Backdrop ── */}
      <LEDWallPanel position={[0, 2.3, -1.92]} width={7} height={3.8} />
      {/* Side LED panels */}
      <LEDWallPanel position={[-5.9, 2.5, 0]} width={2.5} height={3} />
      <LEDWallPanel position={[5.9, 2.5, 0]} width={2.5} height={3} />

      {/* ── Moving Heads (8 units across rear truss) ── */}
      <MovingHead position={[-4.5, 4.3, -1.8]} color="#cc44ff" phase={0} />
      <MovingHead position={[-3, 4.3, -1.8]} color="#ff2266" phase={1.2} />
      <MovingHead position={[-1.5, 4.3, -1.8]} color="#4488ff" phase={2.4} />
      <MovingHead position={[0, 4.3, -1.8]} color="#ffffff" phase={3.6} intensity={1.3} />
      <MovingHead position={[1.5, 4.3, -1.8]} color="#4488ff" phase={4.8} />
      <MovingHead position={[3, 4.3, -1.8]} color="#ff2266" phase={6.0} />
      <MovingHead position={[4.5, 4.3, -1.8]} color="#cc44ff" phase={7.2} />

      {/* Mid-stage moving heads (4 units) */}
      <MovingHead position={[-3.5, 4.3, -0.5]} color="#22ffaa" phase={1.0} intensity={0.7} />
      <MovingHead position={[-1, 4.3, -0.5]} color="#ffaa22" phase={2.5} intensity={0.7} />
      <MovingHead position={[1, 4.3, -0.5]} color="#ffaa22" phase={4.0} intensity={0.7} />
      <MovingHead position={[3.5, 4.3, -0.5]} color="#22ffaa" phase={5.5} intensity={0.7} />

      {/* ── Floor Wash Uplight ── */}
      <FloorWash position={[-3, 0.31, 1.5]} color="#cc44ff" />
      <FloorWash position={[-1, 0.31, 1.5]} color="#4488ff" />
      <FloorWash position={[1, 0.31, 1.5]} color="#ff2266" />
      <FloorWash position={[3, 0.31, 1.5]} color="#cc44ff" />
      <FloorWash position={[-2, 0.31, -1.5]} color="#22ffaa" />
      <FloorWash position={[0, 0.31, -1.5]} color="#ffffff" />
      <FloorWash position={[2, 0.31, -1.5]} color="#22ffaa" />

      {/* ── Atmospheric haze volume ── */}
      <AtmosphereHaze />

      {/* ── Ambient stage lighting ── */}
      <pointLight position={[0, 5.5, 0]} color="#221133" intensity={3} distance={12} />
    </group>
  );
});

export default StageEnvironment3D;

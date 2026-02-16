import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, Grid, PerspectiveCamera } from '@react-three/drei';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';

function GroundPlane() {
  return (
    <Grid
      position={[0, 0, 0]}
      args={[100, 100]}
      cellSize={2}
      cellThickness={0.5}
      cellColor="#1a2a3a"
      sectionSize={10}
      sectionThickness={1}
      sectionColor="#2a4a6a"
      fadeDistance={80}
      infiniteGrid
    />
  );
}

function LightPoint({ position, color, active }: { position: [number, number, number]; color: string; active: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  
  return (
    <group position={position}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {active && (
        <pointLight color={color} intensity={2} distance={8} decay={2} />
      )}
      {active && (
        <mesh>
          <sphereGeometry args={[0.4, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.15} />
        </mesh>
      )}
    </group>
  );
}

function TimelineEffects() {
  const { timelineItems, currentTime } = useProjectStore();

  const activeEffects = useMemo(() => {
    return timelineItems.filter((item) => {
      const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);
      if (!effect) return false;
      return currentTime >= item.startTime && currentTime <= item.startTime + effect.duration;
    });
  }, [timelineItems, currentTime]);

  return (
    <>
      {activeEffects.map((item) => {
        const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);
        if (!effect) return null;
        return (
          <LightPoint
            key={item.id}
            position={[item.position.x, item.position.y, item.position.z]}
            color={effect.color}
            active
          />
        );
      })}
    </>
  );
}

function LaunchSites() {
  const positions: [number, number, number][] = [
    [-8, 0.05, 0], [-4, 0.05, 0], [0, 0.05, 0], [4, 0.05, 0], [8, 0.05, 0],
  ];
  return (
    <>
      {positions.map((pos, i) => (
        <group key={i} position={pos}>
          <mesh>
            <boxGeometry args={[0.6, 0.1, 0.6]} />
            <meshStandardMaterial color="#3a3a3a" />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.08, 0.1, 0.3, 8]} />
            <meshStandardMaterial color="#555" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </>
  );
}

export default function SkyCanvas() {
  return (
    <div className="w-full h-full relative">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 8, 25]} fov={60} />
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          maxPolarAngle={Math.PI / 2}
          minDistance={5}
          maxDistance={80}
        />
        
        {/* Ambient light */}
        <ambientLight intensity={0.05} />
        <directionalLight position={[10, 10, 5]} intensity={0.1} />
        
        {/* Night sky */}
        <Stars radius={100} depth={50} count={3000} factor={3} saturation={0} fade speed={0.5} />
        <color attach="background" args={['#0a0a12']} />
        <fog attach="fog" args={['#0a0a12', 40, 100]} />
        
        {/* Ground */}
        <GroundPlane />
        <LaunchSites />
        
        {/* Effects */}
        <TimelineEffects />
      </Canvas>
      
      {/* Viewport overlay info */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <span className="text-xs font-mono-code text-muted-foreground bg-surface-1/80 px-2 py-1 rounded-sm border border-border/50">
          3D VIEWPORT
        </span>
        <span className="text-xs font-mono-code text-electric bg-surface-1/80 px-2 py-1 rounded-sm border border-border/50">
          PERSPECTIVE
        </span>
      </div>
      <div className="absolute bottom-3 right-3 text-xs font-mono-code text-muted-foreground bg-surface-1/80 px-2 py-1 rounded-sm border border-border/50">
        Orbit: LMB · Pan: MMB · Zoom: Scroll
      </div>
    </div>
  );
}

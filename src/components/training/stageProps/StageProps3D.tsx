/**
 * Training v2.2 — Stage Props renderer.
 *
 * Renders all placed scenic props for the current mission. Each prop is a
 * stylized low-poly group consistent with StageEnvironment3D (Vantablack +
 * cyan/orange glow accents). Pure visual — no safety/command coupling.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStageProps, type PlacedStageProp } from './useStagePropsStore';
import type { StagePropKind } from './stagePropsCatalog';

interface Props {
  missionId: string;
  /** Optional id of the currently selected prop in the editor — gets a cyan halo. */
  selectedId?: string | null;
}

export default function StageProps3D({ missionId, selectedId }: Props) {
  const { items } = useStageProps(missionId);
  return (
    <group>
      {items.map((it) => (
        <PropInstance key={it.id} item={it} selected={it.id === selectedId} />
      ))}
    </group>
  );
}

function PropInstance({ item, selected }: { item: PlacedStageProp; selected: boolean }) {
  return (
    <group position={item.position} rotation={[0, item.rotationY, 0]} scale={item.scale}>
      {selected && <SelectionHalo />}
      {renderByKind(item.kind)}
    </group>
  );
}

function SelectionHalo() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.6 + Math.sin(t * 3) * 0.25;
  });
  return (
    <mesh ref={ref} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.9, 1.05, 32]} />
      <meshStandardMaterial color="#22e6ff" emissive="#22e6ff" emissiveIntensity={0.7} transparent opacity={0.7} toneMapped={false} />
    </mesh>
  );
}

function renderByKind(kind: StagePropKind): JSX.Element {
  switch (kind) {
    case 'light-rig':
      return <LightRig />;
    case 'bleacher':
      return <Bleacher />;
    case 'delay-tower':
      return <DelayTower />;
    case 'sub-stack':
      return <SubStack />;
    case 'follow-spot-platform':
      return <FollowSpotPlatform />;
    case 'pyro-cake-pod':
      return <PyroCakePod />;
    default:
      return <group />;
  }
}

/* ───────────────────── Light Rig ───────────────────── */
function LightRig() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.children.forEach((c, i) => {
      c.rotation.y = Math.sin(t * 0.5 + i) * 0.5;
      c.rotation.x = Math.PI + Math.sin(t * 0.7 + i) * 0.3;
    });
  });
  return (
    <group>
      {/* Vertical posts */}
      <mesh position={[-1.2, 1.4, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 2.8, 8]} />
        <meshStandardMaterial color="#888" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[1.2, 1.4, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 2.8, 8]} />
        <meshStandardMaterial color="#888" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Bases */}
      {[-1.2, 1.2].map((x) => (
        <mesh key={x} position={[x, 0.02, 0]}>
          <boxGeometry args={[0.4, 0.04, 0.4]} />
          <meshStandardMaterial color="#555" metalness={0.9} roughness={0.2} />
        </mesh>
      ))}
      {/* Top truss bar */}
      <mesh position={[0, 2.7, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 2.6, 8]} />
        <meshStandardMaterial color="#999" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* 4 movers hanging */}
      <group ref={ref}>
        {[-0.9, -0.3, 0.3, 0.9].map((x, i) => (
          <group key={i} position={[x, 2.55, 0]}>
            <mesh>
              <boxGeometry args={[0.15, 0.1, 0.15]} />
              <meshStandardMaterial color="#222" metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[0, -0.12, 0]}>
              <cylinderGeometry args={[0.07, 0.09, 0.13, 8]} />
              <meshStandardMaterial color="#111" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh position={[0, -0.2, 0]}>
              <sphereGeometry args={[0.045, 8, 8]} />
              <meshStandardMaterial
                color={['#cc44ff', '#22e6ff', '#ff6633', '#22ffaa'][i]}
                emissive={['#cc44ff', '#22e6ff', '#ff6633', '#22ffaa'][i]}
                emissiveIntensity={2.5}
                toneMapped={false}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/* ───────────────────── Bleacher ───────────────────── */
function Bleacher() {
  const rows = 4;
  const seats = 18;
  const heads = useMemo(() => {
    const arr: { x: number; row: number; sway: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < seats; i++) {
        const r1 = Math.sin(i * 12.9 + r * 7.3) * 43758.5;
        if ((r1 - Math.floor(r1)) < 0.18) continue; // some empty seats
        arr.push({ x: (i - seats / 2 + 0.5) * 0.45, row: r, sway: i + r });
      }
    }
    return arr;
  }, []);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.children.forEach((c, i) => {
      c.rotation.z = Math.sin(t * 1.3 + heads[i]?.sway) * 0.04;
    });
  });
  return (
    <group>
      {/* Tier slabs */}
      {Array.from({ length: rows }).map((_, r) => (
        <mesh key={r} position={[0, 0.3 + r * 0.5, -r * 0.6]} receiveShadow>
          <boxGeometry args={[8.5, 0.45, 0.6]} />
          <meshStandardMaterial color="#1a1a22" roughness={0.95} metalness={0.05} />
        </mesh>
      ))}
      {/* Side rails */}
      {[-4.2, 4.2].map((x) => (
        <mesh key={x} position={[x, 1.1, -((rows - 1) * 0.6) / 2]}>
          <boxGeometry args={[0.08, 2.4, rows * 0.6 + 0.3]} />
          <meshStandardMaterial color="#22e6ff" emissive="#22e6ff" emissiveIntensity={0.25} />
        </mesh>
      ))}
      {/* Spectators */}
      <group ref={ref}>
        {heads.map((h, i) => (
          <group key={i} position={[h.x, 0.55 + h.row * 0.5 + 0.3, -h.row * 0.6 + 0.05]}>
            <mesh>
              <capsuleGeometry args={[0.13, 0.45, 4, 8]} />
              <meshStandardMaterial color="#08080d" roughness={0.95} />
            </mesh>
            <mesh position={[0, 0.4, 0]}>
              <sphereGeometry args={[0.1, 8, 8]} />
              <meshStandardMaterial color="#0a0a10" roughness={0.95} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/* ───────────────────── Delay Tower ───────────────────── */
function DelayTower() {
  return (
    <group>
      {/* Truss legs */}
      {[[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].map((p, i) => (
        <mesh key={i} position={[p[0], 2.5, p[1]]}>
          <cylinderGeometry args={[0.04, 0.04, 5, 6]} />
          <meshStandardMaterial color="#888" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      {/* Cross braces */}
      {[1, 2, 3, 4].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[0, Math.PI / 4, 0]}>
          <boxGeometry args={[1.2, 0.03, 0.03]} />
          <meshStandardMaterial color="#777" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
      {/* Base */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[1.4, 0.1, 1.4]} />
        <meshStandardMaterial color="#444" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* PA boxes flown */}
      {[0, 1, 2, 3].map((i) => (
        <group key={i} position={[0, 4.6 - i * 0.32, 0]} rotation={[i * 0.06, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.7, 0.28, 0.45]} />
            <meshStandardMaterial color="#0a0a0a" roughness={0.6} metalness={0.3} />
          </mesh>
          <mesh position={[0, 0, 0.226]}>
            <circleGeometry args={[0.09, 12]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ───────────────────── Sub Stack ───────────────────── */
function SubStack() {
  return (
    <group>
      {[0, 1].map((i) => (
        <group key={i} position={[0, 0.4 + i * 0.7, 0]}>
          <mesh castShadow>
            <boxGeometry args={[1.0, 0.65, 0.9]} />
            <meshStandardMaterial color="#0a0a0a" roughness={0.7} metalness={0.3} />
          </mesh>
          <mesh position={[-0.22, 0, 0.46]}>
            <circleGeometry args={[0.18, 16]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
          </mesh>
          <mesh position={[0.22, 0, 0.46]}>
            <circleGeometry args={[0.18, 16]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
          </mesh>
        </group>
      ))}
      {/* Power LED */}
      <mesh position={[0.45, 1.05, 0.46]}>
        <sphereGeometry args={[0.025, 6, 6]} />
        <meshStandardMaterial color="#22ffaa" emissive="#22ffaa" emissiveIntensity={2} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ───────────────────── Follow-Spot Platform ───────────────────── */
function FollowSpotPlatform() {
  return (
    <group>
      {/* Riser */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[2.0, 0.7, 1.6]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.9} />
      </mesh>
      {/* Top deck */}
      <mesh position={[0, 0.72, 0]}>
        <boxGeometry args={[2.05, 0.04, 1.65]} />
        <meshStandardMaterial color="#111" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* Tripod */}
      <mesh position={[0, 1.05, 0]}>
        <cylinderGeometry args={[0.05, 0.12, 0.6, 8]} />
        <meshStandardMaterial color="#222" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Spot body */}
      <group position={[0, 1.45, 0]} rotation={[-0.25, 0, 0]}>
        <mesh>
          <cylinderGeometry args={[0.18, 0.22, 0.9, 16]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.46, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.05, 16]} />
          <meshStandardMaterial color="#fffacc" emissive="#fffacc" emissiveIntensity={2.5} toneMapped={false} />
        </mesh>
      </group>
      <pointLight position={[0, 1.7, 0]} color="#fff5dd" intensity={1.2} distance={6} decay={2} />
    </group>
  );
}

/* ───────────────────── Pyro Cake Pod ───────────────────── */
function PyroCakePod() {
  return (
    <group>
      {/* Deck plate */}
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[1.6, 0.08, 1.6]} />
        <meshStandardMaterial color="#222" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* 4 cake fixtures (cylinders with safety cone) */}
      {[
        [-0.45, -0.45],
        [0.45, -0.45],
        [-0.45, 0.45],
        [0.45, 0.45],
      ].map((p, i) => (
        <group key={i} position={[p[0], 0.08, p[1]]}>
          <mesh>
            <cylinderGeometry args={[0.16, 0.18, 0.32, 16]} />
            <meshStandardMaterial color="#aa2a14" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.05, 0.16, 0.05, 16]} />
            <meshStandardMaterial color="#332218" roughness={0.95} />
          </mesh>
          {/* Warning beacon */}
          <mesh position={[0, 0.26, 0]}>
            <sphereGeometry args={[0.025, 6, 6]} />
            <meshStandardMaterial color="#ff6633" emissive="#ff6633" emissiveIntensity={2.2} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* Hazard stripes */}
      <mesh position={[0, 0.085, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.85, 0.95, 32]} />
        <meshStandardMaterial color="#ffaa22" emissive="#ff6622" emissiveIntensity={0.4} transparent opacity={0.85} toneMapped={false} />
      </mesh>
    </group>
  );
}

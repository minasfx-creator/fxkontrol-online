/**
 * FX KONTROL V3.5 - TACTICAL SWARM PLAYBACK ENGINE
 * Capacidade: 2000+ Drones | Operação "Zero-GC"
 * Melhorias: Interação Tática, Color LERP, Telemetria In-World
 *
 * NOTA: Este é um motor alternativo/simplificado.
 * O renderer principal de produção é InstancedDroneSwarm.tsx (PBR, tri-tier LOD).
 */

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { Crosshair } from 'lucide-react';
import { useRenderCounter } from '@/hooks/useRenderCounter';
import { useClockTimeRef } from '@/hooks/useClockTimeRef';

// Variáveis Globais de Memória Estática (Previnem o "Garbage Collector Stutter")
const _O = new THREE.Object3D();
const _C = new THREE.Color();

interface PathPoint {
  x: number;
  y: number;
  z: number;
  time: number;
}

interface ColorAction {
  r: number;
  g: number;
  b: number;
  time: number;
  duration: number;
}

interface SwarmAgent {
  id: number;
  path: PathPoint[];
  colors: ColorAction[];
  duration: number;
}

interface SwarmPlaybackEngineProps {
  agents: SwarmAgent[];
  timeScale?: number;
  isPlaying?: boolean;
  manualTime?: number | null;
}

export function SwarmPlaybackEngine({
  agents,
  timeScale = 1.0,
  isPlaying = true,
  manualTime = null,
}: SwarmPlaybackEngineProps) {
  useRenderCounter('SwarmPlayback');
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const hudRef = useRef<THREE.Group>(null);
  const droneCount = agents?.length || 0;

  // Estados de Interação (UX Militar)
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Clock-direct time read — keeps the swarm in sync even if the React
  // prop `manualTime` (driven by the store mirror) is one frame behind.
  const clockTimeRef = useClockTimeRef();

  // Alocação de Baixo Nível
  const stateRef = useRef({
    pathIndices: new Uint32Array(0),
    colorIndices: new Uint32Array(0),
    internalTime: 0,
    centerOfMass: new THREE.Vector3(),
  });

  // Geometria e Material Brutalistas
  const geo = useMemo(() => new THREE.CylinderGeometry(0.4, 0.6, 0.2, 6), []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#050505',
        emissive: '#ffffff',
        emissiveIntensity: 1,
        metalness: 1,
        roughness: 0.1,
      }),
    [],
  );

  useEffect(() => {
    stateRef.current.pathIndices = new Uint32Array(droneCount);
    stateRef.current.colorIndices = new Uint32Array(droneCount);
    stateRef.current.internalTime = 0;
  }, [droneCount]);

  // Gestão de Seleção
  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useFrame((_state, delta) => {
    const mesh = meshRef.current;
    if (!mesh || !mesh.instanceMatrix || droneCount === 0) return;

    const engine = stateRef.current;

    if (manualTime !== null) {
      engine.internalTime = manualTime;
      engine.pathIndices.fill(0);
      engine.colorIndices.fill(0);
    } else if (isPlaying) {
      engine.internalTime += delta * timeScale;
    }

    const t = engine.internalTime;

    // Reset ao centro de massa para cálculo deste frame
    engine.centerOfMass.set(0, 0, 0);

    for (let i = 0; i < droneCount; i++) {
      const agent = agents[i];
      const path = agent.path;
      const colors = agent.colors;

      // --- 1. LÓGICA DE POSIÇÃO ABSOLUTA ---
      let pIdx = engine.pathIndices[i];
      while (pIdx < path.length - 1 && t >= path[pIdx + 1].time) {
        pIdx++;
      }
      engine.pathIndices[i] = pIdx;

      if (pIdx >= path.length - 1) {
        const lastP = path[path.length - 1];
        _O.position.set(lastP.x, lastP.y, lastP.z);
      } else {
        const p1 = path[pIdx];
        const p2 = path[pIdx + 1];
        const timeDiff = p2.time - p1.time;
        const progress = timeDiff > 0 ? (t - p1.time) / timeDiff : 0;

        _O.position.set(
          p1.x + (p2.x - p1.x) * progress,
          p1.y + (p2.y - p1.y) * progress,
          p1.z + (p2.z - p1.z) * progress,
        );
      }

      // Adicionar à média do Centro de Massa
      engine.centerOfMass.add(_O.position);

      // Micro-ajuste de atitude (Inclinação táctica mediante movimento)
      _O.rotation.set(Math.sin(t * 0.5 + i) * 0.05, t * 0.2 + i * 0.1, 0);
      _O.scale.setScalar(1.0);

      // --- 2. LÓGICA DE CORES & UX (LEDs + Seleção) ---
      let baseR = 0,
        baseG = 0,
        baseB = 0;
      let intensity = 1;

      if (colors && colors.length > 0) {
        let cIdx = engine.colorIndices[i];
        while (cIdx < colors.length - 1 && t >= colors[cIdx].time + colors[cIdx].duration) {
          cIdx++;
        }
        engine.colorIndices[i] = cIdx;

        const led = colors[cIdx];
        if (t >= led.time && t <= led.time + led.duration) {
          // Color LERP: Interpolação suave de cores
          const colorProgress = (t - led.time) / led.duration;
          const nextLed = cIdx < colors.length - 1 ? colors[cIdx + 1] : led;

          baseR = led.r + (nextLed.r - led.r) * colorProgress;
          baseG = led.g + (nextLed.g - led.g) * colorProgress;
          baseB = led.b + (nextLed.b - led.b) * colorProgress;
          intensity = 15; // Brilho Neon
        }
      }

      _C.setRGB(baseR, baseG, baseB).multiplyScalar(intensity);

      // Sobrescrita Tática (UX de Seleção/Hover)
      if (selectedIds.has(i)) {
        _C.setRGB(1, 0, 1).multiplyScalar(20);
        _O.scale.setScalar(1.5);
      } else if (hoveredId === i) {
        _C.setRGB(0, 1, 1).multiplyScalar(25);
        _O.scale.setScalar(1.2);
      }

      _O.updateMatrix();
      mesh.setMatrixAt(i, _O.matrix);
      mesh.setColorAt(i, _C);
    }

    // Calcula a posição final do HUD Tático
    if (droneCount > 0) {
      engine.centerOfMass.divideScalar(droneCount);
      if (hudRef.current) {
        hudRef.current.position.copy(engine.centerOfMass);
        hudRef.current.position.y += 15;
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  if (droneCount === 0) return null;

  return (
    <group>
      {/* HUD TÁTICO IN-WORLD (Holograma de Telemetria) */}
      <group ref={hudRef}>
        <Html center distanceFactor={80} sprite>
          <div className="pointer-events-none select-none flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-0/80 backdrop-blur-sm border border-border/30">
              <Crosshair className="w-3 h-3 text-fxk-cyan" />
              <div className="flex flex-col">
                <span className="text-[7px] font-mono text-muted-foreground tracking-widest">
                  Swarm Center
                </span>
                <span className="text-[9px] font-mono font-bold text-foreground">
                  {droneCount} UNITS
                </span>
              </div>
            </div>
            {/* Linha de ligação ao enxame */}
            <div className="w-px h-8 bg-gradient-to-b from-fxk-cyan/60 to-transparent" />
          </div>
        </Html>
      </group>

      <instancedMesh
        ref={meshRef}
        args={[geo, mat, droneCount]}
        frustumCulled={false}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (e.instanceId !== undefined) {
            setHoveredId(e.instanceId);
            document.body.style.cursor = 'crosshair';
          }
        }}
        onPointerOut={() => {
          setHoveredId(null);
          document.body.style.cursor = 'default';
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (e.instanceId !== undefined) {
            toggleSelection(e.instanceId);
          }
        }}
      />
    </group>
  );
}

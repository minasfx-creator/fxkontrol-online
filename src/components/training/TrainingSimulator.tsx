import { useState, useEffect, useCallback, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import StageEnvironment3D from './StageEnvironment3D';
import TechnicianCharacter from './TechnicianCharacter';
import PlacedEquipment3D from './PlacedEquipment3D';
import SnapPoints from './SnapPoints';
import EquipmentTray from './EquipmentTray';
import SimulatorHUD from './SimulatorHUD';
import VictoryScreen from './VictoryScreen';
import PlacementVFX from './PlacementVFX';
import { DrunkNPC, ProducerNPC, ClientNPC } from './NPCs';
import {
  Mission, Equipment, SnapPoint, PlacedItem, MissionObjective,
  MISSION_SNAP_POINTS, MISSION_TIME_LIMITS,
} from './types';

interface TrainingSimulatorProps {
  mission: Mission;
  allEquipment: Equipment[];
  onComplete: (score: number) => void;
  onQuit: () => void;
}

interface PendingPlacement {
  snapPointId: string;
  equipmentId: string;
  position: [number, number, number];
}

interface CameraModeRigProps {
  mode: 'orbit' | 'firstPerson';
  focusPosition: [number, number, number] | null;
}

function CameraModeRig({ mode, focusPosition }: CameraModeRigProps) {
  const { camera } = useThree();
  const desiredPosition = useRef(new THREE.Vector3());
  const desiredLookAt = useRef(new THREE.Vector3(0, 2, 0));
  const smoothLookAt = useRef(new THREE.Vector3(0, 2, 0));

  useFrame(() => {
    if (mode !== 'firstPerson' || !focusPosition) return;

    desiredPosition.current.set(focusPosition[0], focusPosition[1] + 1.55, focusPosition[2] + 0.36);
    desiredLookAt.current.set(focusPosition[0], focusPosition[1] + 1.35, focusPosition[2] - 0.9);

    camera.position.lerp(desiredPosition.current, 0.16);
    smoothLookAt.current.lerp(desiredLookAt.current, 0.16);
    camera.lookAt(smoothLookAt.current);
  });

  return null;
}

export default function TrainingSimulator({ mission, allEquipment, onComplete, onQuit }: TrainingSimulatorProps) {
  const snapPoints = MISSION_SNAP_POINTS[mission.id] || [];
  const missionEquipment = allEquipment.filter((e) => mission.equipment.includes(e.id));
  const timeLimit = MISSION_TIME_LIMITS[mission.id] || 120;

  const objectives: MissionObjective[] = snapPoints.map((sp) => ({
    id: sp.id,
    label: sp.label,
    equipmentId: sp.equipmentType,
    snapPointId: sp.id,
  }));

  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(timeLimit);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activeVFX, setActiveVFX] = useState<{ id: string; position: [number, number, number] }[]>([]);
  const [pendingPlacement, setPendingPlacement] = useState<PendingPlacement | null>(null);
  const [technicianTarget, setTechnicianTarget] = useState<[number, number, number] | null>(null);
  const [isTechnicianInteracting, setIsTechnicianInteracting] = useState(false);
  const [cameraMode, setCameraMode] = useState<'orbit' | 'firstPerson'>('orbit');
  const [firstPersonFocus, setFirstPersonFocus] = useState<[number, number, number] | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const interactionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (completed || failed) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((t) => {
        if (t <= 1) {
          setFailed(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [completed, failed]);

  useEffect(() => {
    if (placedItems.length === snapPoints.length && snapPoints.length > 0 && !completed) {
      setCompleted(true);
      if (timerRef.current) clearInterval(timerRef.current);
      const timeBonus = Math.round(timeRemaining * 2);
      setScore((s) => s + timeBonus);
    }
  }, [placedItems, snapPoints.length, completed, timeRemaining]);

  useEffect(() => {
    if (!completed && !failed) return;

    if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    setPendingPlacement(null);
    setTechnicianTarget(null);
    setIsTechnicianInteracting(false);
    setCameraMode('orbit');
    setFirstPersonFocus(null);
  }, [completed, failed]);

  const commitPlacement = useCallback(() => {
    if (!pendingPlacement) return;

    setPlacedItems((prev) => {
      if (prev.some((p) => p.snapPointId === pendingPlacement.snapPointId)) return prev;
      return [...prev, pendingPlacement];
    });

    const vfxId = `vfx-${Date.now()}`;
    setActiveVFX((prev) => [...prev, { id: vfxId, position: pendingPlacement.position }]);
    setScore((s) => s + 100);

    setPendingPlacement(null);
    setTechnicianTarget(null);
    setIsTechnicianInteracting(false);
    setCameraMode('orbit');
    setFirstPersonFocus(null);
  }, [pendingPlacement]);

  const handleReachSnapPoint = useCallback(() => {
    if (!pendingPlacement || completed || failed) return;

    setIsTechnicianInteracting(true);
    setCameraMode('firstPerson');
    setFirstPersonFocus(pendingPlacement.position);

    if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    interactionTimeoutRef.current = setTimeout(() => {
      commitPlacement();
    }, 900);
  }, [pendingPlacement, completed, failed, commitPlacement]);

  const handleSnapClick = useCallback(
    (snapPoint: SnapPoint) => {
      if (!selectedEquipment || completed || failed || pendingPlacement || isTechnicianInteracting) return;
      if (snapPoint.equipmentType !== selectedEquipment) return;
      if (placedItems.some((p) => p.snapPointId === snapPoint.id)) return;

      const focusVector = new THREE.Vector3(snapPoint.position[0], 0, snapPoint.position[2]);
      if (focusVector.lengthSq() < 0.001) focusVector.set(0, 0, 1);
      focusVector.normalize();

      const technicianStop: [number, number, number] = [
        snapPoint.position[0] - focusVector.x * 0.45,
        0.3,
        snapPoint.position[2] - focusVector.z * 0.45,
      ];

      const equipmentId = selectedEquipment;
      setSelectedEquipment(null);
      setPendingPlacement({
        snapPointId: snapPoint.id,
        equipmentId,
        position: snapPoint.position,
      });
      setTechnicianTarget(technicianStop);
    },
    [selectedEquipment, completed, failed, pendingPlacement, isTechnicianInteracting, placedItems]
  );

  const completedObjectiveIds = new Set(placedItems.map((p) => p.snapPointId));
  const progress = snapPoints.length > 0 ? (placedItems.length / snapPoints.length) * 100 : 0;
  const isPlacementBusy = Boolean(pendingPlacement) || isTechnicianInteracting;

  if (completed) {
    return (
      <VictoryScreen
        missionTitle={mission.title}
        score={score}
        xp={mission.xp}
        timeRemaining={timeRemaining}
        timeLimit={timeLimit}
        onContinue={() => onComplete(score)}
      />
    );
  }

  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full bg-[hsl(var(--surface-0))]">
      <Canvas
        camera={{ position: [30, 20, 30], fov: 50 }}
        shadows
        gl={{ antialias: true }}
        style={{ background: 'hsl(240 25% 5%)' }}
      >
        <ambientLight intensity={0.3} color="hsl(214 22% 23%)" />
        <directionalLight position={[25, 35, 15]} intensity={0.6} color="hsl(28 100% 95%)" castShadow />
        <fog attach="fog" args={['hsl(240 25% 5%)', 50, 150]} />

        <CameraModeRig mode={cameraMode} focusPosition={firstPersonFocus} />

        <StageEnvironment3D />
        <TechnicianCharacter
          targetPosition={technicianTarget}
          isInteracting={isTechnicianInteracting}
          onReachTarget={handleReachSnapPoint}
        />
        <PlacedEquipment3D items={placedItems} />
        <SnapPoints
          points={snapPoints}
          placedItems={placedItems}
          selectedEquipment={selectedEquipment}
          onSnapClick={handleSnapClick}
        />

        {activeVFX.map((vfx) => (
          <PlacementVFX
            key={vfx.id}
            position={vfx.position}
            onComplete={() => setActiveVFX((prev) => prev.filter((v) => v.id !== vfx.id))}
          />
        ))}

        <DrunkNPC />
        <ProducerNPC />
        <ClientNPC />

        <OrbitControls
          enabled={cameraMode === 'orbit'}
          target={[0, 2, 0]}
          minDistance={1.8}
          maxDistance={30}
          minPolarAngle={Math.PI * 0.05}
          maxPolarAngle={Math.PI * 0.49}
          enablePan
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.7}
          panSpeed={0.7}
          zoomSpeed={0.7}
        />
      </Canvas>

      <EquipmentTray
        equipment={missionEquipment}
        selectedEquipment={selectedEquipment}
        placedItems={placedItems}
        onSelect={(equipmentId) => {
          if (isPlacementBusy) return;
          setSelectedEquipment(equipmentId);
        }}
      />

      <SimulatorHUD
        missionTitle={mission.title}
        score={score}
        timeRemaining={timeRemaining}
        objectives={objectives}
        completedObjectiveIds={completedObjectiveIds}
        progress={progress}
        onQuit={onQuit}
      />

      {cameraMode === 'firstPerson' && (
        <div className="pointer-events-none absolute left-1/2 top-5 z-30 -translate-x-1/2 rounded-md border border-border/60 bg-card/85 px-3 py-1 text-xs font-medium text-foreground shadow-lg backdrop-blur-sm">
          1ª pessoa: técnico ajustando configuração...
        </div>
      )}

      {isPlacementBusy && (
        <div className="pointer-events-none absolute bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-md border border-border/60 bg-card/85 px-4 py-2 text-sm text-foreground shadow-lg backdrop-blur-sm">
          Técnico a caminho do ponto de montagem...
        </div>
      )}

      {failed && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="space-y-3 text-center">
            <p className="text-4xl">⏰</p>
            <p className="text-xl font-bold text-destructive">Tempo Esgotado!</p>
            <p className="text-sm text-muted-foreground">Você colocou {placedItems.length}/{snapPoints.length} equipamentos</p>
            <button
              onClick={onQuit}
              className="mt-3 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Voltar ao Hub
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

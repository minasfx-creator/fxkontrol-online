import { useState, useEffect, useCallback, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import StageEnvironment3D from './StageEnvironment3D';
import TechnicianCharacter from './TechnicianCharacter';
import PlacedEquipment3D from './PlacedEquipment3D';
import SnapPoints from './SnapPoints';
import EquipmentTray from './EquipmentTray';
import SimulatorHUD from './SimulatorHUD';
import VictoryScreen from './VictoryScreen';
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

export default function TrainingSimulator({ mission, allEquipment, onComplete, onQuit }: TrainingSimulatorProps) {
  const snapPoints = MISSION_SNAP_POINTS[mission.id] || [];
  const missionEquipment = allEquipment.filter((e) => mission.equipment.includes(e.id));
  const timeLimit = MISSION_TIME_LIMITS[mission.id] || 120;

  // Build objectives from snap points
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer countdown
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
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [completed, failed]);

  // Check completion
  useEffect(() => {
    if (placedItems.length === snapPoints.length && snapPoints.length > 0 && !completed) {
      setCompleted(true);
      if (timerRef.current) clearInterval(timerRef.current);
      const timeBonus = Math.round(timeRemaining * 2);
      setScore((s) => s + timeBonus);
    }
  }, [placedItems, snapPoints.length, completed, timeRemaining]);

  const handleSnapClick = useCallback(
    (snapPoint: SnapPoint) => {
      if (!selectedEquipment || completed || failed) return;
      // Check if this snap point accepts the selected equipment
      if (snapPoint.equipmentType !== selectedEquipment) return;
      // Check if already placed
      if (placedItems.some((p) => p.snapPointId === snapPoint.id)) return;

      setPlacedItems((prev) => [
        ...prev,
        { snapPointId: snapPoint.id, equipmentId: selectedEquipment, position: snapPoint.position },
      ]);
      setScore((s) => s + 100);
      setSelectedEquipment(null);
    },
    [selectedEquipment, placedItems, completed, failed]
  );

  const completedObjectiveIds = new Set(placedItems.map((p) => p.snapPointId));
  const progress = snapPoints.length > 0 ? (placedItems.length / snapPoints.length) * 100 : 0;

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
    <div className="relative w-full h-[calc(100vh-3.5rem)] bg-[hsl(var(--surface-0))]">
      <Canvas
        camera={{ position: [12, 8, 12], fov: 50 }}
        shadows
        gl={{ antialias: true }}
        style={{ background: '#0a0a12' }}
      >
        <ambientLight intensity={0.3} color="#334455" />
        <directionalLight position={[10, 15, 5]} intensity={0.6} color="#ffeedd" castShadow />
        <fog attach="fog" args={['#0a0a12', 20, 60]} />

        <StageEnvironment3D />
        <TechnicianCharacter />
        <PlacedEquipment3D items={placedItems} />
        <SnapPoints
          points={snapPoints}
          placedItems={placedItems}
          selectedEquipment={selectedEquipment}
          onSnapClick={handleSnapClick}
        />

        <OrbitControls
          target={[0, 2, 0]}
          minDistance={5}
          maxDistance={30}
          minPolarAngle={Math.PI * 0.1}
          maxPolarAngle={Math.PI * 0.45}
          enablePan={false}
        />
      </Canvas>

      {/* HTML Overlays */}
      <EquipmentTray
        equipment={missionEquipment}
        selectedEquipment={selectedEquipment}
        placedItems={placedItems}
        onSelect={setSelectedEquipment}
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

      {failed && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="text-center space-y-3">
            <p className="text-4xl">⏰</p>
            <p className="text-xl font-bold text-destructive">Tempo Esgotado!</p>
            <p className="text-sm text-muted-foreground">Você colocou {placedItems.length}/{snapPoints.length} equipamentos</p>
            <button
              onClick={onQuit}
              className="mt-3 px-6 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Voltar ao Hub
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Training v2.1 — Cinematic Training Simulator.
 *
 * Wraps the existing 3D simulator with a staged MissionRunner FSM,
 * cinematic briefing/debrief overlays, MetaHuman-style NPCs, GTA-V-style
 * HUD, ambient NPC layer, and a cinematic camera director.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import StageEnvironment3D from './StageEnvironment3D';
import TechnicianCharacter from './TechnicianCharacter';
import PlacedEquipment3D from './PlacedEquipment3D';
import SnapPoints from './SnapPoints';
import EquipmentTray from './EquipmentTray';
import VictoryScreen from './VictoryScreen';
import PlacementVFX from './PlacementVFX';
import HumanoidCharacter from './humanoid/HumanoidCharacter';
import { getNPC } from './npcs/npcCatalog';
import {
  CinematicLetterbox,
  MissionTriangle,
  DialogueSubtitle,
  StarRating,
} from './hud/CinematicHUD';
import MiniMap from './hud/MiniMap';
import XPPopupLayer, { type XPPopup } from './hud/XPPopupLayer';
import MissionFailedScreen from './hud/MissionFailedScreen';
import MissionPassedFlash from './hud/MissionPassedFlash';
import AmbientNPCLayer from './ambient/AmbientNPCLayer';
import CinematicCameraDirector, { type CinematicCameraDirectorHandle } from './camera/CinematicCameraDirector';
import type { MissionScript, DialogueLine, CinematicBeat } from './missions/types';
import { createMissionRunner, type RunnerSnapshot } from './missions/missionRunner';
import {
  Equipment, SnapPoint, PlacedItem, MISSION_SNAP_POINTS,
} from './types';
import { Button } from '@/components/ui/button';
import { ArrowRight, BookOpen, RotateCcw } from 'lucide-react';

interface Props {
  script: MissionScript;
  allEquipment: Equipment[];
  onComplete: (score: number) => void;
  onQuit: () => void;
}

export default function CinematicTrainingSimulator({
  script,
  allEquipment,
  onComplete,
  onQuit,
}: Props) {
  const runner = useMemo(() => createMissionRunner(script), [script]);
  const [snap, setSnap] = useState<RunnerSnapshot>(() => runner.snapshot());
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [activeVFX, setActiveVFX] = useState<{ id: string; position: [number, number, number] }[]>([]);
  const [activeDialogue, setActiveDialogue] = useState<DialogueLine | null>(null);
  const [briefingIndex, setBriefingIndex] = useState(0);
  const directorRef = useRef<CinematicCameraDirectorHandle | null>(null);
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const [xpPopups, setXpPopups] = useState<XPPopup[]>([]);
  const [passedFlash, setPassedFlash] = useState(false);
  const tickRef = useRef<number | null>(null);

  useEffect(() => runner.subscribe(setSnap), [runner]);

  // Event stream → cinematic beats + xp popups + stage flash
  useEffect(() => {
    return runner.onEvent((ev) => {
      if (ev.kind === 'beat:start') setPendingBeat(ev.beat);
      else if (ev.kind === 'objective:complete') {
        setXpPopups((p) => [...p, { id: `xp-${Date.now()}-${Math.random()}`, amount: ev.scoreDelta, label: 'objetivo', variant: 'precision' }]);
      } else if (ev.kind === 'safety:violation') {
        setXpPopups((p) => [...p, { id: `xp-${Date.now()}`, amount: -script.scoreRules.safetyPenalty, label: 'violação', variant: 'penalty' }]);
      } else if (ev.kind === 'stage:complete') {
        setPassedFlash(true);
      }
    });
  }, [runner, script.scoreRules.safetyPenalty]);

  // Drive briefing dialogue
  useEffect(() => {
    if (snap.phase !== 'briefing') return;
    const line = script.briefing.lines[briefingIndex];
    if (line) setActiveDialogue(line);
    else { setActiveDialogue(null); runner.startMission(); }
  }, [snap.phase, briefingIndex, script.briefing.lines, runner]);

  // Mission timer
  useEffect(() => {
    if (snap.phase !== 'running') return;
    tickRef.current = window.setInterval(() => runner.tick(1), 1000);
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
  }, [snap.phase, runner]);

  // Stage-entry NPC speak
  useEffect(() => {
    if (snap.phase !== 'running' || !snap.currentStage?.onEnter) return;
    const ev = snap.currentStage.onEnter.find((e) => e.kind === 'speak' && e.line);
    if (ev?.line) setActiveDialogue({ npcId: ev.npcId, text: ev.line, intent: ev.intent });
  }, [snap.stageIndex, snap.phase, snap.currentStage]);

  const stageSnapPoints: SnapPoint[] = useMemo(() => {
    const all = MISSION_SNAP_POINTS[script.id] ?? [];
    if (!snap.currentStage) return [];
    const wanted = new Set(snap.currentStage.objectives.map((o) => o.snapPointId).filter(Boolean) as string[]);
    return all.filter((sp) => wanted.has(sp.id));
  }, [script.id, snap.currentStage]);

  const missionEquipment = allEquipment.filter((e) => script.equipment.includes(e.id));

  const activeNpcIds = useMemo(() => {
    const ids = new Set<string>(['roadie-veterano']);
    if (script.briefing.npcId) ids.add(script.briefing.npcId);
    snap.currentStage?.onEnter?.forEach((e) => ids.add(e.npcId));
    snap.currentStage?.dialogue?.forEach((d) => ids.add(d.npcId));
    if (activeDialogue) ids.add(activeDialogue.npcId);
    return [...ids].filter((id) => getNPC(id)?.id !== 'eletricista-radio');
  }, [script.briefing.npcId, snap.currentStage, activeDialogue]);

  // Resolve NPC world position for camera director
  const resolveNpcPosition = useCallback((id: string): [number, number, number] | null => {
    const p = getNPC(id);
    return p ? p.defaultPosition : null;
  }, []);

  const handleSnapClick = (sp: SnapPoint) => {
    if (snap.phase !== 'running' || !selectedEquipment) return;
    if (sp.equipmentType !== selectedEquipment) {
      runner.reportSafetyViolation();
      return;
    }
    if (placedItems.some((p) => p.snapPointId === sp.id)) return;
    setPlacedItems((prev) => [...prev, { snapPointId: sp.id, equipmentId: selectedEquipment, position: sp.position }]);
    setActiveVFX((prev) => [...prev, { id: `vfx-${Date.now()}`, position: sp.position }]);
    runner.completeObjective(sp.id);
    setSelectedEquipment(null);
  };

  const finishBriefing = () => setBriefingIndex((i) => i + 1);

  const replay = () => {
    runner.reset();
    setPlacedItems([]); setBriefingIndex(0); setPendingBeat(null);
    setXpPopups([]); setPassedFlash(false);
  };

  // Debrief
  if (snap.phase === 'complete') {
    return (
      <DebriefScreen script={script} snap={snap} onContinue={() => onComplete(snap.score)} onReplay={replay} />
    );
  }

  // Failure
  if (snap.phase === 'failed') {
    const trigger = snap.remainingSeconds <= 0 ? 'timeout' : snap.safetyViolations >= 5 ? 'safety-violations-exceeded' : 'manual';
    const fs = (script.failureScenarios ?? []).find((f) => f.trigger === trigger) ?? { title: 'MISSÃO FALHADA', flavor: 'Falha crítica registrada.', lesson: 'Revise o playbook e tente novamente.' };
    return (
      <div className="relative h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-black/95">
        <MissionFailedScreen title={fs.title} flavor={fs.flavor} lesson={fs.lesson} onRetry={replay} onQuit={onQuit} />
      </div>
    );
  }

  const ambient = script.ambient ?? 'calm';

  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full bg-[hsl(var(--surface-0))] overflow-hidden">
      <Canvas camera={{ position: [35, 25, 35], fov: 50 }} shadows gl={{ antialias: true }} style={{ background: 'hsl(240 25% 5%)' }}>
        <ambientLight intensity={0.35} color="hsl(214 22% 23%)" />
        <directionalLight position={[25, 35, 15]} intensity={0.6} color="hsl(28 100% 95%)" castShadow />
        <fog attach="fog" args={['hsl(240 25% 5%)', 50, 150]} />

        <StageEnvironment3D />
        <TechnicianCharacter targetPosition={null} isInteracting={false} onReachTarget={() => {}} />
        <PlacedEquipment3D items={placedItems} />
        <SnapPoints points={stageSnapPoints} placedItems={placedItems} selectedEquipment={selectedEquipment} onSnapClick={handleSnapClick} />

        {activeVFX.map((vfx) => (
          <PlacementVFX
            key={vfx.id}
            position={vfx.position}
            onComplete={() => setActiveVFX((prev) => prev.filter((v) => v.id !== vfx.id))}
          />
        ))}

        {activeNpcIds.map((id) => {
          const persona = getNPC(id);
          if (!persona) return null;
          const isSpeaking = activeDialogue?.npcId === id;
          return (
            <HumanoidCharacter
              key={id}
              persona={persona}
              speakingAmplitude={isSpeaking ? 0.8 : 0}
              intent={isSpeaking ? activeDialogue?.intent ?? persona.defaultIntent : persona.defaultIntent}
              pointAt={isSpeaking ? activeDialogue?.pointAt ?? null : null}
              closeup={isSpeaking}
              lookAtTarget={[0, 1.6, 0]}
              voiceLineId={isSpeaking ? activeDialogue?.text ?? null : null}
            />
          );
        })}

        <AmbientNPCLayer preset={ambient} maxNpcs={ambient === 'frantic' ? 4 : 2} exclude={activeNpcIds} />

        <CinematicCameraDirector
          pendingBeat={pendingBeat}
          resolveNpcPosition={resolveNpcPosition}
          onActiveChange={(active) => setOrbitEnabled(!active)}
        />

        <OrbitControls
          enabled={orbitEnabled}
          target={[0, 4, 0]}
          minDistance={1.8}
          maxDistance={30}
          minPolarAngle={Math.PI * 0.05}
          maxPolarAngle={Math.PI * 0.49}
          enablePan
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>

      <CinematicLetterbox active={snap.phase === 'briefing' || Boolean(activeDialogue) || !orbitEnabled} />

      {snap.currentStage && snap.phase === 'running' && (
        <MissionTriangle
          missionTitle={script.title}
          chapter={script.chapter}
          stageTitle={snap.currentStage.title}
          stageIndex={snap.stageIndex}
          totalStages={snap.totalStages}
        />
      )}

      <EquipmentTray
        equipment={missionEquipment}
        selectedEquipment={selectedEquipment}
        placedItems={placedItems}
        onSelect={(id) => snap.phase === 'running' && setSelectedEquipment(id)}
      />

      {snap.phase === 'running' && (
        <div className="absolute right-3 top-3 z-30 rounded-md bg-black/85 backdrop-blur-md border border-white/10 px-3 py-2 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-widest font-mono text-muted-foreground">Tempo</p>
              <p className={`text-base font-bold font-mono ${snap.remainingSeconds <= 15 ? 'text-destructive animate-pulse' : 'text-foreground'}`}>
                {Math.floor(snap.remainingSeconds / 60)}:{(snap.remainingSeconds % 60).toString().padStart(2, '0')}
              </p>
            </div>
            <div className="border-l border-white/10 pl-3 text-right">
              <p className="text-[9px] uppercase tracking-widest font-mono text-muted-foreground">Score</p>
              <p className="text-base font-bold font-mono text-[hsl(45_100%_60%)]">{snap.score}</p>
            </div>
          </div>
        </div>
      )}

      <XPPopupLayer popups={xpPopups} onConsumed={(id) => setXpPopups((p) => p.filter((x) => x.id !== id))} />

      <MissionPassedFlash active={passedFlash} onDone={() => setPassedFlash(false)} />

      {snap.phase === 'running' && (
        <MiniMap
          npcs={activeNpcIds.map((id) => {
            const p = getNPC(id);
            return p ? { id, position: p.defaultPosition, color: p.subtitleColor } : null;
          }).filter(Boolean) as { id: string; position: [number,number,number]; color: string }[]}
          placedItems={placedItems}
          pendingSnapPoints={stageSnapPoints}
        />
      )}

      <button
        onClick={() => { runner.fail('manual'); onQuit(); }}
        className="absolute bottom-3 right-3 z-30 rounded-md bg-black/70 hover:bg-black/85 border border-white/10 px-3 py-1.5 text-xs font-medium text-foreground transition-colors"
      >
        Sair
      </button>

      {snap.phase === 'running' && snap.currentStage?.hint && !activeDialogue && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-30 -translate-x-1/2 max-w-md">
          <div className="rounded-md bg-black/80 backdrop-blur-md border border-white/10 px-3 py-1.5">
            <p className="text-xs text-foreground/85 text-center">💡 {snap.currentStage.hint}</p>
          </div>
        </div>
      )}

      {activeDialogue && (() => {
        const persona = getNPC(activeDialogue.npcId);
        return (
          <DialogueSubtitle
            speakerName={persona?.displayName ?? activeDialogue.npcId}
            speakerColor={persona?.subtitleColor ?? '#ffffff'}
            text={activeDialogue.text}
            duration={activeDialogue.durationMs}
            onSkip={() => { if (snap.phase === 'briefing') finishBriefing(); else setActiveDialogue(null); }}
            onComplete={() => { if (snap.phase === 'briefing') finishBriefing(); else setActiveDialogue(null); }}
          />
        );
      })()}
    </div>
  );
}

function DebriefScreen({
  script, snap, onContinue, onReplay,
}: {
  script: MissionScript;
  snap: RunnerSnapshot;
  onContinue: () => void;
  onReplay: () => void;
}) {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-gradient-to-b from-black via-[hsl(240_25%_5%)] to-black px-4 py-8">
      <div className="max-w-2xl w-full space-y-6 animate-fxk-fade-up">
        <div className="text-center space-y-3">
          <p className="text-[10px] uppercase tracking-[0.3em] font-mono text-[hsl(28_100%_60%)]">{script.chapter}</p>
          <h2 className="text-3xl font-bold text-foreground">{script.debrief.title}</h2>
          <div className="flex justify-center pt-2"><StarRating stars={snap.starRating} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md border border-border/50 bg-card/50 p-3 text-center">
            <p className="text-[9px] uppercase tracking-widest font-mono text-muted-foreground">Score</p>
            <p className="text-xl font-bold font-mono text-[hsl(45_100%_60%)]">{snap.score}</p>
          </div>
          <div className="rounded-md border border-border/50 bg-card/50 p-3 text-center">
            <p className="text-[9px] uppercase tracking-widest font-mono text-muted-foreground">Tempo Sobr.</p>
            <p className="text-xl font-bold font-mono text-foreground">{snap.remainingSeconds}s</p>
          </div>
          <div className="rounded-md border border-border/50 bg-card/50 p-3 text-center">
            <p className="text-[9px] uppercase tracking-widest font-mono text-muted-foreground">Violações</p>
            <p className={`text-xl font-bold font-mono ${snap.safetyViolations > 0 ? 'text-destructive' : 'text-emerald-400'}`}>{snap.safetyViolations}</p>
          </div>
        </div>
        <div className="rounded-lg border border-border/50 bg-card/50 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[hsl(28_100%_60%)]" />
            <p className="text-xs font-bold uppercase tracking-wider text-foreground">Aprendizado técnico</p>
          </div>
          <ul className="space-y-1.5 text-sm text-foreground/85">
            {script.debrief.takeaways.map((t, i) => (
              <li key={i} className="flex gap-2"><span className="text-[hsl(28_100%_60%)]">▸</span><span>{t}</span></li>
            ))}
          </ul>
        </div>
        <div className="flex gap-3 justify-center pt-2">
          <Button variant="outline" onClick={onReplay}><RotateCcw className="h-4 w-4 mr-2" /> Refazer</Button>
          <Button onClick={onContinue} className="min-w-[140px]">Continuar <ArrowRight className="h-4 w-4 ml-2" /></Button>
        </div>
      </div>
    </div>
  );
}

export { VictoryScreen };

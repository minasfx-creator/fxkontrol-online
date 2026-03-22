import { useRef, useState, useCallback, useMemo, useEffect, forwardRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useProjectStore, type Position, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { useUndoStore } from '@/store/useUndoStore';
import { calcWindCompensation, getBreakHeight, getMortarVelocity, getLiftTime } from '@/lib/pyroPhysics';

const ARROW_LENGTH = 3.5;
const PITCH_ARC_RADIUS = 2.2;
const HEADING_ARC_RADIUS = 1.8;
const ROLL_ARC_RADIUS = 1.4;
const TRAJECTORY_POINTS = 40;

/* ─── Finale 3D Colors ─── */
const COLORS = {
  arrow: '#4FC3F7',
  arrowActive: '#81D4FA',
  pitchArc: '#FF8A65',
  headingArc: '#4FC3F7',
  rollArc: '#66BB6A',
  trajectory: '#FFD54F',
  handle: '#FFFFFF',
  handleActive: '#FFD54F',
  handleHover: '#81D4FA',
  grid: '#4FC3F7',
  label: '#B0BEC5',
  labelValue: '#FFFFFF',
};

/**
 * Inline editable numeric input for H/P/R labels in 3D gizmo.
 */
function InlineAngleInput({
  label,
  value,
  color,
  onChange,
  min = -360,
  max = 360,
}: {
  label: string;
  value: number;
  color: string;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(Math.round(value)));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(String(Math.round(value)));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) {
      onChange(Math.max(min, Math.min(max, parsed)));
    }
  };

  if (editing) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
        <span style={{ color, fontWeight: 600 }}>{label}</span>
        <input
          ref={inputRef}
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          autoFocus
          onFocus={e => e.target.select()}
          style={{
            width: '42px',
            background: 'rgba(255,255,255,0.08)',
            border: `1px solid ${color}`,
            borderRadius: '2px',
            color: '#fff',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            padding: '0 2px',
            outline: 'none',
            textAlign: 'right',
          }}
        />
        <span style={{ color: COLORS.labelValue }}>°</span>
      </span>
    );
  }

  return (
    <span
      style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      title={`Click to edit ${label}`}
    >
      <span style={{ color, fontWeight: 600 }}>{label}</span>
      <span style={{ color: COLORS.labelValue, borderBottom: '1px dashed rgba(255,255,255,0.2)' }}>
        {Math.round(value)}°
      </span>
    </span>
  );
}

/**
 * PitchArcGizmo: Finale-style pitch arc visualization.
 */
function PitchArc({ heading, pitch }: { heading: number; pitch: number }) {
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    const hRad = heading * (Math.PI / 180);
    const startAngle = Math.PI / 2;
    const endAngle = pitch * (Math.PI / 180);
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = startAngle + (endAngle - startAngle) * t;
      const r = PITCH_ARC_RADIUS;
      pts.push([
        Math.sin(hRad) * Math.cos(angle) * r,
        Math.sin(angle) * r,
        -Math.cos(hRad) * Math.cos(angle) * r,
      ]);
    }
    return pts;
  }, [heading, pitch]);

  if (points.length < 2) return null;
  return <Line points={points} color={COLORS.pitchArc} lineWidth={2} transparent opacity={0.7} />;
}

/**
 * RollArc: Green arc visualization for roll rotation around launch axis.
 */
function RollArc({ heading, pitch, roll }: { heading: number; pitch: number; roll: number }) {
  const points = useMemo(() => {
    if (Math.abs(roll) < 0.5) return null;
    const pts: [number, number, number][] = [];
    const hRad = heading * (Math.PI / 180);
    const pRad = pitch * (Math.PI / 180);
    const r = ROLL_ARC_RADIUS;
    const steps = 20;
    // Roll arc is a circle perpendicular to the launch direction
    const launchDir = new THREE.Vector3(
      Math.sin(hRad) * Math.cos(pRad),
      Math.sin(pRad),
      -Math.cos(hRad) * Math.cos(pRad)
    ).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, launchDir).normalize();
    const arcUp = new THREE.Vector3().crossVectors(launchDir, right).normalize();

    const rollRad = roll * (Math.PI / 180);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = rollRad * t;
      const px = right.x * Math.cos(angle) * r + arcUp.x * Math.sin(angle) * r;
      const py = right.y * Math.cos(angle) * r + arcUp.y * Math.sin(angle) * r;
      const pz = right.z * Math.cos(angle) * r + arcUp.z * Math.sin(angle) * r;
      // Offset along launch direction slightly
      pts.push([
        launchDir.x * 1.5 + px,
        launchDir.y * 1.5 + py,
        launchDir.z * 1.5 + pz,
      ]);
    }
    return pts;
  }, [heading, pitch, roll]);

  if (!points || points.length < 2) return null;
  return <Line points={points} color={COLORS.rollArc} lineWidth={2} transparent opacity={0.6} />;
}

/**
 * HeadingCompassArc
 */
function HeadingCompass({ heading, shiftHeld }: { heading: number; shiftHeld?: boolean }) {
  const compassCircle = useMemo(() => {
    const pts: [number, number, number][] = [];
    const r = HEADING_ARC_RADIUS;
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      pts.push([Math.sin(angle) * r, 0.02, -Math.cos(angle) * r]);
    }
    return pts;
  }, []);

  // Snap grid lines every 15° when Shift held
  const snapGridLines = useMemo(() => {
    if (!shiftHeld) return null;
    const lines: [number, number, number][][] = [];
    const r = HEADING_ARC_RADIUS;
    for (let deg = 0; deg < 360; deg += 15) {
      const rad = deg * (Math.PI / 180);
      lines.push([
        [Math.sin(rad) * r * 0.8, 0.02, -Math.cos(rad) * r * 0.8],
        [Math.sin(rad) * r * 1.1, 0.02, -Math.cos(rad) * r * 1.1],
      ]);
    }
    return lines;
  }, [shiftHeld]);

  const headingTick = useMemo(() => {
    const hRad = heading * (Math.PI / 180);
    const r = HEADING_ARC_RADIUS;
    return [
      [Math.sin(hRad) * r * 0.85, 0.02, -Math.cos(hRad) * r * 0.85] as [number, number, number],
      [Math.sin(hRad) * r * 1.15, 0.02, -Math.cos(hRad) * r * 1.15] as [number, number, number],
    ];
  }, [heading]);

  const northTick = useMemo(() => {
    const r = HEADING_ARC_RADIUS;
    return [
      [0, 0.02, -(r * 0.85)] as [number, number, number],
      [0, 0.02, -(r * 1.15)] as [number, number, number],
    ];
  }, []);

  const headingArc = useMemo(() => {
    const pts: [number, number, number][] = [];
    const r = HEADING_ARC_RADIUS * 0.95;
    const hRad = heading * (Math.PI / 180);
    const steps = Math.max(2, Math.abs(Math.round(heading / 5)));
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * hRad;
      pts.push([Math.sin(angle) * r, 0.03, -Math.cos(angle) * r]);
    }
    return pts;
  }, [heading]);

  return (
    <group>
      <Line points={compassCircle} color={COLORS.grid} lineWidth={0.8} transparent opacity={0.15} />
      {snapGridLines && snapGridLines.map((pts, i) => (
        <Line key={i} points={pts} color={COLORS.grid} lineWidth={0.5} transparent opacity={0.25} />
      ))}
      <Line points={northTick} color="#EF5350" lineWidth={2} transparent opacity={0.5} />
      <Line points={headingTick} color={COLORS.headingArc} lineWidth={2.5} transparent opacity={0.8} />
      {headingArc.length >= 2 && (
        <Line points={headingArc} color={COLORS.headingArc} lineWidth={1.8} transparent opacity={0.5} />
      )}
    </group>
  );
}

/**
 * LaunchAngleGizmo: Finale 3D-style heading/pitch/roll editing with inline editable inputs.
 */
const LaunchAngleGizmo = forwardRef<THREE.Group, {
  position: Position;
  batchMode?: boolean;
  selectedIds?: string[];
}>(({ position, batchMode, selectedIds }, ref) => {
  const { updatePosition } = useProjectStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [dragAxis, setDragAxis] = useState<'all' | 'heading' | 'pitch' | 'roll' | 'up-vector'>('all');
  const dragStartRef = useRef<{ heading: number; pitch: number } | null>(null);
  const batchStartRef = useRef<Map<string, { heading: number; pitch: number }>>(new Map());
  const handleRef = useRef<THREE.Mesh>(null);
  const { camera, raycaster, gl } = useThree();

  // Listen for axis-constrained rotation from context menu
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setDragAxis(e.detail.axis || 'all');
    };
    window.addEventListener('angle-mode-axis' as any, handler as any);
    return () => window.removeEventListener('angle-mode-axis' as any, handler as any);
  }, []);

  const heading = position.heading * (Math.PI / 180);
  // Expanded pitch range: -180 to 180 per Finale 3D spec
  const pitch = Math.max(-180, Math.min(180, position.pitch || 85)) * (Math.PI / 180);

  // Get real caliber from linked effects
  const timelineItems = useProjectStore(s => s.timelineItems);
  const realCaliber = useMemo(() => {
    const linked = timelineItems.filter(t => t.positionId === position.id || t.positionIds?.includes(position.id));
    let cal = 4;
    for (const item of linked) {
      const eff = EFFECT_LIBRARY.find(e => e.id === item.effectId);
      if (eff?.caliber && eff.caliber > cal) cal = eff.caliber;
    }
    return cal;
  }, [timelineItems, position.id]);

  // Compute physics-based trajectory using caliber-derived parameters
  const trajectoryData = useMemo(() => {
    const caliber = realCaliber;
    const v0 = getMortarVelocity(caliber);
    const hRad = heading;
    const pRad = pitch;
    const vx = Math.sin(hRad) * Math.cos(pRad) * v0;
    const vy = Math.sin(pRad) * v0;
    const vz = -Math.cos(hRad) * Math.cos(pRad) * v0;
    const g = 9.81;
    const drag = 0.03;
    const dt = 0.05;
    const maxT = 8;

    const pts: [number, number, number][] = [];
    let px = 0, py = 0, pz = 0;
    let cvx = vx, cvy = vy, cvz = vz;
    let apexY = 0;
    let apexIdx = 0;

    // Scale factor for gizmo display (real meters → gizmo units)
    const scale = ARROW_LENGTH / getBreakHeight(caliber);

    for (let t = 0; t < maxT; t += dt) {
      pts.push([px * scale, py * scale, pz * scale]);
      if (py > apexY) { apexY = py; apexIdx = pts.length - 1; }

      // Physics step
      const speed = Math.sqrt(cvx * cvx + cvy * cvy + cvz * cvz);
      const dragF = drag * speed;
      cvx -= cvx * dragF * dt;
      cvy -= (g + cvy * dragF) * dt;
      cvz -= cvz * dragF * dt;
      px += cvx * dt;
      py += cvy * dt;
      pz += cvz * dt;

      if (py < 0 && t > 0.5) break;
    }

    // Clamp apex index
    const safeApex = Math.min(apexIdx, pts.length - 1);
    const apexPoint = pts[safeApex] || [0, ARROW_LENGTH, 0];

    // Also compute the last point (end of trajectory)
    const lastPoint = pts[pts.length - 1] || apexPoint;

    return { points: pts, apexPoint, lastPoint, apexIdx: safeApex };
  }, [heading, pitch]);

  // Handle at the END of the trajectory (Finale 3D style — grab burst point)
  const handlePos = useMemo((): [number, number, number] => {
    return trajectoryData.lastPoint as [number, number, number];
  }, [trajectoryData]);

  const arrowShaftPoints = useMemo((): [number, number, number][] => {
    const pts: [number, number, number][] = [];
    const steps = 8;
    const tipDir: [number, number, number] = [
      Math.sin(heading) * Math.cos(pitch) * ARROW_LENGTH,
      Math.sin(pitch) * ARROW_LENGTH,
      -Math.cos(heading) * Math.cos(pitch) * ARROW_LENGTH,
    ];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push([tipDir[0] * t, tipDir[1] * t, tipDir[2] * t]);
    }
    return pts;
  }, [heading, pitch]);

  const trajectoryPoints = trajectoryData.points;

  const onPointerDown = useCallback((e: any) => {
    e.stopPropagation();
    useUndoStore.getState().checkpoint();
    setIsDragging(true);
    dragStartRef.current = { heading: position.heading, pitch: position.pitch || 85 };
    if (batchMode && selectedIds) {
      const store = useProjectStore.getState();
      const map = new Map<string, { heading: number; pitch: number }>();
      selectedIds.forEach(id => {
        const p = store.positions.find(pos => pos.id === id);
        if (p) map.set(id, { heading: p.heading, pitch: p.pitch || 85 });
      });
      batchStartRef.current = map;
    }
    (gl.domElement as HTMLElement).style.cursor = 'grabbing';
  }, [gl, position, batchMode, selectedIds]);

  // Delta HUD state for angle changes
  const [angleDelta, setAngleDelta] = useState<{ h: number; p: number } | null>(null);

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, camera);
      const origin = new THREE.Vector3(position.x, position.y, position.z);
      const ray = raycaster.ray;
      const closest = new THREE.Vector3();
      ray.closestPointToPoint(origin, closest);
      const dir = closest.sub(origin).normalize();

      let newHeading = Math.atan2(dir.x, -dir.z) * (180 / Math.PI);
      let newPitch = Math.max(-180, Math.min(180, Math.asin(Math.max(-1, Math.min(1, dir.y))) * (180 / Math.PI)));

      // Shift-snap to 5° increments
      if (e.shiftKey) {
        newHeading = Math.round(newHeading / 5) * 5;
        newPitch = Math.round(newPitch / 5) * 5;
      }

      // Axis constraints
      if (dragAxis === 'heading' || dragAxis === 'up-vector') newPitch = position.pitch || 85;
      if (dragAxis === 'pitch') newHeading = position.heading;
      if (dragAxis === 'roll') {
        // Roll: compute from mouse position relative to launch axis
        newHeading = position.heading;
        newPitch = position.pitch || 85;
      }

      // Compute delta for HUD
      if (dragStartRef.current) {
        setAngleDelta({
          h: Math.round(newHeading - dragStartRef.current.heading),
          p: Math.round(newPitch - dragStartRef.current.pitch),
        });
      }

      if (batchMode && selectedIds && dragStartRef.current) {
        const dHeading = newHeading - dragStartRef.current.heading;
        const dPitch = newPitch - dragStartRef.current.pitch;
        selectedIds.forEach(id => {
          const start = batchStartRef.current.get(id);
          if (start) {
            let h = dragAxis === 'pitch' ? start.heading : start.heading + dHeading;
            let p = dragAxis === 'heading' ? start.pitch : Math.max(-180, Math.min(180, start.pitch + dPitch));
            if (e.shiftKey) { h = Math.round(h / 5) * 5; p = Math.round(p / 5) * 5; }
            updatePosition(id, { heading: h, pitch: p });
          }
        });
      } else {
        updatePosition(position.id, { heading: newHeading, pitch: newPitch });
      }
    };
    const handleUp = () => {
      setIsDragging(false);
      setAngleDelta(null);
      dragStartRef.current = null;
      batchStartRef.current.clear();
      (gl.domElement as HTMLElement).style.cursor = '';
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [isDragging, position, updatePosition, camera, raycaster, gl, batchMode, selectedIds, dragAxis]);

  const handleColor = isDragging ? COLORS.handleActive : isHovered ? COLORS.handleHover : COLORS.handle;
  const handleSize = isDragging ? 0.22 : isHovered ? 0.2 : 0.15;

  // Axis color indicator during drag
  const axisIndicatorColor = dragAxis === 'heading' ? COLORS.headingArc : dragAxis === 'pitch' ? COLORS.pitchArc : dragAxis === 'roll' ? COLORS.rollArc : null;

  const wind = useProjectStore(s => s.wind);
  const windCompGhost = useMemo(() => {
    if (!wind.enabled || wind.speed < 0.5) return null;
    const comp = calcWindCompensation(4, wind.speed, wind.direction, position.heading);
    if (Math.abs(comp.headingOffset) < 0.5 && Math.abs(comp.pitchOffset) < 0.5) return null;
    const compH = (position.heading + comp.headingOffset) * (Math.PI / 180);
    const compP = Math.max(-180, Math.min(180, (position.pitch || 85) + comp.pitchOffset)) * (Math.PI / 180);
    const r = ARROW_LENGTH * 0.9;
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      pts.push([
        Math.sin(compH) * Math.cos(compP) * r * t,
        Math.sin(compP) * r * t,
        -Math.cos(compH) * Math.cos(compP) * r * t,
      ]);
    }
    return { points: pts, drift: comp };
  }, [wind, position.heading, position.pitch]);

  return (
    <group ref={ref} position={[position.x, position.y, position.z]}>
      <HeadingCompass heading={position.heading} shiftHeld={isDragging} />
      <PitchArc heading={position.heading} pitch={position.pitch || 85} />
      <RollArc heading={position.heading} pitch={position.pitch || 85} roll={position.roll || 0} />

      {/* Axis constraint indicator ring */}
      {isDragging && axisIndicatorColor && (
        <mesh position={handlePos}>
          <ringGeometry args={[handleSize + 0.15, handleSize + 0.22, 16]} />
          <meshBasicMaterial color={axisIndicatorColor} transparent opacity={0.4} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
        </mesh>
      )}

      <Line points={arrowShaftPoints} color={COLORS.arrow} lineWidth={2.5} transparent opacity={0.85} />

      {windCompGhost && windCompGhost.points.length > 1 && (
        <Line points={windCompGhost.points} color="#4CAF50" lineWidth={1.5} dashed dashSize={0.15} gapSize={0.1} transparent opacity={0.5} />
      )}

      {/* Trajectory — solid line with burst marker (Finale 3D style) */}
      {trajectoryPoints.length > 1 && (
        <>
          <Line points={trajectoryPoints} color={COLORS.trajectory} lineWidth={2} transparent opacity={0.6} />
          {/* Burst point marker at apex */}
          <mesh position={trajectoryData.apexPoint as [number, number, number]}>
            <octahedronGeometry args={[0.1, 0]} />
            <meshBasicMaterial color={COLORS.trajectory} transparent opacity={0.8} />
          </mesh>
        </>
      )}

      {/* Arrow cone tip at end of shaft */}
      {(() => {
        const tipPos: [number, number, number] = [
          Math.sin(heading) * Math.cos(pitch) * ARROW_LENGTH,
          Math.sin(pitch) * ARROW_LENGTH,
          -Math.cos(heading) * Math.cos(pitch) * ARROW_LENGTH,
        ];
        const dir = new THREE.Vector3(...tipPos).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        const e = new THREE.Euler().setFromQuaternion(q);
        return (
          <mesh position={tipPos} rotation={[e.x, e.y, e.z]}>
            <coneGeometry args={[0.08, 0.25, 6]} />
            <meshBasicMaterial color={COLORS.arrow} transparent opacity={0.8} />
          </mesh>
        );
      })()}

      {/* Draggable handle */}
      <mesh
        ref={handleRef}
        position={handlePos}
        onPointerDown={onPointerDown}
        onPointerOver={() => { setIsHovered(true); (gl.domElement as HTMLElement).style.cursor = 'grab'; }}
        onPointerOut={() => { setIsHovered(false); if (!isDragging) (gl.domElement as HTMLElement).style.cursor = ''; }}
      >
        <sphereGeometry args={[handleSize, 12, 12]} />
        <meshBasicMaterial color={handleColor} transparent opacity={isDragging ? 1.0 : 0.7} />
      </mesh>

      {(isDragging || isHovered) && (
        <mesh position={handlePos}>
          <ringGeometry args={[handleSize + 0.05, handleSize + 0.12, 16]} />
          <meshBasicMaterial color={COLORS.handleActive} transparent opacity={0.3} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
        </mesh>
      )}

      {/* Finale 3D-style label with inline editable H/P/R */}
      <Html
        position={[handlePos[0] * 1.15 + 0.4, handlePos[1] * 1.15 + 0.5, handlePos[2] * 1.15]}
        center
        occlude
        distanceFactor={10}
      >
        <div
          className="select-none"
          style={{
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: '10px',
            lineHeight: '1.3',
            background: 'rgba(13, 17, 23, 0.92)',
            border: '1px solid rgba(79, 195, 247, 0.3)',
            borderRadius: '3px',
            padding: '3px 6px',
            whiteSpace: 'nowrap',
            color: COLORS.label,
            backdropFilter: 'blur(4px)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ fontWeight: 700, color: COLORS.labelValue, fontSize: '9px', marginBottom: '1px' }}>
            {position.name}
            {position.section && (
              <span style={{ marginLeft: '4px', fontSize: '8px', color: '#4FC3F7', opacity: 0.7 }}>§{position.section}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <InlineAngleInput
              label="H"
              value={position.heading}
              color={COLORS.headingArc}
              onChange={v => updatePosition(position.id, { heading: v })}
              min={-360}
              max={360}
            />
            <InlineAngleInput
              label="P"
              value={position.pitch || 85}
              color={COLORS.pitchArc}
              onChange={v => updatePosition(position.id, { pitch: v })}
              min={-180}
              max={180}
            />
            {(position.roll !== undefined && position.roll !== 0) && (
              <InlineAngleInput
                label="R"
                value={position.roll}
                color={COLORS.rollArc}
                onChange={v => updatePosition(position.id, { roll: v })}
                min={-180}
                max={180}
              />
            )}
          </div>
          {windCompGhost && (
            <div style={{ fontSize: '8px', color: '#4CAF50', opacity: 0.8, marginTop: '1px' }}>
              ↻ drift {windCompGhost.drift.driftX}m × {windCompGhost.drift.driftZ}m
            </div>
          )}
          {/* Delta HUD during drag */}
          {isDragging && angleDelta && (
            <div style={{ fontSize: '9px', color: COLORS.handleActive, fontWeight: 700, marginTop: '2px', letterSpacing: '0.5px' }}>
              ΔH {angleDelta.h > 0 ? '+' : ''}{angleDelta.h}° · ΔP {angleDelta.p > 0 ? '+' : ''}{angleDelta.p}°
            </div>
          )}
        </div>
      </Html>
    </group>
  );
});
LaunchAngleGizmo.displayName = 'LaunchAngleGizmo';

/**
 * AngleFanArc: Finale-style fan showing heading spread for batch selection.
 */
function AngleFanArc({ positions }: { positions: Position[] }) {
  const arcPoints = useMemo(() => {
    if (positions.length < 2) return null;
    const cx = positions.reduce((s, p) => s + p.x, 0) / positions.length;
    const cz = positions.reduce((s, p) => s + p.z, 0) / positions.length;
    const cy = positions.reduce((s, p) => s + p.y, 0) / positions.length;
    const headings = positions.map(p => p.heading);
    const minH = Math.min(...headings) * (Math.PI / 180);
    const maxH = Math.max(...headings) * (Math.PI / 180);
    const avgPitch = (positions.reduce((s, p) => s + (p.pitch || 85), 0) / positions.length) * (Math.PI / 180);
    const r = 3.5;
    const steps = 32;
    const pts: [number, number, number][] = [[cx, cy + 0.05, cz]];
    for (let i = 0; i <= steps; i++) {
      const angle = minH + (maxH - minH) * (i / steps);
      pts.push([
        cx + Math.sin(angle) * Math.cos(avgPitch) * r,
        cy + Math.sin(avgPitch) * r * 0.3 + 0.05,
        cz - Math.cos(angle) * Math.cos(avgPitch) * r,
      ]);
    }
    pts.push([cx, cy + 0.05, cz]);
    return pts;
  }, [positions]);

  if (!arcPoints) return null;
  return <Line points={arcPoints} color={COLORS.headingArc} lineWidth={1.5} transparent opacity={0.25} />;
}

/**
 * BatchAngleLabel
 */
function BatchAngleLabel({ positions }: { positions: Position[] }) {
  const center = useMemo(() => {
    const cx = positions.reduce((s, p) => s + p.x, 0) / positions.length;
    const cy = positions.reduce((s, p) => s + p.y, 0) / positions.length;
    const cz = positions.reduce((s, p) => s + p.z, 0) / positions.length;
    return [cx, cy + 2, cz] as [number, number, number];
  }, [positions]);

  const stats = useMemo(() => {
    const hs = positions.map(p => p.heading);
    const ps = positions.map(p => p.pitch || 85);
    return {
      hMin: Math.round(Math.min(...hs)),
      hMax: Math.round(Math.max(...hs)),
      pMin: Math.round(Math.min(...ps)),
      pMax: Math.round(Math.max(...ps)),
      count: positions.length,
    };
  }, [positions]);

  return (
    <Html position={center} center distanceFactor={12}>
      <div
        className="select-none pointer-events-none"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '9px',
          lineHeight: '1.3',
          background: 'rgba(13, 17, 23, 0.95)',
          border: '1px solid rgba(255, 213, 79, 0.4)',
          borderRadius: '3px',
          padding: '3px 6px',
          whiteSpace: 'nowrap',
          color: COLORS.label,
        }}
      >
        <div style={{ fontWeight: 700, color: COLORS.handleActive, fontSize: '8px' }}>
          BATCH × {stats.count}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <span style={{ color: COLORS.headingArc }}>H</span>
          <span style={{ color: COLORS.labelValue }}>{stats.hMin}°–{stats.hMax}°</span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <span style={{ color: COLORS.pitchArc }}>P</span>
          <span style={{ color: COLORS.labelValue }}>{stats.pMin}°–{stats.pMax}°</span>
        </div>
      </div>
    </Html>
  );
}

export default function PyroLaunchAngles() {
  const positions = useProjectStore(s => s.positions);
  const selectedIds = useProjectStore(s => s.selectedPositionIds);
  const editorMode = useProjectStore(s => s.editorMode);
  const timelineItems = useProjectStore(s => s.timelineItems);
  const pyroPositions = positions.filter(p => p.type === 'pyro');
  const isAngleMode = editorMode === 'adjust-angles';
  
  // Auto-show trajectory for selected positions with effects (even in select mode)
  const visiblePositions = useMemo(() => {
    if (isAngleMode) {
      return selectedIds.length > 0 ? pyroPositions.filter(p => selectedIds.includes(p.id)) : pyroPositions;
    }
    // In select mode: show for selected positions that have linked effects
    return pyroPositions.filter(p => {
      if (!selectedIds.includes(p.id)) return false;
      return timelineItems.some(t => t.positionId === p.id || t.positionIds?.includes(p.id));
    });
  }, [isAngleMode, selectedIds, pyroPositions, timelineItems]);
  
  const selectedPyroPositions = pyroPositions.filter(p => selectedIds.includes(p.id));
  const isBatch = selectedIds.length > 1;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'a' || e.key === 'A') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        const store = useProjectStore.getState();
        store.setEditorMode(store.editorMode === 'adjust-angles' ? 'select' : 'adjust-angles');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      {visiblePositions.map(pos => (
        <LaunchAngleGizmo key={pos.id} position={pos} batchMode={isBatch} selectedIds={selectedIds} />
      ))}
      {isBatch && selectedPyroPositions.length > 1 && (
        <>
          <AngleFanArc positions={selectedPyroPositions} />
          <BatchAngleLabel positions={selectedPyroPositions} />
        </>
      )}
    </>
  );
}

/**
 * Training v2.1 — MiniMap.
 *
 * Top-down 2D HUD widget: stage rectangle + NPC dots + placed equipment.
 */

import { useMemo } from 'react';

interface Props {
  npcs: { id: string; position: [number, number, number]; color: string }[];
  placedItems: { snapPointId: string; position: [number, number, number] }[];
  pendingSnapPoints: { id: string; position: [number, number, number] }[];
  /** World half-extent shown (default 18 units). */
  worldHalf?: number;
}

const SIZE = 140;

export default function MiniMap({ npcs, placedItems, pendingSnapPoints, worldHalf = 18 }: Props) {
  const project = useMemo(
    () => (x: number, z: number) => {
      const u = ((x + worldHalf) / (2 * worldHalf)) * SIZE;
      const v = ((z + worldHalf) / (2 * worldHalf)) * SIZE;
      return [u, v] as const;
    },
    [worldHalf],
  );

  return (
    <div
      className="absolute bottom-3 left-3 z-30 rounded-md bg-black/80 backdrop-blur-md border border-white/10 shadow-lg"
      style={{ width: SIZE + 16, padding: 8 }}
    >
      <p className="text-[8px] uppercase tracking-widest font-mono text-white/50 mb-1">Mini-mapa</p>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="block">
        {/* Stage rectangle */}
        <rect x={SIZE * 0.18} y={SIZE * 0.32} width={SIZE * 0.64} height={SIZE * 0.36} fill="hsl(28 100% 50% / 0.08)" stroke="hsl(28 100% 50% / 0.5)" strokeWidth={1} />
        {/* Pending snap points */}
        {pendingSnapPoints.map((sp) => {
          const [u, v] = project(sp.position[0], sp.position[2]);
          return <circle key={sp.id} cx={u} cy={v} r={3.5} fill="none" stroke="hsl(45 100% 65%)" strokeWidth={1.2} strokeDasharray="2 1.5" />;
        })}
        {/* Placed equipment */}
        {placedItems.map((p) => {
          const [u, v] = project(p.position[0], p.position[2]);
          return <rect key={p.snapPointId} x={u - 2} y={v - 2} width={4} height={4} fill="hsl(160 80% 55%)" />;
        })}
        {/* NPCs */}
        {npcs.map((n) => {
          const [u, v] = project(n.position[0], n.position[2]);
          return <circle key={n.id} cx={u} cy={v} r={2.8} fill={n.color} />;
        })}
        {/* Player dot (origin) */}
        {(() => {
          const [u, v] = project(0, 0);
          return <circle cx={u} cy={v} r={3} fill="hsl(190 70% 58%)" stroke="white" strokeWidth={0.8} />;
        })()}
      </svg>
    </div>
  );
}

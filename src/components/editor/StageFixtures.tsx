/**
 * StageFixtures — Renders ProceduralFixture3D for all positions of type 'light'.
 * Reads positions from useProjectStore and maps them to 3D fixture models.
 */
import React, { useMemo } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import ProceduralFixture3D, { type FixtureType } from './ProceduralFixture3D';

/** Map position color hints to fixture types */
function inferFixtureType(name: string): FixtureType {
  const n = name.toLowerCase();
  if (n.includes('wash')) return 'wash';
  if (n.includes('beam')) return 'beam';
  if (n.includes('strobe') || n.includes('blinder')) return 'strobe';
  return 'spot';
}

export default function StageFixtures() {
  const positions = useProjectStore(s => s.positions);

  const fixtures = useMemo(() =>
    positions.filter(p => p.type === 'light'),
    [positions]
  );

  if (fixtures.length === 0) return null;

  return (
    <>
      {fixtures.map(pos => (
        <ProceduralFixture3D
          key={pos.id}
          position={[pos.x, pos.y, pos.z]}
          fixtureType={inferFixtureType(pos.name)}
          color={pos.color}
          animate
          showBeam
        />
      ))}
    </>
  );
}

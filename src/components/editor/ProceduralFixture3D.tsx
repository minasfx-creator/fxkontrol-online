/**
 * ProceduralFixture3D — Procedural 3D stage fixture model
 */
import React from 'react';

export type FixtureType = 'moving-head' | 'par' | 'strobe' | 'laser' | 'generic' | 'wash' | 'beam' | 'spot';

interface Props {
  position: [number, number, number];
  fixtureType: FixtureType;
  color?: string;
  intensity?: number;
  [key: string]: any;
}

export default function ProceduralFixture3D({ position, fixtureType, color, intensity = 1, ...rest }: Props) {
  const height = fixtureType === 'moving-head' ? 1.2 : fixtureType === 'par' ? 0.4 : 0.6;
  return (
    <group position={position} {...rest}>
      <mesh>
        <cylinderGeometry args={[0.15, 0.2, height, 8]} />
        <meshStandardMaterial
          color={color || '#888888'}
          emissive={color || '#444444'}
          emissiveIntensity={intensity * 0.3}
        />
      </mesh>
    </group>
  );
}

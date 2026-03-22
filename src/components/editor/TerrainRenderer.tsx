import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { TerrainData } from '@/lib/heightmapToTerrain';
import { useSceneStore } from '@/store/useSceneStore';
import { createTerrainMaterial } from '@/render_ultra/environment/terrainPBR';

export default function TerrainRenderer() {
  const terrain = useSceneStore(s => s.terrain);
  const terrainPreset = useSceneStore(s => s.terrainPreset);
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    if (!terrain) return null;
    const { config, heightmap, width: hmW } = terrain;
    const segments = Math.min(config.resolution, 256);
    const geo = new THREE.PlaneGeometry(config.width, config.depth, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const posAttr = geo.attributes.position;
    const cols = segments + 1;

    for (let i = 0; i < posAttr.count; i++) {
      const gx = i % cols;
      const gz = Math.floor(i / cols);
      const hmIdx = gz * cols + gx;
      const h = (heightmap[hmIdx] ?? 0) * config.maxHeight;
      posAttr.setY(i, h);
    }

    posAttr.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, [terrain]);

  // UE5.7 triplanar PBR material — preset-driven with animated wetness
  const material = useMemo(() => createTerrainMaterial(terrainPreset), [terrainPreset]);

  // Animate time uniform for puddle ripples and detail
  useFrame((_, delta) => {
    if (material && 'uniforms' in material) {
      (material as THREE.ShaderMaterial).uniforms.uTime.value += delta;
    }
  });

  if (!geometry || !terrain) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={[terrain.config.offsetX, 0, terrain.config.offsetZ]}
      receiveShadow
    />
  );
}

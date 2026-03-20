import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { TerrainData } from '@/lib/heightmapToTerrain';
import { useSceneStore } from '@/store/useSceneStore';

export default function TerrainRenderer() {
  const terrain = useSceneStore(s => s.terrain);
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    if (!terrain) return null;
    const { config, heightmap, width: hmW } = terrain;
    const segments = Math.min(config.resolution, 256);
    const geo = new THREE.PlaneGeometry(config.width, config.depth, segments, segments);
    geo.rotateX(-Math.PI / 2); // lay flat

    const posAttr = geo.attributes.position;
    const cols = segments + 1;

    for (let i = 0; i < posAttr.count; i++) {
      // PlaneGeometry after rotateX: x stays, y is up, z is depth
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

  if (!geometry || !terrain) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={[terrain.config.offsetX, 0, terrain.config.offsetZ]}
      receiveShadow
    >
      <meshStandardMaterial
        color="#2a3a2a"
        roughness={0.9}
        metalness={0.05}
        side={THREE.DoubleSide}
        wireframe={false}
      />
    </mesh>
  );
}

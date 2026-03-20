import React, { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneStore, type SiteModel } from '@/store/useSceneStore';

function LoadedModel({ model }: { model: SiteModel }) {
  const { scene } = useGLTF(model.url);

  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          mesh.material = (mesh.material as THREE.Material).clone();
        }
      }
    });
    return c;
  }, [scene]);

  if (!model.visible) return null;

  return (
    <primitive
      object={cloned}
      position={model.position}
      rotation={[0, model.rotation[1] * (Math.PI / 180), 0]}
      scale={[model.scale, model.scale, model.scale]}
    />
  );
}

export default function SiteModelRenderer() {
  const siteModels = useSceneStore((s) => s.siteModels);

  if (!siteModels || siteModels.length === 0) return null;

  return (
    <Suspense fallback={null}>
      {siteModels.map((model) => (
        <LoadedModel key={model.id} model={model} />
      ))}
    </Suspense>
  );
}

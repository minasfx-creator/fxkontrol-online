import React, { Suspense, useMemo, useRef, useCallback, useEffect, Component, type ReactNode } from 'react';
import { useGLTF, TransformControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore, type SiteModel } from '@/store/useSceneStore';

class ModelErrorBoundary extends Component<{ children: ReactNode; modelName: string }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: Error) { console.warn(`[SiteModel] Failed to load "${this.props.modelName}":`, err.message); }
  render() { return this.state.hasError ? null : this.props.children; }
}

function isValidModelUrl(url: string | undefined | null): url is string {
  if (!url || typeof url !== 'string' || url.trim() === '') return false;
  return url.startsWith('blob:') || url.startsWith('http') || url.startsWith('/');
}

function LoadedModel({ model, isSelected }: { model: SiteModel; isSelected: boolean }) {
  const { scene } = useGLTF(model.url);
  const groupRef = useRef<THREE.Group>(null!);
  const transformRef = useRef<any>(null);
  const { gl } = useThree();

  const selectSiteModel = useSceneStore((s) => s.selectSiteModel);
  const updateSiteModel = useSceneStore((s) => s.updateSiteModel);
  const transformMode = useSceneStore((s) => s.siteModelTransformMode);
  const transformSnap = useSceneStore((s) => s.transformSnap);

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

  const handleObjectChange = useCallback(() => {
    if (!groupRef.current) return;
    const pos = groupRef.current.position;
    const rot = groupRef.current.rotation;
    const scl = groupRef.current.scale;
    updateSiteModel(model.id, {
      position: [pos.x, pos.y, pos.z],
      rotation: [
        rot.x * (180 / Math.PI),
        rot.y * (180 / Math.PI),
        rot.z * (180 / Math.PI),
      ],
      scale: scl.x,
    });
  }, [model.id, updateSiteModel]);

  useEffect(() => {
    if (!isSelected || !transformRef.current) return;
    const controls = transformRef.current;
    const onDraggingChanged = (event: { value: boolean }) => {
      const orbitControls = (gl.domElement as any).__r3f_orbit_controls;
      if (orbitControls) orbitControls.enabled = !event.value;
    };
    controls.addEventListener('dragging-changed', onDraggingChanged);
    return () => controls.removeEventListener('dragging-changed', onDraggingChanged);
  }, [isSelected, gl]);

  if (!model.visible) return null;

  const handleClick = (e: any) => {
    e.stopPropagation();
    selectSiteModel(model.id);
  };

  return (
    <>
      <group
        ref={groupRef}
        position={model.position}
        rotation={[0, model.rotation[1] * (Math.PI / 180), 0]}
        scale={[model.scale, model.scale, model.scale]}
        onClick={handleClick}
        onPointerDown={handleClick}
      >
        <primitive object={cloned} />
      </group>
      {isSelected && groupRef.current && (
        <TransformControls
          ref={transformRef}
          object={groupRef.current}
          mode={transformMode}
          onObjectChange={handleObjectChange}
          size={0.8}
          translationSnap={transformSnap.enabled ? transformSnap.translateSnap : null}
          rotationSnap={transformSnap.enabled ? (transformSnap.rotateSnap * Math.PI) / 180 : null}
          scaleSnap={transformSnap.enabled ? transformSnap.scaleSnap : null}
        />
      )}
    </>
  );
}

export default function SiteModelRenderer() {
  const siteModels = useSceneStore((s) => s.siteModels);
  const selectedId = useSceneStore((s) => s.selectedSiteModelId);

  if (!siteModels || siteModels.length === 0) return null;

  return (
    <Suspense fallback={null}>
      {siteModels.filter((m) => isValidModelUrl(m.url)).map((model) => (
        <ModelErrorBoundary key={model.id} modelName={model.name}>
          <LoadedModel model={model} isSelected={model.id === selectedId} />
        </ModelErrorBoundary>
      ))}
    </Suspense>
  );
}

import { Suspense, useMemo, useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Center, useGLTF } from '@react-three/drei';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { useLoader } from '@react-three/fiber';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { RotateCcw, Maximize2 } from 'lucide-react';
import * as THREE from 'three';

function GLTFModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene.clone()} />;
}

function FBXModel({ url }: { url: string }) {
  const fbx = useLoader(FBXLoader, url);
  return <primitive object={fbx.clone()} />;
}

function OBJModel({ url }: { url: string }) {
  const obj = useLoader(OBJLoader, url);
  return <primitive object={obj.clone()} />;
}

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="hsl(var(--primary))" wireframe />
    </mesh>
  );
}

function ModelScene({
  url, ext, scale, rotationY,
}: { url: string; ext: string; scale: number; rotationY: number }) {
  const groupRef = useRef<THREE.Group>(null);

  return (
    <Center>
      <group ref={groupRef} scale={scale} rotation={[0, rotationY * Math.PI / 180, 0]}>
        <Suspense fallback={<LoadingFallback />}>
          {(ext === 'gltf' || ext === 'glb') && <GLTFModel url={url} />}
          {ext === 'fbx' && <FBXModel url={url} />}
          {ext === 'obj' && <OBJModel url={url} />}
        </Suspense>
      </group>
    </Center>
  );
}

export interface ModelTransform {
  scale: number;
  rotationY: number;
}

interface Model3DPreviewProps {
  file: File;
  transform?: ModelTransform;
  onTransformChange?: (t: ModelTransform) => void;
}

export default function Model3DPreview({ file, transform, onTransformChange }: Model3DPreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const ext = useMemo(() => file.name.split('.').pop()?.toLowerCase() || '', [file]);

  const scale = transform?.scale ?? 1;
  const rotationY = transform?.rotationY ?? 0;

  const setScale = (v: number) => onTransformChange?.({ scale: v, rotationY });
  const setRotationY = (v: number) => onTransformChange?.({ scale, rotationY: v });
  const resetTransform = () => onTransformChange?.({ scale: 1, rotationY: 0 });

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const isRenderable = ['fbx', 'obj', 'gltf', 'glb'].includes(ext);

  if (!isRenderable || !objectUrl) {
    return (
      <div className="w-full h-[200px] rounded-lg bg-muted/20 border border-border/20 flex items-center justify-center">
        <p className="text-[10px] text-muted-foreground/60">
          Preview indisponível para .{ext} — formato de referência
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="w-full h-[200px] rounded-lg bg-muted/10 border border-border/20 overflow-hidden relative">
        <Canvas
          camera={{ position: [3, 2, 3], fov: 45 }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: 'transparent' }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={1} />
          <ModelScene url={objectUrl} ext={ext} scale={scale} rotationY={rotationY} />
          <Environment preset="city" />
          <OrbitControls enableZoom enablePan={false} />
        </Canvas>
        <div className="absolute bottom-1.5 right-2 text-[9px] text-muted-foreground/40 font-mono uppercase">
          {ext} preview
        </div>
      </div>

      {/* Transform controls */}
      <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/20 border border-border/20">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
              <Maximize2 className="w-3 h-3" /> Escala
            </span>
            <span className="text-[10px] font-mono text-primary">{scale.toFixed(2)}×</span>
          </div>
          <Slider
            value={[scale * 100]}
            onValueChange={([v]) => setScale(v / 100)}
            min={5} max={500} step={5}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
              <RotateCcw className="w-3 h-3" /> Rotação Y
            </span>
            <span className="text-[10px] font-mono text-primary">{rotationY}°</span>
          </div>
          <Slider
            value={[rotationY]}
            onValueChange={([v]) => setRotationY(v)}
            min={0} max={360} step={5}
          />
        </div>
        <Button variant="ghost" size="sm" className="col-span-2 h-6 text-[10px]" onClick={resetTransform}>
          <RotateCcw className="w-3 h-3 mr-1" /> Reset Transformações
        </Button>
      </div>
    </div>
  );
}

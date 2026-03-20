import { Suspense, useMemo, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Center, useGLTF } from '@react-three/drei';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { useLoader } from '@react-three/fiber';
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

function AutoScaleWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Center>
      {children}
    </Center>
  );
}

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="hsl(var(--primary))" wireframe />
    </mesh>
  );
}

interface Model3DPreviewProps {
  file: File;
}

export default function Model3DPreview({ file }: Model3DPreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const ext = useMemo(() => file.name.split('.').pop()?.toLowerCase() || '', [file]);

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
    <div className="w-full h-[200px] rounded-lg bg-muted/10 border border-border/20 overflow-hidden relative">
      <Canvas
        camera={{ position: [3, 2, 3], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <Suspense fallback={<LoadingFallback />}>
          <AutoScaleWrapper>
            {(ext === 'gltf' || ext === 'glb') && <GLTFModel url={objectUrl} />}
            {ext === 'fbx' && <FBXModel url={objectUrl} />}
            {ext === 'obj' && <OBJModel url={objectUrl} />}
          </AutoScaleWrapper>
          <Environment preset="city" />
        </Suspense>
        <OrbitControls autoRotate autoRotateSpeed={2} enableZoom enablePan={false} />
      </Canvas>
      <div className="absolute bottom-1.5 right-2 text-[9px] text-muted-foreground/40 font-mono uppercase">
        {ext} preview
      </div>
    </div>
  );
}

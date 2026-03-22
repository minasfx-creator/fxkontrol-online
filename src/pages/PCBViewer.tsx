/**
 * FXK-M1 Interactive PCB Viewer — Full page with 3D board
 */
import { Suspense, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { ArrowLeft, RotateCcw, Layers, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import PCBBoard from '@/components/pcb-viewer/PCBBoard';
import PCBInfoPanel from '@/components/pcb-viewer/PCBInfoPanel';

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[0.5, 0.02, 0.3]} />
      <meshStandardMaterial color="#1a472a" wireframe />
    </mesh>
  );
}

export default function PCBViewer() {
  const navigate = useNavigate();
  const [selectedComponent, setSelectedComponent] = useState<{ ref: string; label: string; desc: string } | null>(null);
  const [showTraces, setShowTraces] = useState(true);

  const handleSelectComponent = useCallback((info: { ref: string; label: string; desc: string } | null) => {
    setSelectedComponent(info);
  }, []);

  return (
    <div className="h-full w-full bg-background relative overflow-hidden" style={{ minHeight: 'calc(100vh - 5rem)' }}>
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3 bg-gradient-to-b from-background/90 to-transparent">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
          <div className="h-5 w-px bg-border/30" />
          <div>
            <h1 className="text-sm font-bold text-foreground tracking-wide">FXK-M1 PCB Viewer</h1>
            <p className="text-[10px] text-muted-foreground font-mono">180×120mm · 2-Layer FR4 · Rev.1</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant={showTraces ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setShowTraces(!showTraces)}
            className="gap-1.5 text-xs"
          >
            <Layers className="w-3.5 h-3.5" />
            Traces
          </Button>
        </div>
      </div>

      {/* 3D Canvas */}
      <Canvas shadows gl={{ antialias: true, alpha: false }} style={{ background: '#0a0c10' }}>
        <PerspectiveCamera makeDefault position={[0.8, 0.8, 0.8]} fov={40} />
        <color attach="background" args={['#0a0c10']} />
        <fog attach="fog" args={['#0a0c10', 3, 6]} />

        <ambientLight intensity={0.3} />
        <directionalLight position={[2, 4, 2]} intensity={1.2} castShadow shadow-mapSize={1024} />
        <directionalLight position={[-2, 3, -1]} intensity={0.4} color="#4488ff" />
        <pointLight position={[0, 0.3, 0]} intensity={0.2} color="#00ff88" />

        <Suspense fallback={<LoadingFallback />}>
          <PCBBoard onSelectComponent={handleSelectComponent} />
          <ContactShadows position={[0, -0.02, 0]} opacity={0.4} scale={3} blur={2} far={1} />
        </Suspense>

        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          minDistance={0.3}
          maxDistance={3}
          minPolarAngle={0.1}
          maxPolarAngle={Math.PI / 2 - 0.05}
          target={[0, 0, 0]}
        />

        <EffectComposer>
          <Bloom intensity={0.3} luminanceThreshold={0.8} luminanceSmoothing={0.5} />
        </EffectComposer>
      </Canvas>

      {/* Info Panel */}
      <PCBInfoPanel info={selectedComponent} onClose={() => setSelectedComponent(null)} />

      {/* Legend */}
      <div className="absolute top-16 right-3 bg-card/80 backdrop-blur-md border border-border/20 rounded-lg p-3 space-y-1.5">
        <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Legenda</p>
        {[
          ['#1a472a', 'PCB FR4'],
          ['#c87533', 'Copper Trace'],
          ['#1a1a1a', 'IC Package'],
          ['#a0a0a0', 'Metal/Connector'],
          ['#2d8a4e', 'Terminal Block'],
          ['#cc3333', 'Power Rail'],
          ['#ff2222', 'E-STOP'],
        ].map(([color, label]) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-[9px] font-mono text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-4 right-4 text-[9px] font-mono text-muted-foreground/50 space-y-0.5 text-right">
        <p>🖱️ Arrastar — Orbitar</p>
        <p>⚙️ Scroll — Zoom</p>
        <p>🖱️ Direito — Pan</p>
      </div>
    </div>
  );
}

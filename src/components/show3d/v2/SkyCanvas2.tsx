/**
 * SkyCanvas 2.0 — Public viewport.
 *
 * Composição:
 *   <SkyCanvas2ErrorBoundary>
 *     <Canvas>
 *       <WebGLContextRecovery />     ← pausa frames se GPU cair
 *       <AdaptiveDPRController />    ← FPS<35 baixa, FPS>110 sobe
 *       <NightSky /> <GroundPlane />
 *       <PyroPadsLayer />            ← InstancedMesh: 1 draw call
 *       <LightPointsLayer />         ← Points: 1 draw call
 *       <ExplosionsLayer />          ← Pool 256 bursts: 1 draw call
 *       {showPerfHud && <PerfHUDProbe />}
 *     </Canvas>
 *     {showPerfHud && <PerfHUDOverlay />}
 *   </SkyCanvas2ErrorBoundary>
 *
 * Princípios:
 *   - Presentation-only. Lê apenas useProjectStore.
 *   - Cada layer é um arquivo isolado, com seu próprio selector.
 *   - Nada de side effects fora do canvas; nada de hardware.
 *   - À prova de quedas: ErrorBoundary + context-loss recovery.
 */
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Suspense, useRef, useState, useCallback } from 'react';
import { NightSky, GroundPlane } from './Environment';
import { LightPointsLayer } from './LightPointsLayer';
import { PyroPadsLayer } from './PyroPadsLayer';
import { ExplosionsLayer } from './ExplosionsLayer';
import { StageLayer } from './StageLayer';
import { FixturesLayer } from './FixturesLayer';
import { SkyCanvas2ErrorBoundary } from './SkyCanvas2ErrorBoundary';
import { WebGLContextRecovery } from './WebGLContextRecovery';
import { AdaptiveDPRController } from './AdaptiveDPRController';
import { PerfHUDProbe, PerfHUDOverlay } from './PerfHUD';
import { isSkycanvasV2StageEnabled, isEnabled } from '@/lib/featureFlags';
import { detectSkyCapability } from '@/lib/skycanvasCapability';
import type { SkyCanvas2Props } from './types';

// Detect once per session — pure read, no side effects.
const _CAP = (() => { try { return detectSkyCapability(); } catch { return null; } })();

interface SkyCanvas2ExtraProps {
  /** Show FPS/draw/triangles overlay. Default false. */
  showPerfHud?: boolean;
  /** Called once if the boundary trips (lets parent fall back to legacy). */
  onFatalError?: (err: Error) => void;
}

export default function SkyCanvas2({
  dpr = [1, 1.75],
  cameraPosition = [60, 35, 60],
  cameraTarget = [0, 10, 0],
  hideGrid = false,
  hideStars = false,
  hideStage = false,
  stageVariant = 'arch',
  showFixtures,
  className,
  showPerfHud = false,
  onFatalError,
}: SkyCanvas2Props & SkyCanvas2ExtraProps) {
  // Auto-tier: low-end hosts (SwiftShader, coarse pointer + small viewport,
  // saveData) get a lighter scene unless caller explicitly overrode.
  // Caller's explicit `false` for hide flags is preserved (no force).
  const lowTier = _CAP?.tier === 'low';
  const effHideStars = hideStars || (lowTier && _CAP?.software === true);
  const effStageVariant: 'arch' | 'minimal' = lowTier && stageVariant === 'arch' ? 'minimal' : stageVariant;
  const [contextLost, setContextLost] = useState(false);
  const [minDpr, maxDpr] = Array.isArray(dpr) ? dpr : [dpr, dpr];
  // Mobile high-DPI (>2.5) starts at minDpr to avoid first-frame jank;
  // AdaptiveDPRController will probe and raise as headroom allows.
  const initialDpr = (typeof window !== 'undefined' && window.devicePixelRatio > 2.5)
    ? minDpr : maxDpr;
  const dprRef = useRef<number>(initialDpr);
  const stageEnabled = !hideStage && isSkycanvasV2StageEnabled();
  const fixturesEnabled = showFixtures ?? isEnabled('ue5_fixtures_layer');

  const handleDpr = useCallback((v: number) => { dprRef.current = v; }, []);

  return (
    <SkyCanvas2ErrorBoundary onError={(e) => onFatalError?.(e)}>
      <div className={className} style={{ position: 'absolute', inset: 0 }}>
        <Canvas
          dpr={dpr}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
            // failIfMajorPerformanceCaveat=false → don't refuse a SW renderer
            // on older laptops; we'd rather show something than blank.
            failIfMajorPerformanceCaveat: false,
            preserveDrawingBuffer: false,
          }}
          shadows={false}
          frameloop={contextLost ? 'never' : 'always'}
        >
          <PerspectiveCamera
            makeDefault
            position={cameraPosition}
            fov={55}
            near={0.5}
            far={2000}
          />
          <OrbitControls
            target={cameraTarget}
            enableDamping
            dampingFactor={0.08}
            maxPolarAngle={Math.PI * 0.495}
            minDistance={5}
            maxDistance={500}
          />
          <WebGLContextRecovery onChange={setContextLost} />
          <AdaptiveDPRController minDpr={minDpr} maxDpr={maxDpr} onChange={handleDpr} />
          <Suspense fallback={null}>
            <NightSky stars={!hideStars} />
            <GroundPlane grid={!hideGrid} />
            {stageEnabled && <StageLayer variant={stageVariant} />}
            {fixturesEnabled && <FixturesLayer />}
            {!contextLost && (
              <>
                <PyroPadsLayer />
                <LightPointsLayer />
                <ExplosionsLayer />
              </>
            )}
            {showPerfHud && <PerfHUDProbe dprRef={dprRef} />}
          </Suspense>
        </Canvas>
        {contextLost && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(5,8,16,0.78)',
              color: '#7dd3fc',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 13,
              pointerEvents: 'none',
            }}
          >
            GPU recuperando… (context lost)
          </div>
        )}
        {showPerfHud && <PerfHUDOverlay />}
      </div>
    </SkyCanvas2ErrorBoundary>
  );
}

export type { SkyCanvas2Props };

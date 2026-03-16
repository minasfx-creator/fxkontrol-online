import { useRef, useState, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useSceneStore } from '@/store/useSceneStore';
import { calculateLOD, type LODFactors } from '@/hooks/useLOD';
import * as THREE from 'three';

/**
 * RenderDebugOverlay — shows real-time render telemetry in the 3D viewport.
 * Visible only when toggled via the debug button. Renders inside R3F as Html overlay.
 *
 * Displays: LOD tier, adaptive exposure, HDR multiplier, FPS, draw calls, triangles.
 */

// External module-level var imported from SkyCanvas
declare const _adaptiveExposure: number;

export function RenderDebugHUD({ adaptiveExposure }: { adaptiveExposure: number }) {
  const { gl, camera, scene } = useThree();
  const statsRef = useRef({
    fps: 0,
    frameCount: 0,
    lastTime: performance.now(),
    drawCalls: 0,
    triangles: 0,
    lodTier: 'high' as LODFactors['tier'],
    lodDistance: 0,
  });

  useFrame(() => {
    const now = performance.now();
    const s = statsRef.current;
    s.frameCount++;

    if (now - s.lastTime >= 500) {
      s.fps = Math.round((s.frameCount * 1000) / (now - s.lastTime));
      s.frameCount = 0;
      s.lastTime = now;
    }

    // Renderer info
    const info = gl.info;
    s.drawCalls = info.render.calls;
    s.triangles = info.render.triangles;

    // LOD from camera to origin (scene center)
    const origin = new THREE.Vector3(0, 100, 0);
    const lod = calculateLOD(camera.position, origin);
    s.lodTier = lod.tier;
    s.lodDistance = Math.round(camera.position.distanceTo(origin));
  });

  const s = statsRef.current;
  const sceneSettings = useSceneStore(st => st.settings);

  const tierColors: Record<string, string> = {
    ultra: 'hsl(142, 76%, 50%)',
    high: 'hsl(207, 90%, 60%)',
    medium: 'hsl(45, 95%, 55%)',
    low: 'hsl(0, 80%, 55%)',
  };

  return (
    <Html
      position={[0, 0, 0]}
      style={{
        position: 'fixed',
        top: '8px',
        left: '8px',
        pointerEvents: 'none',
        zIndex: 50,
      }}
      wrapperClass="render-debug-overlay"
      calculatePosition={() => [8, 8, 0]}
    >
      <div
        style={{
          background: 'hsla(220, 20%, 8%, 0.88)',
          border: '1px solid hsla(220, 20%, 25%, 0.5)',
          borderRadius: '6px',
          padding: '8px 10px',
          fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
          fontSize: '10px',
          lineHeight: '1.6',
          color: 'hsla(0, 0%, 85%, 0.9)',
          minWidth: '185px',
          backdropFilter: 'blur(8px)',
          userSelect: 'none',
        }}
      >
        <div style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em', color: 'hsla(207, 80%, 65%, 0.8)', marginBottom: '4px' }}>
          RENDER DEBUG
        </div>

        <Row label="FPS" value={`${s.fps}`} color={s.fps >= 50 ? 'hsl(142, 76%, 50%)' : s.fps >= 30 ? 'hsl(45, 95%, 55%)' : 'hsl(0, 80%, 55%)'} />
        <Row label="Draw Calls" value={`${s.drawCalls}`} />
        <Row label="Triangles" value={s.triangles > 1000 ? `${(s.triangles / 1000).toFixed(1)}K` : `${s.triangles}`} />

        <Separator />

        <Row label="LOD Tier" value={s.lodTier.toUpperCase()} color={tierColors[s.lodTier]} />
        <Row label="Cam Dist" value={`${s.lodDistance}m`} />

        <Separator />

        <Row label="Exposure" value={adaptiveExposure.toFixed(2)} color={adaptiveExposure < 0.8 ? 'hsl(0, 80%, 55%)' : 'hsl(142, 76%, 50%)'} />
        <Row label="HDR Mult" value={`${sceneSettings.hdrMultiplier.toFixed(1)}×`} color="hsl(45, 95%, 60%)" />
        <Row label="Brightness" value={`${sceneSettings.effectBrightness.toFixed(1)}×`} />
        <Row label="Bloom" value={`${sceneSettings.bloomStrength.toFixed(1)}×`} />
        <Row label="Particles" value={`${sceneSettings.particleDensity.toFixed(1)}×`} />

        <Separator />

        <Row label="Tone Map" value="ACES (Post)" color="hsl(280, 60%, 65%)" />
        <Row label="Renderer" value="NoToneMap" color="hsl(280, 60%, 65%)" />
      </div>
    </Html>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <span style={{ color: 'hsla(0, 0%, 60%, 0.8)' }}>{label}</span>
      <span style={{ color: color || 'hsla(0, 0%, 90%, 0.9)', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function Separator() {
  return <div style={{ height: '1px', background: 'hsla(220, 20%, 25%, 0.4)', margin: '3px 0' }} />;
}

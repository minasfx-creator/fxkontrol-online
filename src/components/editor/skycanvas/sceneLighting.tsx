/**
 * Scene lighting helpers extracted from SkyCanvas.tsx.
 *
 * - SceneLighting: HDR moon rig + backfill directional lights.
 * - GeoTimeOfDaySync: applies showtime hour from project timezone offset.
 * - GoogleEarthLighting: extra hemisphere/ambient/sun for Google 3D Tiles.
 * - SkyGradientFallback: placeholder for EnvironmentV2Switcher.
 * - SHADOW_MAP_SIZES: shared shadow-map quality lookup.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Stars, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { useProjectStore } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import { createHDRLightingRig } from '@/render_ultra/lighting/hdrLighting';

export const SHADOW_MAP_SIZES: Record<string, number> = {
  low: 1024, medium: 2048, high: 4096, ultra: 8192,
};

export function SkyGradientFallback() {
  return null;
}

export function SceneLighting() {
  const { scene } = useThree();
  const s = useSceneStore(st => st.settings);
  const shadowSize = SHADOW_MAP_SIZES[s.shadowQuality] || 4096;
  const rigRef = useRef<ReturnType<typeof createHDRLightingRig> | null>(null);

  useEffect(() => {
    const rig = createHDRLightingRig({
      moonIntensity: s.moonIntensity,
      moonColor: new THREE.Color(s.moonColor),
      ambientIntensity: s.ambientIntensity,
      ambientColor: new THREE.Color(0.29, 0.38, 0.5),
      fillIntensity: 0.35,
      rimIntensity: 0.55,
    });
    rigRef.current = rig;

    rig.moon.shadow.mapSize.set(shadowSize, shadowSize);
    rig.moon.castShadow = s.shadowsEnabled;
    rig.moon.shadow.bias = -0.00003;
    rig.moon.shadow.normalBias = 0.02;
    rig.moon.shadow.camera.far = 25000;

    scene.add(rig.group);

    (window as unknown as { __hdrLightingRig?: unknown }).__hdrLightingRig = rig;

    return () => {
      scene.remove(rig.group);
      delete (window as unknown as { __hdrLightingRig?: unknown }).__hdrLightingRig;
    };
  }, [scene]);

  useEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    rig.updateMoonIntensity(s.moonIntensity);
    rig.updateAmbient(s.ambientIntensity);
    rig.moon.color.set(s.moonColor);
    rig.moon.castShadow = s.shadowsEnabled;
    rig.moon.shadow.mapSize.set(shadowSize, shadowSize);
  }, [s.moonIntensity, s.ambientIntensity, s.moonColor, s.shadowsEnabled, shadowSize]);

  return (
    <>
      <directionalLight position={[-60, 25, 70]} intensity={s.rimLightIntensity * 0.15} color="#3355aa" />
      <directionalLight position={[0, -8, 40]} intensity={s.fillLightIntensity * 0.08} color="#182218" />
    </>
  );
}

export function GeoTimeOfDaySync() {
  const timeZoneOffset = useProjectStore(s => s.timeZoneOffset);
  const updateSettings = useSceneStore(s => s.updateSettings);
  const appliedRef = useRef(false);

  useEffect(() => {
    if (timeZoneOffset == null || appliedRef.current) return;
    appliedRef.current = true;

    const showHourLocal = 20;

    updateSettings({
      timeOfDay: showHourLocal,
      timeOfDayEnabled: true,
    });

    console.log(`[GeoSync] TimeOfDay set to ${showHourLocal}h (TZ offset: ${timeZoneOffset}s)`);
  }, [timeZoneOffset, updateSettings]);

  return null;
}

export function GoogleEarthLighting() {
  const google3DTilesEnabled = useSceneStore(st => st.settings.google3DTilesEnabled);
  const timeOfDay = useSceneStore(st => st.settings.timeOfDay);

  const sunPos = useMemo(() => {
    const angle = ((timeOfDay - 6) / 12) * Math.PI;
    const y = Math.sin(angle) * 100;
    const x = Math.cos(angle) * 100;
    return [x, Math.max(y, -20), 50] as [number, number, number];
  }, [timeOfDay]);

  const isNight = timeOfDay >= 20 || timeOfDay <= 5;

  if (!google3DTilesEnabled) return null;

  return (
    <>
      {isNight && <color attach="background" args={['#0a0e1a']} />}
      {isNight && <Stars radius={80000} depth={30000} count={8000} factor={5} saturation={0.15} fade speed={0.02} />}
      {!isNight && <Sky sunPosition={sunPos} turbidity={8} rayleigh={2} mieCoefficient={0.005} mieDirectionalG={0.8} />}
      <hemisphereLight args={[0x87ceeb, 0x362d1f, isNight ? 0.08 : 0.4]} />
      <ambientLight intensity={isNight ? 0.15 : 0.3} color={isNight ? '#1a2b4c' : '#ffffff'} />
      {!isNight && (
        <directionalLight
          position={sunPos}
          intensity={0.6}
          color={0xffeedd}
          castShadow={false}
        />
      )}
      {isNight && (
        <directionalLight
          position={[30, 60, -40]}
          intensity={0.08}
          color={0x8899bb}
          castShadow={false}
        />
      )}
    </>
  );
}

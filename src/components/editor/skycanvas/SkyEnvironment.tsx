/**
 * SkyEnvironment — Sky atmosphere, volumetric clouds, water, decals,
 * time-of-day, scene stars, and fog.
 * Extracted from SkyCanvas for modularity.
 */
import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneStore } from '@/store/useSceneStore';
import {
  createSkyAtmosphereV2,
  createVolumetricCloudLayer,
  createWaterSystem, WATER_PRESETS,
  evaluateTimeOfDay,
  createDecalSystem, updateDecals, clearDecals,
} from '@/render_ultra';

// ── Sky Atmosphere V2 ──
export function SkyAtmosphereV2Layer() {
  const meshRef = useRef<THREE.Mesh | null>(null);
  const skySystemRef = useRef<ReturnType<typeof createSkyAtmosphereV2> | null>(null);
  const { scene } = useThree();
  const timeOfDay = useSceneStore(st => st.settings.timeOfDay);
  const timeOfDayEnabled = useSceneStore(st => st.settings.timeOfDayEnabled);

  useEffect(() => {
    const system = createSkyAtmosphereV2(90000);
    skySystemRef.current = system;
    scene.add(system.mesh);
    return () => {
      scene.remove(system.mesh);
      system.mesh.geometry.dispose();
      (system.mesh.material as THREE.ShaderMaterial).dispose();
    };
  }, [scene]);

  useFrame(({ camera }) => {
    const sys = skySystemRef.current;
    if (!sys) return;
    sys.mesh.position.copy(camera.position);

    if (timeOfDayEnabled) {
      const tod = evaluateTimeOfDay(timeOfDay);
      sys.setSunDirection(tod.sunDirection);
      sys.setSunIntensity(tod.sunIntensity);
      sys.setMoonDirection(tod.moonDirection);
      sys.setStarBrightness(tod.starBrightness);
      sys.setTimeOfDay(tod.skyZenith, tod.skyHorizon, tod.skyNight);
    }
  });

  return null;
}

// ── Volumetric Clouds ──
export function VolumetricCloudLayer() {
  const cloudRef = useRef<ReturnType<typeof createVolumetricCloudLayer> | null>(null);
  const { scene } = useThree();
  const cloudCoverage = useSceneStore(st => st.settings.cloudCoverage);
  const cloudDensity = useSceneStore(st => st.settings.cloudDensity);
  const cloudWindSpeed = useSceneStore(st => st.settings.cloudWindSpeed);

  useEffect(() => {
    const cloud = createVolumetricCloudLayer({
      coverage: cloudCoverage,
      density: cloudDensity,
      windSpeed: cloudWindSpeed,
    });
    cloudRef.current = cloud;
    scene.add(cloud.mesh);
    (window as any).__volumetricCloudSystem = cloud;

    return () => {
      scene.remove(cloud.mesh);
      cloud.mesh.geometry.dispose();
      (cloud.mesh.material as THREE.ShaderMaterial).dispose();
      delete (window as any).__volumetricCloudSystem;
    };
  }, [scene]);

  useEffect(() => {
    const c = cloudRef.current;
    if (!c) return;
    c.setCoverage(cloudCoverage);
    c.setDensity(cloudDensity);
    c.setWindSpeed(cloudWindSpeed);
  }, [cloudCoverage, cloudDensity, cloudWindSpeed]);

  useFrame(({ clock }) => {
    cloudRef.current?.update(clock.getElapsedTime());
  });

  return null;
}

// ── Water ──
export function WaterLayer() {
  const waterRef = useRef<ReturnType<typeof createWaterSystem> | null>(null);
  const { scene } = useThree();
  const waterLevel = useSceneStore(st => st.settings.waterLevel);
  const waterPreset = useSceneStore(st => st.settings.waterPreset);
  const tideOffset = useSceneStore(st => st.settings.tideOffset);

  useEffect(() => {
    const presetCfg = WATER_PRESETS[waterPreset] || {};
    const water = createWaterSystem(presetCfg);
    waterRef.current = water;
    water.mesh.position.y = waterLevel + tideOffset;
    // Stencil write for water masking (prevents sea inside islands)
    const mat = water.mesh.material as THREE.ShaderMaterial;
    mat.stencilWrite = true;
    mat.stencilRef = 1;
    mat.stencilFunc = THREE.AlwaysStencilFunc;
    mat.stencilZPass = THREE.ReplaceStencilOp;
    scene.add(water.mesh);
    return () => {
      scene.remove(water.mesh);
      water.mesh.geometry.dispose();
      mat.dispose();
    };
  }, [scene, waterPreset]);

  useEffect(() => {
    if (waterRef.current) waterRef.current.mesh.position.y = waterLevel + tideOffset;
  }, [waterLevel, tideOffset]);

  useFrame(({ clock }) => {
    waterRef.current?.update(clock.getElapsedTime());
  });

  return null;
}

// ── Ground Decals ──
export function GroundDecalManager() {
  const { scene } = useThree();

  useEffect(() => {
    const group = createDecalSystem();
    scene.add(group);
    return () => {
      scene.remove(group);
      clearDecals();
    };
  }, [scene]);

  useFrame(({ clock }) => {
    updateDecals(clock.getDelta());
  });

  return null;
}

// ── Time of Day Controller ──
export function TimeOfDayController() {
  const timeOfDay = useSceneStore(st => st.settings.timeOfDay);
  const { scene } = useThree();

  useFrame(() => {
    const tod = evaluateTimeOfDay(timeOfDay);
    if (scene.fog && scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.copy(tod.fogColor);
    }
    scene.traverse(obj => {
      if (obj instanceof THREE.AmbientLight) {
        obj.color.copy(tod.ambientColor);
        obj.intensity = tod.ambientIntensity * 2;
      }
    });
  });

  return null;
}

// ── Scene Fog ──
export function SceneFog() {
  const s = useSceneStore(st => st.settings);
  if (s.fogDensity <= 0) return null;
  return <fog attach="fog" args={[s.fogColor, s.fogNear, s.fogFar / Math.max(s.fogDensity, 0.1)]} />;
}

// ── Scene Stars ──
export function SceneStars() {
  const density = useSceneStore(st => st.settings.starDensity);
  if (density <= 0.05) return null;
  return <Stars radius={100000} depth={40000} count={Math.round(15000 * density)} factor={6} saturation={0.2} fade speed={0.03} />;
}

export function SceneStarsWired() {
  const density = useSceneStore(st => st.settings.starDensity);
  const lowQ = useSceneStore(st => st.environment.lowQualityMode);
  if (density <= 0.05) return null;
  const mult = lowQ ? 0.5 : 1.0;
  return <Stars radius={100000} depth={40000} count={Math.round(15000 * density * mult)} factor={6 * mult} saturation={0.2} fade speed={0.03} />;
}

/**
 * EnvironmentV2Switcher — renders sky engine + optional cloud/water/decal/ToD layers.
 * Needs SkyGradient passed as prop since it lives in SkyCanvas still (large shader component).
 */
export function EnvironmentV2Switcher({ SkyGradientComponent }: { SkyGradientComponent: React.ComponentType }) {
  const skyEngineV2 = useSceneStore(st => st.settings.skyEngineV2);
  const cloudCoverage = useSceneStore(st => st.settings.cloudCoverage);
  const waterEnabled = useSceneStore(st => st.settings.waterEnabled);
  const decalsEnabled = useSceneStore(st => st.settings.decalsEnabled);
  const timeOfDayEnabled = useSceneStore(st => st.settings.timeOfDayEnabled);

  return (
    <>
      {skyEngineV2 ? <SkyAtmosphereV2Layer /> : <SkyGradientComponent />}
      {cloudCoverage > 0.05 && <VolumetricCloudLayer />}
      {waterEnabled && <WaterLayer />}
      {decalsEnabled && <GroundDecalManager />}
      {timeOfDayEnabled && <TimeOfDayController />}
    </>
  );
}

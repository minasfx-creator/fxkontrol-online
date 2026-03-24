/**
 * useFXKUltraRefinement — React hook bridging the CJS FXK Ultra Refinement
 * engine into the R3F render loop for real-time adaptive quality and stability.
 *
 * Runs inside the Canvas context via useFrame. Does NOT touch the deterministic
 * clock/lockstep/executionBridge pipeline.
 */

import { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useSceneStore } from '@/store/useSceneStore';
import { pushLog } from '@/components/editor/ViewportTerminal';

// ═══ Quality tiers mapped to scene store settings ═══
type FXKQualityLevel = 'cinematic' | 'high' | 'balanced' | 'performance' | 'safe';

interface FXKFrameResult {
  qualityLevel: FXKQualityLevel;
  effectBudget: {
    bloom: boolean;
    volumetricFog: boolean;
    heavyShaders: boolean;
    particlesHighQuality: boolean;
  };
  stabilityAction: string;
  graphicsApi: string;
}

// Inline adaptive quality logic (mirrors performance_system.cjs without require())
const QUALITY_LEVELS: FXKQualityLevel[] = ['cinematic', 'high', 'balanced', 'performance', 'safe'];

const DEFAULT_THRESHOLDS = {
  fpsSoftFloor: 50,
  fpsHardFloor: 40,
  gpuFrameSoftMs: 18,
  gpuFrameHardMs: 24,
  maxVramMb: 1024,
  maxDrawCalls: 1500,
};

// Stability constants (mirrors render_stability.cjs)
const QUALITY_PROFILES = ['ultra', 'high', 'medium', 'low', 'safe'] as const;
const GRAPHICS_APIS = ['webgpu', 'webgl2', 'static_preview'] as const;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function useFXKUltraRefinement() {
  const { gl } = useThree();
  const frameCounter = useRef(0);
  const lastResultRef = useRef<FXKFrameResult>({
    qualityLevel: 'high',
    effectBudget: { bloom: true, volumetricFog: true, heavyShaders: true, particlesHighQuality: true },
    stabilityAction: 'none',
    graphicsApi: 'webgl2',
  });

  // ═══ Adaptive Quality State ═══
  const qualityIndexRef = useRef(1); // starts at 'high'
  const effectBudgetRef = useRef({
    bloom: true,
    volumetricFog: true,
    heavyShaders: true,
    particlesHighQuality: true,
  });

  // ═══ Render Stability State ═══
  const stabilityQualityRef = useRef(1); // 'high'
  const stabilityApiRef = useRef(1); // webgl2 (webgpu not available in most browsers)
  const overBudgetStreakRef = useRef(0);
  const crashTimestampsRef = useRef<number[]>([]);
  const hardFailUntilRef = useRef(0);

  const OVER_BUDGET_THRESHOLD = 90; // frames before degrade (~1.5s at 60fps)
  const MAX_RESTARTS = 2;
  const RESTART_WINDOW_MS = 60_000;
  const HARD_FAIL_COOLDOWN_MS = 30_000;

  // Track last quality change for hysteresis (prevent flip-flopping)
  const lastQualityChangeRef = useRef(0);
  const QUALITY_CHANGE_COOLDOWN_MS = 3000;

  // Wire into scene store for lowQualityMode
  const applyQualityToScene = useCallback((level: FXKQualityLevel, budget: typeof effectBudgetRef.current) => {
    const store = useSceneStore.getState();
    const shouldBeLowQ = level === 'performance' || level === 'safe';

    if (store.environment.lowQualityMode !== shouldBeLowQ) {
      store.updateEnvironment({ lowQualityMode: shouldBeLowQ });
    }

    // Sync bloom strength based on budget
    const targetBloom = budget.bloom ? store.settings.bloomStrength : 0.2;
    if (Math.abs(store.settings.bloomStrength - targetBloom) > 0.05) {
      store.updateSettings({ bloomStrength: targetBloom });
    }
  }, []);

  // Context loss handler
  const handleContextLoss = useCallback(() => {
    const now = Date.now();
    const startWindow = now - RESTART_WINDOW_MS;
    crashTimestampsRef.current = crashTimestampsRef.current.filter(ts => ts >= startWindow);
    crashTimestampsRef.current.push(now);

    if (crashTimestampsRef.current.length > MAX_RESTARTS) {
      hardFailUntilRef.current = now + HARD_FAIL_COOLDOWN_MS;
      pushLog('[FXK] Hard fail cooldown — too many context losses', 'error');
      return 'hard_fail_cooldown';
    }

    // Degrade API
    const nextApi = clamp(stabilityApiRef.current + 1, 0, GRAPHICS_APIS.length - 1);
    if (nextApi !== stabilityApiRef.current) {
      stabilityApiRef.current = nextApi;
      pushLog(`[FXK] Context loss recovery → API fallback: ${GRAPHICS_APIS[nextApi]}`, 'warn');
      return 'recover_with_api_fallback';
    }
    return 'recover_without_fallback';
  }, []);

  // Register context loss listener
  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (e: Event) => {
      e.preventDefault();
      handleContextLoss();
    };
    canvas.addEventListener('webglcontextlost', onLost);
    return () => canvas.removeEventListener('webglcontextlost', onLost);
  }, [gl, handleContextLoss]);

  // ═══ Per-frame evaluation (sampled at ~10Hz) ═══
  useFrame((_state, delta) => {
    frameCounter.current++;
    // Sample at ~10Hz
    if (frameCounter.current % 6 !== 0) return;

    const now = Date.now();

    // Hard fail cooldown — skip processing
    if (now < hardFailUntilRef.current) {
      lastResultRef.current.stabilityAction = 'hard_fail_cooldown';
      return;
    }

    const fps = delta > 0 ? 1 / delta : 60;
    const frameMs = delta * 1000;
    const info = gl.info.render;
    const drawCalls = info.calls;
    const triangles = info.triangles;

    // ═══ Adaptive Quality ═══
    const hardPressure =
      fps < DEFAULT_THRESHOLDS.fpsHardFloor ||
      frameMs > DEFAULT_THRESHOLDS.gpuFrameHardMs ||
      drawCalls > DEFAULT_THRESHOLDS.maxDrawCalls;

    const softPressure =
      fps < DEFAULT_THRESHOLDS.fpsSoftFloor ||
      frameMs > DEFAULT_THRESHOLDS.gpuFrameSoftMs;

    const canChangeQuality = (now - lastQualityChangeRef.current) > QUALITY_CHANGE_COOLDOWN_MS;

    if (hardPressure && canChangeQuality) {
      // Degrade quality
      if (qualityIndexRef.current < QUALITY_LEVELS.length - 1) {
        qualityIndexRef.current++;
        lastQualityChangeRef.current = now;
      }
      // Disable heavy effects
      effectBudgetRef.current.heavyShaders = false;
      effectBudgetRef.current.particlesHighQuality = false;
    } else if (softPressure && canChangeQuality) {
      if (qualityIndexRef.current < QUALITY_LEVELS.length - 1) {
        qualityIndexRef.current++;
        lastQualityChangeRef.current = now;
      }
      effectBudgetRef.current.bloom = false;
      effectBudgetRef.current.volumetricFog = false;
    } else if (!softPressure && !hardPressure && canChangeQuality) {
      // Recover
      if (qualityIndexRef.current > 0) {
        qualityIndexRef.current--;
        lastQualityChangeRef.current = now;
      }
      const level = QUALITY_LEVELS[qualityIndexRef.current];
      if (level === 'cinematic' || level === 'high') {
        effectBudgetRef.current = {
          bloom: true,
          volumetricFog: true,
          heavyShaders: true,
          particlesHighQuality: true,
        };
      }
    }

    // ═══ Render Stability ═══
    const overBudget = frameMs > 16.6 || drawCalls > 1500 || triangles > 1200000;
    if (overBudget) {
      overBudgetStreakRef.current++;
    } else {
      overBudgetStreakRef.current = 0;
    }

    let stabilityAction = 'none';
    if (overBudgetStreakRef.current >= OVER_BUDGET_THRESHOLD) {
      overBudgetStreakRef.current = 0;

      const nextQ = clamp(stabilityQualityRef.current + 1, 0, QUALITY_PROFILES.length - 1);
      if (nextQ !== stabilityQualityRef.current) {
        stabilityQualityRef.current = nextQ;
        stabilityAction = 'degrade_quality';
        pushLog(`[FXK Stability] Quality → ${QUALITY_PROFILES[nextQ]}`, 'warn');
      } else {
        const nextApi = clamp(stabilityApiRef.current + 1, 0, GRAPHICS_APIS.length - 1);
        if (nextApi !== stabilityApiRef.current) {
          stabilityApiRef.current = nextApi;
          stabilityAction = 'fallback_api';
          pushLog(`[FXK Stability] API fallback → ${GRAPHICS_APIS[nextApi]}`, 'warn');
        } else {
          hardFailUntilRef.current = now + HARD_FAIL_COOLDOWN_MS;
          stabilityAction = 'hard_fail_cooldown';
          pushLog('[FXK Stability] Hard fail cooldown activated', 'error');
        }
      }
    }

    const currentLevel = QUALITY_LEVELS[qualityIndexRef.current];
    const currentBudget = { ...effectBudgetRef.current };

    // Apply to scene store (throttled — only when level changes)
    applyQualityToScene(currentLevel, currentBudget);

    lastResultRef.current = {
      qualityLevel: currentLevel,
      effectBudget: currentBudget,
      stabilityAction,
      graphicsApi: GRAPHICS_APIS[stabilityApiRef.current],
    };
  });

  return lastResultRef;
}

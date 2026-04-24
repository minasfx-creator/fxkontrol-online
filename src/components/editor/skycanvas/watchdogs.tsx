/**
 * Watchdogs & boundaries extracted from SkyCanvas.tsx.
 *
 * - HardeningWatchdog: feeds FPS/renderer metrics + QA validator each frame.
 * - FXKQualityController: runs adaptive quality refinement.
 * - ContextLossGuard: handles WebGL context loss/restore with deep dispose.
 * - SubsystemBoundary: error boundary for heavy R3F subsystems.
 * - PlaybackClock: pumps the deterministic clock every R3F frame.
 *
 * Intentionally side-effect free at import time.
 */
import React, { Component, useEffect, useRef, type ErrorInfo, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useSceneStore } from '@/store/useSceneStore';
import { pushLog } from '../ViewportTerminal';
import { useFXKUltraRefinement } from '@/hooks/useFXKUltraRefinement';
import { qaEngine } from '@/core/pyrosim/QAValidationEngine';
import type { FrameMetrics as QAFrameMetrics } from '@/core/pyrosim/QAValidationEngine';
import {
  reportCrash, isInCooldown, recordContextLoss,
  watchdogTick, pushFrameMetrics, startMetricsReporting, stopMetricsReporting,
  scanSceneTransforms, checkFrameBudget, checkSceneHealth, deepDispose, disposeAllTracked,
  onDegradationChange,
} from '@/lib/hardening';
import { resetPools } from '@/lib/geometryPool';
import { deterministicClock } from '@/core/time/deterministicClock';
import { getActiveBurstScan } from './sharedState';

export const PlaybackClock = React.forwardRef<unknown>(function PlaybackClock(_props, _ref) {
  useFrame(() => { deterministicClock.tick(); });
  return null;
});

export function HardeningWatchdog() {
  const { gl, scene } = useThree();
  const frameRef = useRef(0);
  const overBudgetStreakRef = useRef(0);

  useEffect(() => {
    startMetricsReporting(60);
    return () => stopMetricsReporting();
  }, []);

  useEffect(() => {
    const unsub = onDegradationChange((level) => {
      if (level === 'severe' || level === 'critical') {
        const store = useSceneStore.getState();
        if (!store.environment.lowQualityMode) {
          store.updateEnvironment({ lowQualityMode: true });
          pushLog(`[Hardening] Degradation ${level} → forcing low quality mode`, 'warn');
        }
      }
    });
    return unsub;
  }, []);

  useFrame((_state, delta) => {
    frameRef.current++;
    if (frameRef.current % 6 !== 0) return;

    const fps = delta > 0 ? 1 / delta : 60;
    const frameTimeMs = delta * 1000;
    const info = gl.info.render;

    pushFrameMetrics(fps, frameTimeMs, info.calls, info.triangles);
    watchdogTick(fps);

    const scan = getActiveBurstScan();
    const qaMetrics: QAFrameMetrics = {
      meanLuminance: scan ? Math.min(scan.luminance / 5.0, 1.0) : 0,
      peakLuminance: scan ? Math.min(scan.luminance, 10.0) : 0,
      meanVelocity: 0,
      particleCount: scan ? scan.activeBursts * 200 : 0,
      frameTimeMs,
      gcCollections: 0,
      smokePuffCount: scan ? scan.activeBursts : 0,
      meanSmokeOpacity: scan ? Math.min(scan.scatterMax, 1.0) : 0,
    };
    qaEngine.recordFrame(qaMetrics);

    scanSceneTransforms(scene);

    const budgetCheck = checkFrameBudget(frameTimeMs, info.calls, info.triangles);
    if (!budgetCheck.withinBudget) {
      overBudgetStreakRef.current++;
      if (overBudgetStreakRef.current >= 3) {
        pushLog(`[Hardening] Over budget: frame=${frameTimeMs.toFixed(1)}ms draws=${info.calls} tris=${info.triangles}`, 'warn');
        overBudgetStreakRef.current = 0;
      }
    } else {
      overBudgetStreakRef.current = 0;
    }

    if (frameRef.current % 300 === 0) {
      const health = checkSceneHealth(gl);
      if (health.warnings.length > 0) {
        health.warnings.forEach(w => pushLog(`[GPU Health] ${w}`, 'warn'));
      }
    }
  });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'Q') {
        e.preventDefault();
        const report = qaEngine.generateReport('continuous');
        console.group(`%c[QA Report] Grade: ${report.overallGrade} (${(report.overallScore * 100).toFixed(1)}%)`, 'color: #0ff; font-weight: bold; font-size: 14px');
        console.log(`Mode: ${report.mode} | Pass: ${report.passCount}/${report.passCount + report.failCount}`);
        console.table(report.criteria.map(c => ({
          Criterion: c.criterion.name,
          Score: (c.score * 100).toFixed(1) + '%',
          Grade: c.grade,
          Pass: c.pass ? '✅' : '❌',
          Notes: c.notes,
        })));
        if (report.temporal) {
          console.log(`Temporal: meanΔ=${report.temporal.meanBrightnessDelta.toFixed(4)} maxFlicker=${report.temporal.maxFlicker.toFixed(4)} score=${report.temporal.score.toFixed(3)}`);
        }
        if (report.recommendations.length > 0) {
          console.log('%cRecommendations:', 'color: #ff0; font-weight: bold');
          report.recommendations.forEach(r => console.log(`  → ${r}`));
        }
        console.groupEnd();
        pushLog(`[QA] Report: ${report.overallGrade} (${(report.overallScore * 100).toFixed(1)}%) — ${report.passCount}/${report.passCount + report.failCount} pass`, 'info');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return null;
}

export function FXKQualityController() {
  useFXKUltraRefinement();
  return null;
}

export function ContextLossGuard({ recoveringRef, onRemount }: {
  recoveringRef: React.MutableRefObject<boolean>;
  onRemount: () => void;
}) {
  const { gl, scene } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;

    const onLost = (e: Event) => {
      e.preventDefault();
      if (recoveringRef.current) return;

      recordContextLoss();
      const shouldRecover = reportCrash();
      if (!shouldRecover || isInCooldown()) {
        console.error('[FXK] WebGL context lost — in cooldown, suppressing remount');
        return;
      }

      try {
        deepDispose(scene);
        disposeAllTracked();
        pushLog('[FXK] Deep disposed scene resources after context loss', 'warn');
      } catch (disposeErr) {
        console.warn('[FXK] Error during deep dispose:', disposeErr);
      }

      recoveringRef.current = true;
      console.warn('[FXK] WebGL context lost — remounting renderer');
      resetPools();
      onRemount();
    };

    const onRestored = () => {
      console.log('[FXK] WebGL context restored');
      recoveringRef.current = false;
    };

    canvas.addEventListener('webglcontextlost', onLost as EventListener);
    canvas.addEventListener('webglcontextrestored', onRestored as EventListener);
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost as EventListener);
      canvas.removeEventListener('webglcontextrestored', onRestored as EventListener);
    };
  }, [gl, scene, recoveringRef, onRemount]);

  return null;
}

export class SubsystemBoundary extends Component<{ name: string; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[FXK SubsystemBoundary:${this.props.name}]`, error, info.componentStack);
    pushLog(`[SubsystemBoundary] ${this.props.name} crashed: ${error.message}`, 'error');
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

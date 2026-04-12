/**
 * ─── ShowPlan Manager ───────────────────────────────────────────────
 * Converts between ShowPlan ↔ ProjectStore,
 * validates ShowPlan integrity, and provides importers.
 */

import type {
  ShowPlan,
  PyroCue,
  DMXCue,
  VerificationResult,
  VerificationCheckResult,
  VerificationLevel,
} from './ShowPlan';
import { createEmptyShowPlan } from './ShowPlan';
import { blackbox } from '@/core/reliability/blackBoxRecorder';

class ShowPlanManager {
  private _current: ShowPlan = createEmptyShowPlan();

  /** Get the current active ShowPlan. */
  get current(): Readonly<ShowPlan> {
    return this._current;
  }

  /** Replace the active ShowPlan entirely. */
  load(plan: ShowPlan): void {
    this._current = plan;
    this._current.metadata.updatedAt = Date.now();
    blackbox.record('state', `ShowPlanManager: loaded "${plan.metadata.name}" (${plan.pyroCues.length} pyro, ${plan.dmxCues.length} dmx, ${plan.dronePaths.length} drone paths)`);
  }

  /** Build ShowPlan from the existing useProjectStore shape. */
  fromProjectStore(store: {
    name: string;
    timeline: Array<{
      id: string;
      effectId: string;
      startTime: number;
      trackIndex: number;
      position: { x: number; y: number; z: number };
      rack?: number;
      tube?: number;
      section?: string;
      universe?: string;
      cueHeading?: number;
      cuePitch?: number;
    }>;
    positions: Array<{
      id: string;
      name: string;
      type: 'pyro' | 'drone-pad' | 'light';
      x: number;
      y: number;
      z: number;
      heading: number;
      pitch: number;
      section?: string;
    }>;
    trajectories?: Array<{
      id: string;
      positionId: string;
      waypoints: Array<{
        id: string;
        position: { x: number; y: number; z: number };
        time: number;
        maxSpeed?: number;
        controlIn?: { x: number; y: number; z: number };
        controlOut?: { x: number; y: number; z: number };
      }>;
      name: string;
    }>;
  }): ShowPlan {
    const plan = createEmptyShowPlan();
    plan.metadata.name = store.name || 'Untitled Show';

    // Convert positions
    plan.positions = store.positions.map(p => ({
      id: p.id,
      name: p.name,
      type: p.type,
      x: p.x,
      y: p.y,
      z: p.z,
      heading: p.heading,
      pitch: p.pitch,
      section: p.section,
    }));

    // Convert timeline items → pyro cues
    plan.pyroCues = store.timeline
      .filter(t => {
        const pos = store.positions.find(p => p.id === t.id);
        return !pos || pos.type === 'pyro';
      })
      .map((t, idx): PyroCue => ({
        id: t.id,
        time: t.startTime,
        positionId: t.id,
        module: Math.floor(idx / 32),
        channel: idx % 32,
        effectId: t.effectId,
        fuseDelay: 0,
        caliber: 75,
        elevation: t.cuePitch ?? 90,
        heading: t.cueHeading ?? 0,
        position: t.position,
        rack: t.rack,
        tube: t.tube,
        section: t.section,
      }));

    // Convert timeline items with universe → DMX cues
    plan.dmxCues = store.timeline
      .filter(t => t.universe != null)
      .map((t): DMXCue => ({
        id: `dmx-${t.id}`,
        time: t.startTime,
        universe: parseInt(t.universe || '1', 10),
        channel: 1,
        value: 255,
        duration: 1,
        curve: 'linear',
      }));

    // Convert trajectories → drone paths
    if (store.trajectories) {
      plan.dronePaths = store.trajectories.map(traj => ({
        id: traj.id,
        droneId: traj.positionId,
        padPositionId: traj.positionId,
        waypoints: traj.waypoints.map(wp => ({
          id: wp.id,
          time: wp.time,
          position: wp.position,
          speed: wp.maxSpeed ?? 5,
          controlIn: wp.controlIn,
          controlOut: wp.controlOut,
        })),
        color: '#00ffff',
      }));
    }

    // Compute duration
    const allTimes = [
      ...plan.pyroCues.map(c => c.time),
      ...plan.dmxCues.map(c => c.time + c.duration),
      ...plan.dronePaths.flatMap(p => p.waypoints.map(w => w.time)),
    ];
    plan.metadata.duration = allTimes.length > 0 ? Math.max(...allTimes) : 0;

    this._current = plan;
    blackbox.record('state', `ShowPlanManager: built from ProjectStore (${plan.pyroCues.length} pyro, ${plan.dmxCues.length} dmx)`);
    return plan;
  }

  /** Import from JSON string. */
  fromJSON(json: string): ShowPlan {
    const parsed = JSON.parse(json) as ShowPlan;
    this.load(parsed);
    return parsed;
  }

  /** Validate the current ShowPlan. Returns structured result. */
  validate(plan?: ShowPlan): VerificationResult {
    const sp = plan ?? this._current;
    const checks: VerificationCheckResult[] = [];

    // 1. Cues without positions
    const posIds = new Set(sp.positions.map(p => p.id));
    const orphanCues = sp.pyroCues.filter(c => !posIds.has(c.positionId));
    checks.push({
      id: 'orphan-cues',
      label: 'Cues without positions',
      passed: orphanCues.length === 0,
      severity: 'error',
      detail: orphanCues.length === 0
        ? 'All cues have valid positions'
        : `${orphanCues.length} cues reference missing positions`,
    });

    // 2. Channel conflicts (same module+channel at overlapping times)
    const channelMap = new Map<string, PyroCue[]>();
    for (const cue of sp.pyroCues) {
      const key = `${cue.module}:${cue.channel}`;
      if (!channelMap.has(key)) channelMap.set(key, []);
      channelMap.get(key)!.push(cue);
    }
    let conflicts = 0;
    for (const [, cues] of channelMap) {
      if (cues.length > 1) {
        cues.sort((a, b) => a.time - b.time);
        for (let i = 1; i < cues.length; i++) {
          if (cues[i].time - cues[i - 1].time < 0.5) conflicts++;
        }
      }
    }
    checks.push({
      id: 'channel-conflicts',
      label: 'Module/channel conflicts',
      passed: conflicts === 0,
      severity: 'error',
      detail: conflicts === 0
        ? 'No channel conflicts'
        : `${conflicts} channel conflicts (< 0.5s apart on same module:channel)`,
    });

    // 3. Module channel limits (>32 channels per module)
    const moduleChannels = new Map<number, Set<number>>();
    for (const cue of sp.pyroCues) {
      if (!moduleChannels.has(cue.module)) moduleChannels.set(cue.module, new Set());
      moduleChannels.get(cue.module)!.add(cue.channel);
    }
    let overLimit = false;
    for (const [mod, chs] of moduleChannels) {
      if (chs.size > 32) {
        overLimit = true;
        checks.push({
          id: `module-limit-${mod}`,
          label: `Module ${mod} over 32 channels`,
          passed: false,
          severity: 'error',
          detail: `Module ${mod} uses ${chs.size} channels (max 32)`,
        });
      }
    }
    if (!overLimit) {
      checks.push({
        id: 'module-limits',
        label: 'Module channel limits',
        passed: true,
        severity: 'info',
        detail: 'All modules within 32-channel limit',
      });
    }

    // 4. NFPA distance validation
    checks.push({
      id: 'nfpa-distance',
      label: 'NFPA 1123 min distance',
      passed: sp.safetyConstraints.nfpaMinDistance >= 30,
      severity: sp.safetyConstraints.nfpaMinDistance >= 30 ? 'info' : 'warning',
      detail: `Min distance: ${sp.safetyConstraints.nfpaMinDistance}m`,
    });

    // 5. Empty show check
    const hasContent = sp.pyroCues.length > 0 || sp.dmxCues.length > 0 || sp.dronePaths.length > 0;
    checks.push({
      id: 'has-content',
      label: 'Show has content',
      passed: hasContent,
      severity: 'warning',
      detail: hasContent ? `${sp.pyroCues.length + sp.dmxCues.length} cues, ${sp.dronePaths.length} drone paths` : 'Show is empty',
    });

    // Determine level
    const hasErrors = checks.some(c => !c.passed && c.severity === 'error');
    const hasWarnings = checks.some(c => !c.passed && c.severity === 'warning');
    let level: VerificationLevel;

    if (hasErrors) {
      level = 'BLOCKED';
    } else if (hasWarnings) {
      level = 'READY_FOR_SIMULATION';
    } else if (!hasContent) {
      level = 'BLOCKED';
    } else {
      level = 'READY_FOR_EXPORT';
    }

    return { level, checks, timestamp: Date.now() };
  }
}

export const showPlanManager = new ShowPlanManager();

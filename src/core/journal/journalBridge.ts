/**
 * ─── Safety Journal Bridge ────────────────────────────────────────
 * Subscribes to SafetyStateMachine transitions OUTSIDE React and
 * persists every safety-critical event to public.command_journal.
 *
 * Why a bridge (not a hook):
 *   - SafetyStateMachine is a pure singleton with zero React deps.
 *   - Journal writes must capture E_STOP even if React has crashed.
 *   - Hot path = zero React renders.
 *
 * Failure mode: persistence errors are swallowed and logged once.
 * Local mirror in uiWorkspaceStore always succeeds so the in-app
 * journal panel stays in sync.
 *
 * Map: SafetyTransition → command_journal.command
 *   ARM_SYSTEM         → 'arm'
 *   DISARM_SYSTEM      → 'disarm'
 *   FIRE               → 'fire'
 *   FIRE_COMPLETE      → 'fire'   (event_kind="safety.fire.complete")
 *   E_STOP             → 'estop'
 *   LOCK/UNLOCK_STATE  → 'sync'   (state book-keeping, low signal)
 *   COOLDOWN_COMPLETE  → skipped  (auto-advance, not operator-driven)
 *   RESET_SAFETY       → 'sync'
 */
import { supabase } from '@/integrations/supabase/client';
import { safetyStateMachine, type SafetyTransition, type TransitionResult } from '@/core/safety/SafetyStateMachine';
import { useProjectStore } from '@/store/useProjectStore';
import { useUIWorkspaceStore } from '@/stores/uiWorkspaceStore';

type CommandVerb = 'fire' | 'arm' | 'disarm' | 'estop' | 'cue' | 'sync' | 'test';
type Result = 'success' | 'partial' | 'error' | 'refused' | 'timeout';

const TRANSITION_TO_COMMAND: Partial<Record<SafetyTransition, CommandVerb>> = {
  ARM_SYSTEM: 'arm',
  DISARM_SYSTEM: 'disarm',
  FIRE: 'fire',
  FIRE_COMPLETE: 'fire',
  E_STOP: 'estop',
  LOCK_STATE: 'sync',
  UNLOCK_STATE: 'sync',
  RESET_SAFETY: 'sync',
};

let _installed = false;
let _unsub: (() => void) | null = null;
let _warned = false;

async function persist(payload: TransitionResult & { transition: SafetyTransition }): Promise<void> {
  const command = TRANSITION_TO_COMMAND[payload.transition];
  if (!command) return; // skip auto-advance / book-keeping noise

  const eventKind = `safety.${payload.transition.toLowerCase()}`;
  const result: Result = payload.allowed ? 'success' : 'refused';

  // Always mirror locally — operator sees event regardless of network.
  try {
    useUIWorkspaceStore.getState().addCommandToJournal({
      command,
      payload: { from: payload.from, to: payload.to, transition: payload.transition },
      outcome: result,
    });
  } catch { /* never block on UI store */ }

  const projectId = useProjectStore.getState().projectId;
  if (!projectId) return;

  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch { /* offline / unauth — skip */ }
  if (!userId) return;

  const row = {
    user_id: userId,
    project_id: projectId,
    command,
    event_kind: eventKind,
    cue_id: `safety:${payload.transition}`,
    cue_type: 'safety_transition',
    source: 'system' as const,
    result,
    payload: { from: payload.from, to: payload.to, reason: payload.reason ?? null },
    state_before: payload.from,
    state_after: payload.to,
    sim_time: 0,
    tick: Date.now(),
    tick_seq: 0,
    show_run_id: `run-${new Date().toISOString().slice(0, 10)}`,
    latency_ms: null,
    error: payload.allowed ? null : (payload.reason ?? 'transition refused'),
    dedupe_key: null,
    status: payload.allowed ? 'completed' : 'error',
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase types stale until next regen
    const { error } = await (supabase.from('command_journal' as any) as any).insert(row);
    if (error && !_warned) {
      _warned = true;
      console.warn('[journalBridge] persist failed (further errors silenced):', error.message);
    }
  } catch (e) {
    if (!_warned) {
      _warned = true;
      console.warn('[journalBridge] persist threw:', e);
    }
  }
}

/**
 * Install the bridge. Idempotent — safe to call multiple times.
 * Returns the uninstaller (for tests / HMR teardown).
 */
export function installSafetyJournalBridge(): () => void {
  if (_installed) return () => { /* noop */ };
  _installed = true;

  _unsub = safetyStateMachine.onTransition((payload) => {
    // Fire-and-forget — never block the safety state machine on I/O.
    void persist(payload);
  });

  return () => {
    _unsub?.();
    _unsub = null;
    _installed = false;
    _warned = false;
  };
}

export function isSafetyJournalBridgeInstalled(): boolean {
  return _installed;
}

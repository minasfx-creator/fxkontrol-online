/**
 * useCommandJournal — append-only writer for public.command_journal.
 *
 * Persists every operator/system command with its safety state transitions
 * (state_before → state_after) and timing metadata. Mirrors the entry into
 * the rolling buffer in uiWorkspaceStore so the in-app journal panel can
 * render without a round-trip.
 *
 * Failure mode: persistence errors are logged but never thrown — journal
 * writes must never block command execution. The local mirror always
 * succeeds.
 *
 * Auth model: caller must be authenticated. RLS requires
 * `auth.uid() = user_id AND is_project_owner(project_id)`. The hook
 * pulls user_id from the live session and project_id from the active
 * project store — callers only supply the operational fields.
 */
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUIWorkspaceStore } from '@/stores/uiWorkspaceStore';
import { useProjectStore } from '@/store/useProjectStore';

export type CommandJournalCommand = 'fire' | 'arm' | 'disarm' | 'estop' | 'cue' | 'sync' | 'test';
export type CommandJournalSource = 'operator' | 'system' | 'grok' | 'replay';
export type CommandJournalResult = 'success' | 'partial' | 'error' | 'refused' | 'timeout';

export interface JournalEntryInput {
  /** Stable command verb (fire, arm, …). */
  command: CommandJournalCommand;
  /** Domain event tag (e.g. "cue.fire", "safety.arm"). */
  event_kind: string;
  /** Cue or device identifier this entry refers to. */
  cue_id: string;
  cue_type: string;
  source?: CommandJournalSource;
  result?: CommandJournalResult;
  payload?: Record<string, unknown>;
  state_before?: string;
  state_after?: string;
  sim_time?: number;
  tick?: number;
  tick_seq?: number;
  show_run_id?: string;
  latency_ms?: number;
  error?: string;
  dedupe_key?: string;
}

export function useCommandJournal() {
  const projectId = useProjectStore((s) => s.projectId);
  const addLocal = useUIWorkspaceStore((s) => s.addCommandToJournal);

  const append = useCallback(async (entry: JournalEntryInput): Promise<void> => {
    // Always mirror locally first so UI never lags behind execution.
    addLocal({
      command: entry.command,
      payload: entry.payload,
      outcome: entry.result,
    });

    if (!projectId) return; // No active project → nothing to persist.

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // Anonymous session — RLS would reject, skip silently.

    const row = {
      user_id: user.id,
      project_id: projectId,
      command: entry.command,
      event_kind: entry.event_kind,
      cue_id: entry.cue_id,
      cue_type: entry.cue_type,
      source: entry.source ?? 'system',
      result: entry.result ?? null,
      payload: entry.payload ?? {},
      state_before: entry.state_before ?? null,
      state_after: entry.state_after ?? null,
      sim_time: entry.sim_time ?? 0,
      tick: entry.tick ?? Date.now(),
      tick_seq: entry.tick_seq ?? 0,
      show_run_id: entry.show_run_id ?? `run-${new Date().toISOString().slice(0, 10)}`,
      latency_ms: entry.latency_ms ?? null,
      error: entry.error ?? null,
      dedupe_key: entry.dedupe_key ?? null,
      status: entry.result === 'error' ? 'error' : entry.result ? 'completed' : 'pending',
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase types stale until next regen, table exists with RLS in DB
    const { error } = await (supabase.from('command_journal' as any) as any).insert(row);
    if (error && typeof console !== 'undefined') {
      console.warn('[command_journal] persist failed:', error.message);
    }
  }, [projectId, addLocal]);

  return append;
}

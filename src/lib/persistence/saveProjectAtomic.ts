/**
 * Typed wrapper around the Postgres RPC `save_project_atomic`.
 *
 * Why this file exists:
 *   - `src/integrations/supabase/types.ts` is auto-generated from the live DB
 *     schema and is *read-only* in this project. Until that snapshot is
 *     refreshed, the generated `Database['public']['Functions']` map does
 *     not list `save_project_atomic`, so calling `supabase.rpc('save_project_atomic', …)`
 *     directly fails the typecheck.
 *   - We isolate the single necessary cast to one place (here), behind a
 *     fully-typed function. The rest of the codebase consumes the typed
 *     wrapper and never touches `any` / `unknown` for this RPC.
 *
 * Do NOT add fallback paths (manual delete+insert). The RPC is the single
 * source of transactional persistence.
 */
import { supabase } from '@/integrations/supabase/client';
import type {
  ProjectSavePayload,
  PositionSavePayload,
  TimelineItemSavePayload,
  TrajectorySavePayload,
} from './savePayloadTypes';

export interface SaveProjectAtomicArgs {
  p_project_id: string | null;
  p_project: ProjectSavePayload;
  p_positions: PositionSavePayload[];
  p_timeline_items: TimelineItemSavePayload[];
  p_trajectories: TrajectorySavePayload[];
}

export interface SaveProjectAtomicResult {
  data: string | null;
  error: { message: string; code?: string; details?: string | null } | null;
}

/**
 * Narrow shape we expect from `supabase.rpc` — typed locally so the cast
 * surface is small (one function reference, not `any`). Returns the project
 * UUID on success.
 */
type RpcCaller = (
  fn: 'save_project_atomic',
  args: SaveProjectAtomicArgs,
) => PromiseLike<{ data: string | null; error: SaveProjectAtomicResult['error'] }>;

export async function saveProjectAtomic(
  args: SaveProjectAtomicArgs,
): Promise<SaveProjectAtomicResult> {
  // Single, isolated cast: the generated Database type doesn't yet include
  // the RPC, but its runtime contract is stable (RETURNS uuid).
  const rpc = supabase.rpc as unknown as RpcCaller;
  const { data, error } = await rpc('save_project_atomic', args);
  return { data, error };
}

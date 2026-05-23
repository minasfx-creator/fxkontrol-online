/**
 * Viewport Tools — Type Contracts
 * ────────────────────────────────────────────────────────────
 * Strict separation between visual editing surface (viewport) and the
 * canonical truth (ShowPlan). The viewport NEVER mutates entities directly:
 * tool buttons emit operations through the dispatcher, which proxies to the
 * CommandBus and applies the change against the project store / ShowPlan.
 *
 * This file defines:
 *  - SegmentType         — canonical segment taxonomy
 *  - ToolScope           — semantic grouping for UI
 *  - ViewportTool        — declarative tool spec
 *  - ViewportSegmentPlugin — registry contract
 *  - ViewportOperation   — audit-friendly operation envelope (undo/redo)
 *  - Validator           — pure validation functions for safety/conflict
 */

export type SegmentType = 'PYRO' | 'SFX' | 'DRONES' | 'LIGHT' | 'DMX';

export type ToolScope =
  | 'selection'
  | 'edit'
  | 'generate'
  | 'patch'
  | 'safety'
  | 'preview';

export interface ViewportTool {
  id: string;
  label: string;
  segment: SegmentType;
  scope: ToolScope;
  /** Symbolic command id; resolved by the dispatcher, never executed inline. */
  command: string;
  /** Optional Lucide icon name (resolved in toolbar). */
  icon?: string;
  /** Disable the button if no selection of the right segment. */
  requiresSelection?: boolean;
  /** Critical pyro/sfx ops — gated by SafetyStateMachine in real_operation. */
  safetyCritical?: boolean;
  /** Short hint shown in tooltip. */
  hint?: string;
}

export interface ValidationIssue {
  severity: 'info' | 'warn' | 'error';
  code: string;
  message: string;
  positionId?: string;
}

export type Validator = (ctx: ValidationContext) => ValidationIssue[];

export interface ValidationContext {
  segment: SegmentType;
  selectionIds: string[];
  /** Read-only access; never mutate. */
  positions: ReadonlyArray<{ id: string; type: string; name: string }>;
}

/**
 * ViewportOperation — minimal envelope serialized in the operation log.
 * `before` / `after` carry the JSON-serialisable diff applied to the store
 * (each handler decides what to capture). Keep payloads small.
 */
export interface ViewportOperation<T = unknown> {
  id: string;
  segment: SegmentType;
  command: string;
  timestamp: number;
  before: T;
  after: T;
  description: string;
}

export type CommandHandler = (
  payload: unknown,
  ctx: { selectionIds: string[]; segment: SegmentType }
) => ViewportOperation | null;

export interface ViewportSegmentPlugin {
  segment: SegmentType;
  tools: ViewportTool[];
  validators: Validator[];
  /** Map of command id -> handler. Handler returns the operation envelope
   *  it just applied (for the operation log) or null if no-op. */
  commandHandlers: Record<string, CommandHandler>;
}

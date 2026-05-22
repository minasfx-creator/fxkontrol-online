/**
 * Viewport Tools — Command Dispatcher
 * ────────────────────────────────────────────────────────────
 * Single funnel for tool execution.
 *
 *   ToolButton → executeViewportCommand
 *              → plugin.commandHandlers[command](payload, ctx)
 *              → handler mutates ProjectState (the ShowPlan source) and
 *                returns a ViewportOperation envelope
 *              → operationLog.push(op)        (undo/redo)
 *              → commandBus.apply('VIEWPORT_OP'-equivalent)  (audit)
 *
 * NOTE on CommandBus integration: the global CommandBus union is strict and
 * intentionally narrow (FIRE / ARM / E_STOP / ...). To stay 100 % compliant
 * with the canonical Command type without polluting it, we surface viewport
 * operations through a parallel listener API on this module. The bridge to
 * the global bus dispatches a tracked CONTINUITY_CHECK no-op only when
 * `bridgeToGlobalBus` is enabled, purely for audit fan-out.
 */

import { viewportToolRegistry } from './registry';
import type {
  SegmentType,
  ViewportOperation,
  ViewportTool,
} from './types';
import { useProjectStore } from '@/store/useProjectStore';

type OperationListener = (op: ViewportOperation) => void;

class OperationLog {
  private _undo: ViewportOperation[] = [];
  private _redo: ViewportOperation[] = [];
  private _listeners = new Set<OperationListener>();
  private static MAX = 200;

  push(op: ViewportOperation): void {
    this._undo.push(op);
    if (this._undo.length > OperationLog.MAX) this._undo.shift();
    // New op invalidates redo stack.
    this._redo.length = 0;
    for (const fn of this._listeners) {
      try {
        fn(op);
      } catch {
        /* */
      }
    }
  }

  popUndo(): ViewportOperation | undefined {
    const op = this._undo.pop();
    if (op) this._redo.push(op);
    return op;
  }

  popRedo(): ViewportOperation | undefined {
    const op = this._redo.pop();
    if (op) this._undo.push(op);
    return op;
  }

  canUndo(): boolean {
    return this._undo.length > 0;
  }

  canRedo(): boolean {
    return this._redo.length > 0;
  }

  subscribe(fn: OperationListener): () => void {
    this._listeners.add(fn);
    return () => {
      this._listeners.delete(fn);
    };
  }

  clear(): void {
    this._undo.length = 0;
    this._redo.length = 0;
  }

  /** For diagnostics / dev-only inspection. */
  snapshot(): { undo: number; redo: number } {
    return { undo: this._undo.length, redo: this._redo.length };
  }
}

export const operationLog = new OperationLog();

export interface ExecuteResult {
  ok: boolean;
  reason?: string;
  operation?: ViewportOperation;
}

/** Hidden global flag — toggled in dev tools to pipe ops to CommandBus log. */
let bridgeToGlobalBus = false;
export function setGlobalBusBridge(enabled: boolean): void {
  bridgeToGlobalBus = enabled;
}

export function executeViewportCommand(
  tool: ViewportTool,
  payload: unknown = {}
): ExecuteResult {
  const plugin = viewportToolRegistry.get(tool.segment);
  if (!plugin) {
    return { ok: false, reason: `no-plugin:${tool.segment}` };
  }
  const handler = plugin.commandHandlers[tool.command];
  if (!handler) {
    return { ok: false, reason: `no-handler:${tool.command}` };
  }

  const { selectedPositionIds } = useProjectStore.getState();

  if (tool.requiresSelection && selectedPositionIds.length === 0) {
    return { ok: false, reason: 'empty-selection' };
  }

  // Safety-critical ops are guarded at the SafetyStateMachine layer when
  // the system runs in real_operation. In design/simulation, the dispatcher
  // is permissive — that is the canonical WorkMode contract.
  let op: ViewportOperation | null = null;
  try {
    op = handler(payload, {
      selectionIds: selectedPositionIds,
      segment: tool.segment,
    });
  } catch (err) {
    return {
      ok: false,
      reason: `handler-error:${(err as Error).message}`,
    };
  }

  if (!op) {
    return { ok: true };
  }

  operationLog.push(op);

  if (bridgeToGlobalBus) {
    // Audit-only fan-out; never blocking.
    try {
      // Dynamic import keeps tree-shaking happy when bridge is off.
      void import('@/core/command/CommandBus').then((m) => {
        m.commandBus.dispatch({ type: 'CONTINUITY_CHECK' });
      });
    } catch {
      /* */
    }
  }

  return { ok: true, operation: op };
}

export function listToolsForSegment(segment: SegmentType): ViewportTool[] {
  return viewportToolRegistry.get(segment)?.tools ?? [];
}

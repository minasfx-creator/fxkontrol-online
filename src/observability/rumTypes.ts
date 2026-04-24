/**
 * ─── RUM Event Types ──────────────────────────────────────────────
 * Stable contract for Real User Monitoring events.
 * Keep payload shapes loose to allow per-event flexibility, but the
 * envelope (id, ts, sessionId, build, route, type) is invariant.
 */

export type RumEventType =
  | 'web_vital'
  | 'route_change'
  | 'error'
  | 'replay_marker';

export interface RumEvent {
  id: string;
  type: RumEventType;
  ts: number;

  route: string;
  build: string;
  sessionId: string;

  /** Correlates an error/event with an active emulator replay session. */
  replayId?: string;
  /** Correlates with a transport trace bundle. */
  traceId?: string;

  payload: Record<string, unknown>;
}

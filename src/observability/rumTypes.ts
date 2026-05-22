/**
 * ─── RUM Event Contract ───────────────────────────────────────────
 * Stable shape for Real User Monitoring events. The envelope
 * (id/ts/sessionId/build/route/type) is invariant; payload shape
 * varies per event type but is always sanitized by the client.
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

  /** Correlates the event with an active emulator replay session. */
  replayId?: string;
  /** Correlates with a transport trace bundle. */
  traceId?: string;

  payload: Record<string, unknown>;
}

export interface RumClientOptions {
  endpoint?: string;
  build?: string;
  maxQueue?: number;
  enabled?: boolean;
}

export interface WebVitalPayload {
  name: string;
  value: number;
  rating?: string;
  delta?: number;
  id?: string;
}

export interface RouteChangePayload {
  from: string;
  to: string;
  durationMs: number;
}

export interface ErrorPayload {
  message: string;
  name?: string;
  stack?: string;
  source?: 'window_error' | 'unhandled_rejection' | 'manual';
}

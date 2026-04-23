/**
 * Stable, cheap event signature for replay comparison.
 * Pure function — same input always yields same string.
 */

import type { ObservedEvent } from './types';

export function eventSignature(e: {
  frameIndex: number;
  executionLayer: string;
  sequenceId: string;
  t0: number;
  adapter: string;
  channel?: string | number;
  action?: string;
}): string {
  return [
    e.frameIndex,
    e.executionLayer,
    e.sequenceId,
    e.t0,
    e.adapter,
    e.channel ?? '',
    e.action ?? '',
  ].join('|');
}

export type SignableEvent = Pick<
  ObservedEvent,
  'frameIndex' | 'executionLayer' | 'sequenceId' | 't0' | 'adapter' | 'channel' | 'action'
>;

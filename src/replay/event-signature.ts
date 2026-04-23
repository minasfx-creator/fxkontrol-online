import type { ObservedEvent, PlannedEvent } from "./types";

export function eventSignature(e: PlannedEvent | ObservedEvent): string {
  return [
    e.frameIndex,
    e.executionLayer,
    e.sequenceId,
    e.t0,
    e.adapter,
    e.channel ?? "",
    e.action ?? "",
  ].join("|");
}

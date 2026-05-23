/**
 * ─── AI Guardrail (centralizado) ──────────────────────────────────
 * Lista canônica de ações físicas/safety que JAMAIS podem partir de
 * um caller `agent` (IA / JOI / copilot / automação). Consultada por:
 *   • SafetyStateMachine.transition() quando caller==='agent'
 *   • joiCommandExecutor (parser JOI_CMD)
 *   • Qualquer adapter de hardware que receba origem 'agent'
 *
 * Também normaliza nomes (case + separadores) para evitar bypass via
 * 'arm-system' / 'armSystem' / 'ARM_SYSTEM'.
 */

export type Caller = 'human' | 'agent' | 'system';

const FORBIDDEN = new Set<string>([
  // Safety state transitions
  'arm', 'arm_system', 'arm_all',
  'disarm', 'disarm_system',
  'fire', 'fire_cue', 'fire_channel', 'fire_all', 'fire_array',
  'e_stop', 'estop', 'emergency_stop',
  'lock_state', 'unlock_state', 'reset_safety',
  // Physical I/O
  'energize', 'power_on', 'power_off',
  'hardware_write', 'send_dmx', 'send_artnet',
  // Mode escalation
  'set_work_mode', 'switch_to_real_operation',
  // Bypass attempts
  'safety_bypass', 'override_lockout', 'disable_lockout',
]);

/** Normalize separators + case so 'ARM-System' === 'arm_system'. */
export function normalizeAction(action: string): string {
  return action.toLowerCase().replace(/[-\s]+/g, '_');
}

export function isForbiddenForAgent(action: string): boolean {
  return FORBIDDEN.has(normalizeAction(action));
}

export interface GuardrailDecision {
  allowed: boolean;
  reason?: string;
}

/**
 * Central decision used by SSM and JOI executor.
 * - human  → always allowed (UI is the gate)
 * - system → always allowed (timers, internal callbacks)
 * - agent  → blocked if action ∈ FORBIDDEN
 */
export function evaluate(action: string, caller: Caller): GuardrailDecision {
  if (caller !== 'agent') return { allowed: true };
  if (isForbiddenForAgent(action)) {
    return {
      allowed: false,
      reason: `AI_BLOCKED: action '${action}' requires authorized human operator`,
    };
  }
  return { allowed: true };
}

/** Read-only snapshot of the forbidden set (for audits / UI). */
export function listForbiddenActions(): readonly string[] {
  return Array.from(FORBIDDEN).sort();
}

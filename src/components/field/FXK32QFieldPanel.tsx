/**
 * FXK32QFieldPanel — Field Ops tab wrapper for the FXK32Q 32ch
 * ESP32-S3 + 2×16-relay pyro controller. Same shape as FXK16FieldPanel:
 * connection card on top, operation rules block below, deep-link to
 * Real Discovery for transport diagnostics.
 *
 * Visibility is gated upstream in FieldOpsPage by either:
 *   • controllerRegistry mapping a live device to kind 'fxk32q', or
 *   • the localStorage flag fxk.flag.fxk32q_fieldops (bench preflight).
 *
 * NEVER mutates workMode / SafetyStateMachine / FieldBus directly —
 * all real commands flow through uiCommandGateway via FXK32QControlPanel.
 */
import { Link } from 'react-router-dom';
import { Cable, ShieldCheck, Activity, Network } from 'lucide-react';
import FXK32QControlPanel from '@/components/dev/fxk32q/FXK32QControlPanel';

export default function FXK32QFieldPanel() {
  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Cable className="w-4 h-4 text-[hsl(190_70%_58%)]" />
            <h1 className="text-sm font-mono font-bold tracking-[0.2em] uppercase text-[hsl(190_70%_58%)]">
              FXK32Q — 32ch Relay Module
            </h1>
          </div>
          <p className="text-xs text-muted-foreground/80 leading-relaxed">
            ESP32-S3 32-channel pyro controller (2×16-relay bank). Speaks the
            FireOne bridge protocol over USB-CDC, BLE, BLE Long Range,
            WebSocket, Wi-Fi Direct or RS-485 (XLII+ slave). Handshake
            <span className="font-mono"> MODEL:FXK32Q;CH:32</span> is required
            before ARM/FIRE.
          </p>
        </div>

        {/* The bench-grade control card (singleton bridge). */}
        <FXK32QControlPanel />

        {/* Help / context */}
        <div className="rounded-lg border border-border/40 bg-card/30 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-[hsl(150_70%_55%)]" />
            <span className="text-[10px] font-mono font-bold tracking-[0.18em] uppercase text-foreground/80">
              Operation
            </span>
          </div>
          <ul className="text-[11px] text-muted-foreground/80 leading-relaxed space-y-1 pl-5 list-disc">
            <li>Channel mapping is 1:1 (logical 1..32 → physical 1..32) once handshake clears.</li>
            <li>ARM is client-side only; per-batch FIRE uses Hold-to-Confirm (1 s) — never instantaneous.</li>
            <li>Auto-disarm on link loss; reconnect required to ARM again.</li>
            <li>Real-operation cues continue to route through <span className="font-mono">uiCommandGateway</span>; this panel is for bench / Phase 3 calibration.</li>
            <li>BLE is banned for FIRE in <span className="font-mono">real_operation</span> by <span className="font-mono">pyroTransportPolicy</span> — prefer USB or RS-485.</li>
          </ul>
        </div>

        {/* Tools */}
        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/dev/real-discovery"
            className="rounded-lg border border-border/40 bg-card/20 hover:bg-card/40 hover:border-[hsl(190_70%_58%/0.4)] transition-all p-3 group"
          >
            <div className="flex items-center gap-2 mb-1">
              <Network className="w-3.5 h-3.5 text-[hsl(190_70%_58%)] group-hover:drop-shadow-[0_0_4px_hsl(190_70%_58%/0.5)]" />
              <span className="text-[10px] font-mono font-bold tracking-[0.18em] uppercase text-foreground/85">
                Real Discovery
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground/70 leading-snug">
              Per-transport health (Serial / USB / BLE / Art-Net).
            </p>
          </Link>
          <Link
            to="/dev/readiness-audit"
            className="rounded-lg border border-border/40 bg-card/20 hover:bg-card/40 hover:border-[hsl(190_70%_58%/0.4)] transition-all p-3 group"
          >
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-3.5 h-3.5 text-[hsl(190_70%_58%)] group-hover:drop-shadow-[0_0_4px_hsl(190_70%_58%/0.5)]" />
              <span className="text-[10px] font-mono font-bold tracking-[0.18em] uppercase text-foreground/85">
                Readiness Audit
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground/70 leading-snug">
              Phase 0 adapter triage incl. FXK32Q live state.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}

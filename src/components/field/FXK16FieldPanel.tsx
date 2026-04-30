/**
 * FXK16FieldPanel — Field Ops tab wrapper for the FXK16 16ch ESP32-S3 relay
 * connection card. Uses the existing singleton useFXK16Bridge under the hood
 * (via FXK16ConnectionPanel), so connections established here are immediately
 * visible to the Live Firing panel, AutoControllerLauncher, and cueQueueRunner.
 *
 * Moved out of PyroFireOnePanel: hardware connection belongs in /field, not
 * mixed with cue/Live operation UI.
 */
import { Link } from 'react-router-dom';
import { Cable, ShieldCheck, Wand2, Activity } from 'lucide-react';
import { FXK16ConnectionPanel } from '@/components/editor/live-firing/FXK16ConnectionPanel';

export default function FXK16FieldPanel() {
  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Cable className="w-4 h-4 text-[hsl(32_100%_65%)]" />
            <h1 className="text-sm font-mono font-bold tracking-[0.2em] uppercase text-[hsl(32_100%_65%)]">
              FXK16 — 16ch Relay Module
            </h1>
          </div>
          <p className="text-xs text-muted-foreground/80 leading-relaxed">
            ESP32-S3 16-channel ignition relay. Connects via USB (Web Serial) or
            BLE. Handshake VERSION + STATUS validates link before any ARM/FIRE.
          </p>
        </div>

        {/* The actual connection card (singleton bridge). */}
        <FXK16ConnectionPanel compact={false} />

        {/* Help / context */}
        <div className="rounded-lg border border-border/40 bg-card/30 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-[hsl(150_70%_55%)]" />
            <span className="text-[10px] font-mono font-bold tracking-[0.18em] uppercase text-foreground/80">
              Operation
            </span>
          </div>
          <ul className="text-[11px] text-muted-foreground/80 leading-relaxed space-y-1 pl-5 list-disc">
            <li>Once linked, the channel mapping is 1:1 (logical 1..16 → physical 1..16).</li>
            <li>Test FIRE per channel uses Hold-to-Confirm (800 ms) — never instantaneous.</li>
            <li>Auto-disarm fires on link loss; reconnect is required to ARM again.</li>
            <li>Live Firing (FXKPYRO) and the cue runner read from the same bridge — connect once here, use everywhere.</li>
          </ul>
        </div>

        {/* Tools */}
        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/dev/fxk16-validate"
            className="rounded-lg border border-border/40 bg-card/20 hover:bg-card/40 hover:border-[hsl(32_100%_50%/0.4)] transition-all p-3 group"
          >
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-3.5 h-3.5 text-[hsl(32_100%_65%)] group-hover:drop-shadow-[0_0_4px_hsl(32_100%_50%/0.5)]" />
              <span className="text-[10px] font-mono font-bold tracking-[0.18em] uppercase text-foreground/85">
                Validate
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground/70 leading-snug">
              Per-channel continuity + response harness.
            </p>
          </Link>
          <Link
            to="/dev/fxk16-calibrate"
            className="rounded-lg border border-border/40 bg-card/20 hover:bg-card/40 hover:border-[hsl(32_100%_50%/0.4)] transition-all p-3 group"
          >
            <div className="flex items-center gap-2 mb-1">
              <Wand2 className="w-3.5 h-3.5 text-[hsl(32_100%_65%)] group-hover:drop-shadow-[0_0_4px_hsl(32_100%_50%/0.5)]" />
              <span className="text-[10px] font-mono font-bold tracking-[0.18em] uppercase text-foreground/85">
                Calibrate
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground/70 leading-snug">
              Latency + transport tuning (USB vs BLE).
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}

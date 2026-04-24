/**
 * ─── Network Settings ──────────────────────────────────────────────
 * Configure transport (Art-Net / sACN / Serial), hostname, port,
 * WebSocket relay and run a real connection test.
 *
 * Persists to localStorage via useNetworkConfigStore.
 */
import { useState, useCallback } from "react";
import { Network, Wifi, Cable, Activity, Save, RotateCcw, Loader2, CheckCircle2, XCircle, AlertTriangle, Lightbulb, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useNetworkConfigStore,
  defaultPortForProtocol,
  type TransportProtocol,
} from "@/store/useNetworkConfigStore";
import { isWebSerialSupported } from "@/lib/usbEngine";

type StepStatus = "pending" | "running" | "ok" | "fail" | "skip";
interface TestStep {
  id: string;
  label: string;
  status: StepStatus;
  durationMs?: number;
  detail?: string;
}
type TestStatus = "idle" | "running" | "ok" | "fail";
interface TestResult {
  status: TestStatus;
  latencyMs?: number;
  message?: string;
  detail?: string;
  hint?: string;
  steps: TestStep[];
  raw?: unknown;
}

const EMPTY_RESULT: TestResult = { status: "idle", steps: [] };

/** Map low-level errors to actionable hints. */
function diagnoseError(message: string, protocol: TransportProtocol): string | undefined {
  const m = message.toLowerCase();
  if (m.includes("permissions policy") || m.includes("disallowed")) {
    return "Open the app in a new tab — WebSerial/USB are blocked inside the editor iframe.";
  }
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed")) {
    return "The browser couldn't reach the backend. Check your internet connection or VPN.";
  }
  if (m.includes("timeout") || m.includes("timed out")) {
    return `The ${protocol.toUpperCase()} node didn't reply in time. Verify it's powered on and on the same subnet.`;
  }
  if (m.includes("hostname")) return "Enter a valid IPv4 (e.g. 192.168.1.100) or DNS hostname.";
  if (m.includes("port")) return "Port must be between 1 and 65535.";
  if (m.includes("websocket") || m.includes("ws://") || m.includes("wss://")) {
    return "WebSocket relay rejected the connection. Verify the URL and that the relay is running.";
  }
  if (m.includes("not found") || m.includes("404")) {
    return "Edge function not deployed. Try again in a few seconds or contact support.";
  }
  return undefined;
}


const PROTOCOLS: Array<{
  id: TransportProtocol;
  name: string;
  icon: typeof Wifi;
  desc: string;
}> = [
  { id: "artnet", name: "Art-Net 4", icon: Wifi, desc: "UDP 6454 — DMX over Ethernet (most common)" },
  { id: "sacn", name: "sACN (E1.31)", icon: Network, desc: "UDP 5568 — Streaming ACN multicast" },
  { id: "serial", name: "USB Serial", icon: Cable, desc: "DMX via USB-C/Lightning adapter (WebSerial)" },
];

export default function NetworkSettings() {
  const {
    protocol, endpoint, autoFailover, pollIntervalMs,
    setProtocol, setEndpoint, setAutoFailover, setPollIntervalMs, reset,
  } = useNetworkConfigStore();

  const [test, setTest] = useState<TestResult>({ status: "idle" });

  const handleProtocolChange = (p: TransportProtocol) => {
    setProtocol(p);
    if (endpoint.port === 0 || [6454, 5568].includes(endpoint.port)) {
      setEndpoint({ port: defaultPortForProtocol(p) });
    }
  };

  const handleSave = () => {
    // Already persisted by zustand/persist on every change; this is a UX confirmation.
    toast.success("Network settings saved", {
      description: `${protocol.toUpperCase()} → ${endpoint.hostname}:${endpoint.port}`,
    });
  };

  const handleReset = () => {
    reset();
    setTest({ status: "idle" });
    toast.info("Restored default network settings");
  };

  const runTest = useCallback(async () => {
    setTest({ status: "running" });
    const startedAt = performance.now();

    try {
      if (protocol === "serial") {
        if (!isWebSerialSupported()) {
          throw new Error("WebSerial unavailable. Use Chrome/Edge desktop or open outside of an iframe.");
        }
        // Probe by listing previously authorized ports — does not prompt.
        const ports = await (navigator as any).serial.getPorts();
        setTest({
          status: "ok",
          latencyMs: Math.round(performance.now() - startedAt),
          message: `WebSerial OK — ${ports.length} authorized port(s)`,
          detail: ports.length === 0 ? "No port granted yet. Use 'Open Port' in DMX Output to grant access." : undefined,
        });
        return;
      }

      // Art-Net / sACN: poll via the artnet-bridge edge function.
      if (!endpoint.hostname.trim()) throw new Error("Hostname is required");
      if (endpoint.port < 1 || endpoint.port > 65535) throw new Error("Port must be 1–65535");

      const { data, error } = await supabase.functions.invoke("artnet-bridge", {
        body: {
          action: "poll",
          targetIp: endpoint.hostname,
          targetPort: endpoint.port,
        },
      });

      if (error) throw new Error(error.message ?? "Edge function error");

      const latencyMs = Math.round(performance.now() - startedAt);
      const okShape = data && (data.ok === true || data.success === true || Array.isArray(data.nodes));
      if (!okShape && data?.error) throw new Error(String(data.error));

      setTest({
        status: "ok",
        latencyMs,
        message: `Reachable via ${protocol.toUpperCase()}`,
        detail: data?.nodes?.length ? `${data.nodes.length} node(s) replied` : "Bridge responded — no ArtPoll replies received",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setTest({
        status: "fail",
        latencyMs: Math.round(performance.now() - startedAt),
        message: "Connection test failed",
        detail: message,
      });
    }
  }, [protocol, endpoint]);

  return (
    <div className="min-h-[100dvh] bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Network className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Network Settings</h1>
              <p className="text-xs text-muted-foreground">
                Configure real hardware transport — Art-Net, sACN, or USB Serial
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] uppercase">
            {protocol}
          </Badge>
        </header>

        {/* Protocol */}
        <section className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Transport Protocol
          </Label>
          <div className="grid sm:grid-cols-3 gap-2">
            {PROTOCOLS.map((p) => {
              const Icon = p.icon;
              const active = protocol === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handleProtocolChange(p.id)}
                  className={`text-left rounded-lg border p-3 transition-all ${
                    active
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border bg-card hover:border-border/80 hover:bg-accent/30"
                  }`}
                  aria-pressed={active}
                >
                  <Icon className={`w-4 h-4 mb-2 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  <p className="text-sm font-semibold text-foreground">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{p.desc}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Endpoint */}
        {protocol !== "serial" && (
          <section className="space-y-3 rounded-lg border border-border bg-card p-4">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Endpoint
            </Label>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="hostname" className="text-xs">Hostname / IP</Label>
                <Input
                  id="hostname"
                  value={endpoint.hostname}
                  onChange={(e) => setEndpoint({ hostname: e.target.value.trim() })}
                  placeholder="192.168.1.100"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="port" className="text-xs">Port</Label>
                <Input
                  id="port"
                  type="number"
                  min={1}
                  max={65535}
                  value={endpoint.port}
                  onChange={(e) => setEndpoint({ port: Number(e.target.value) || 0 })}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wsRelay" className="text-xs">WebSocket Relay (optional)</Label>
              <Input
                id="wsRelay"
                value={endpoint.wsRelayUrl}
                onChange={(e) => setEndpoint({ wsRelayUrl: e.target.value.trim() })}
                placeholder="wss://relay.example.com/artnet"
                className="font-mono text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Required only for direct browser→UDP relays. Leave empty to use the built-in edge function.
              </p>
            </div>
          </section>
        )}

        {protocol === "serial" && (
          <section className="rounded-lg border border-border bg-card p-4 flex items-start gap-3">
            <Cable className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-foreground">USB Serial DMX</p>
              <p className="text-muted-foreground leading-relaxed">
                No IP/port required. Connect a DMX adapter (Enttec, FTDI, Showven) and grant access from the DMX
                Output panel. WebSerial only works in Chrome/Edge desktop or Android — not inside the editor iframe.
              </p>
              {!isWebSerialSupported() && (
                <div className="mt-2 flex items-center gap-1.5 text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span className="text-[11px]">WebSerial unavailable in this browser/context.</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Advanced */}
        <section className="space-y-4 rounded-lg border border-border bg-card p-4">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Advanced
          </Label>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="failover" className="text-sm">Auto failover</Label>
              <p className="text-[11px] text-muted-foreground">
                Switch to next transport if active link drops (Art-Net → sACN → Serial)
              </p>
            </div>
            <Switch id="failover" checked={autoFailover} onCheckedChange={setAutoFailover} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="poll" className="text-xs">
              Poll interval — {pollIntervalMs} ms
            </Label>
            <Input
              id="poll"
              type="number"
              min={250}
              max={10000}
              step={250}
              value={pollIntervalMs}
              onChange={(e) => setPollIntervalMs(Math.max(250, Number(e.target.value) || 1000))}
              className="font-mono text-sm w-32"
            />
          </div>
        </section>

        {/* Test */}
        <section className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Connection Test
            </Label>
            <Button onClick={runTest} disabled={test.status === "running"} size="sm">
              {test.status === "running" ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Testing…</>
              ) : (
                <><Activity className="w-3.5 h-3.5 mr-1.5" /> Run test</>
              )}
            </Button>
          </div>

          {test.status !== "idle" && (
            <div
              className={`rounded-md border p-3 flex items-start gap-2 ${
                test.status === "ok"
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : test.status === "fail"
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-border bg-muted/20"
              }`}
              role="status"
              aria-live="polite"
            >
              {test.status === "ok" && <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />}
              {test.status === "fail" && <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />}
              {test.status === "running" && <Loader2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0 animate-spin" />}
              <div className="text-xs space-y-0.5 min-w-0 flex-1">
                <p className="font-semibold text-foreground">
                  {test.message ?? (test.status === "running" ? "Probing endpoint…" : "")}
                </p>
                {test.detail && <p className="text-muted-foreground break-all">{test.detail}</p>}
                {typeof test.latencyMs === "number" && (
                  <p className="text-[10px] text-muted-foreground/70 font-mono">
                    Round-trip: {test.latencyMs} ms
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={handleReset}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset
          </Button>
          <Button onClick={handleSave}>
            <Save className="w-3.5 h-3.5 mr-1.5" /> Save
          </Button>
        </div>
      </div>
    </div>
  );
}

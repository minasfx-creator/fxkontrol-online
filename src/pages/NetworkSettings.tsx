/**
 * ─── Network Settings ──────────────────────────────────────────────
 * Configure transport protocol (Art-Net / sACN), endpoint hostname/port,
 * optional WebSocket relay, and run a real connectivity test against
 * the configured node via the artnet-bridge edge function.
 *
 * Persists to localStorage via useNetworkConfigStore.
 */
import { useState, useCallback } from "react";
import {
  Network, Wifi, Activity, Save, RotateCcw, Loader2,
  CheckCircle2, XCircle, AlertTriangle, Lightbulb, Copy, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useShallow } from 'zustand/react/shallow';
import {
  useNetworkConfigStore,
  defaultPortForProtocol,
  type TransportProtocol,
} from "@/store/useNetworkConfigStore";

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
];

export default function NetworkSettings() {
  const {
    protocol, endpoint, autoFailover, pollIntervalMs,
    setProtocol, setEndpoint, setAutoFailover, setPollIntervalMs, reset,
  } = useNetworkConfigStore(useShallow((s) => ({
    protocol: s.protocol, endpoint: s.endpoint, autoFailover: s.autoFailover, pollIntervalMs: s.pollIntervalMs,
    setProtocol: s.setProtocol, setEndpoint: s.setEndpoint, setAutoFailover: s.setAutoFailover, setPollIntervalMs: s.setPollIntervalMs, reset: s.reset,
  })));

  const [test, setTest] = useState<TestResult>(EMPTY_RESULT);

  const handleProtocolChange = (p: TransportProtocol) => {
    setProtocol(p);
    if (endpoint.port === 0 || [6454, 5568].includes(endpoint.port)) {
      setEndpoint({ port: defaultPortForProtocol(p) });
    }
  };

  const handleSave = () => {
    toast.success("Network settings saved", {
      description: `${protocol.toUpperCase()} → ${endpoint.hostname}:${endpoint.port}`,
    });
  };

  const handleReset = () => {
    reset();
    setTest(EMPTY_RESULT);
    toast.info("Restored default network settings");
  };

  const runTest = useCallback(async () => {
    const startedAt = performance.now();
    const steps: TestStep[] = [
      { id: "validate", label: "Validate endpoint", status: "pending" },
      { id: "edge", label: "Reach artnet-bridge edge function", status: "pending" },
      { id: "probe", label: `Probe ${endpoint.hostname}:${endpoint.port}`, status: "pending" },
      { id: "reply", label: "Wait for ArtPoll replies", status: "pending" },
    ];

    setTest({ status: "running", steps });

    const updateStep = (id: string, patch: Partial<TestStep>) =>
      setTest((prev) => ({
        ...prev,
        steps: prev.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      }));

    const runStep = async <T,>(id: string, fn: () => Promise<T> | T): Promise<T> => {
      const t0 = performance.now();
      updateStep(id, { status: "running" });
      try {
        const result = await fn();
        updateStep(id, { status: "ok", durationMs: Math.round(performance.now() - t0) });
        return result;
      } catch (err) {
        updateStep(id, {
          status: "fail",
          durationMs: Math.round(performance.now() - t0),
          detail: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    };

    try {
      await runStep("validate", () => {
        if (!endpoint.hostname.trim()) throw new Error("Hostname is required");
        if (endpoint.port < 1 || endpoint.port > 65535) throw new Error("Port must be 1–65535");
        return true;
      });

      const { data } = await runStep("edge", async () => {
        const r = await supabase.functions.invoke("artnet-bridge", {
          body: { action: "poll", targetIp: endpoint.hostname, targetPort: endpoint.port },
        });
        if (r.error) throw new Error(r.error.message ?? "Edge function error");
        return r;
      });

      await runStep("probe", () => {
        if (!data || (data.success !== true && data.ok !== true && !Array.isArray(data.nodes))) {
          throw new Error(typeof data?.error === "string" ? data.error : "Bridge returned an unexpected payload");
        }
        return true;
      });

      const replies = await runStep("reply", () => {
        const nodes: unknown[] = Array.isArray(data?.nodes) ? data.nodes : [];
        return nodes.length;
      });

      const totalMs = Math.round(performance.now() - startedAt);
      setTest((prev) => ({
        ...prev,
        status: "ok",
        latencyMs: totalMs,
        message: `Reachable via ${protocol.toUpperCase()}`,
        detail: replies > 0
          ? `${replies} Art-Net node(s) replied to ArtPoll.`
          : "Bridge responded successfully. No ArtPoll replies received — verify the node is on the same subnet and broadcasts are allowed.",
        raw: data,
      }));
      toast.success("Connection test passed", { description: `${protocol.toUpperCase()} • ${totalMs} ms` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const totalMs = Math.round(performance.now() - startedAt);
      setTest((prev) => ({
        ...prev,
        status: "fail",
        latencyMs: totalMs,
        message: "Connection test failed",
        detail: message,
        hint: diagnoseError(message, protocol),
        steps: prev.steps.map((s) => (s.status === "pending" ? { ...s, status: "skip" } : s)),
      }));
      toast.error("Connection test failed", { description: message });
    }
  }, [protocol, endpoint]);

  /** Build a human-readable plain-text report of the last test run. */
  const buildReportText = useCallback((): string => {
    const ts = new Date().toISOString();
    const stepLines = test.steps.map((s) => {
      const status = s.status.toUpperCase().padEnd(7);
      const dur = typeof s.durationMs === "number" ? `${s.durationMs} ms`.padStart(8) : "       —";
      const detail = s.detail ? `\n         └─ ${s.detail}` : "";
      return `  [${status}] ${dur}  ${s.label}${detail}`;
    }).join("\n");

    return [
      "FX KONTROL — Connection Report",
      "================================",
      `Timestamp:    ${ts}`,
      `Result:       ${test.status.toUpperCase()}`,
      `Protocol:     ${protocol.toUpperCase()}`,
      `Target:       ${endpoint.hostname}:${endpoint.port}`,
      endpoint.wsRelayUrl ? `WS Relay:     ${endpoint.wsRelayUrl}` : `WS Relay:     (none — using edge function)`,
      `Total RTT:    ${typeof test.latencyMs === "number" ? `${test.latencyMs} ms` : "—"}`,
      `Summary:      ${test.message ?? "—"}`,
      test.detail ? `Detail:       ${test.detail}` : "",
      test.hint ? `Hint:         ${test.hint}` : "",
      "",
      "Steps:",
      stepLines || "  (none)",
      "",
      `User-Agent:   ${navigator.userAgent}`,
    ].filter(Boolean).join("\n");
  }, [protocol, endpoint, test]);

  const copyReport = useCallback(() => {
    navigator.clipboard.writeText(buildReportText()).then(
      () => toast.success("Report copied to clipboard"),
      () => toast.error("Couldn't access clipboard"),
    );
  }, [buildReportText]);

  const copyDiagnostics = useCallback(() => {
    const payload = {
      timestamp: new Date().toISOString(),
      protocol,
      endpoint,
      result: test,
      userAgent: navigator.userAgent,
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).then(
      () => toast.success("Diagnostics JSON copied"),
      () => toast.error("Couldn't access clipboard"),
    );
  }, [protocol, endpoint, test]);

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
                Configure real hardware transport — Art-Net or sACN over IP
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
          <div className="grid sm:grid-cols-2 gap-2">
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

        {/* Advanced */}
        <section className="space-y-4 rounded-lg border border-border bg-card p-4">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Advanced
          </Label>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="failover" className="text-sm">Auto failover</Label>
              <p className="text-[11px] text-muted-foreground">
                Switch to the alternate transport if the active link drops (Art-Net ↔ sACN)
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
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Connection Test
            </Label>
            <div className="flex items-center gap-2">
              {test.status === "fail" || test.status === "ok" ? (
                <>
                  <Button variant="ghost" size="sm" onClick={copyReport} className="text-[11px]">
                    <FileText className="w-3.5 h-3.5 mr-1.5" /> Copy report
                  </Button>
                  <Button variant="ghost" size="sm" onClick={copyDiagnostics} className="text-[11px]">
                    <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy JSON
                  </Button>
                </>
              ) : null}
              <Button
                onClick={runTest}
                disabled={test.status === "running"}
                size="sm"
                aria-label="Run connection test"
              >
                {test.status === "running" ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Testing…</>
                ) : (
                  <><Activity className="w-3.5 h-3.5 mr-1.5" /> Test Connection</>
                )}
              </Button>
            </div>
          </div>

          {test.status === "idle" ? (
            <p className="text-[11px] text-muted-foreground">
              Runs a real probe against the configured endpoint and reports each step.
            </p>
          ) : (
            <div role="status" aria-live="polite" className="space-y-3">
              {/* Summary banner */}
              <div
                className={`rounded-md border p-3 flex items-start gap-2 ${
                  test.status === "ok"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : test.status === "fail"
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-border bg-muted/20"
                }`}
              >
                {test.status === "ok" && <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />}
                {test.status === "fail" && <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />}
                {test.status === "running" && <Loader2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0 animate-spin" />}
                <div className="text-xs space-y-0.5 min-w-0 flex-1">
                  <p className="font-semibold text-foreground">
                    {test.message ?? (test.status === "running" ? "Probing endpoint…" : "")}
                  </p>
                  {test.detail && <p className="text-muted-foreground break-words">{test.detail}</p>}
                  {typeof test.latencyMs === "number" && (
                    <p className="text-[10px] text-muted-foreground/70 font-mono">
                      Total: {test.latencyMs} ms
                    </p>
                  )}
                </div>
              </div>

              {/* Step list */}
              <ol className="space-y-1.5">
                {test.steps.map((step) => {
                  const Icon =
                    step.status === "ok" ? CheckCircle2 :
                    step.status === "fail" ? XCircle :
                    step.status === "running" ? Loader2 :
                    step.status === "skip" ? AlertTriangle :
                    Activity;
                  const color =
                    step.status === "ok" ? "text-emerald-400" :
                    step.status === "fail" ? "text-destructive" :
                    step.status === "running" ? "text-primary" :
                    step.status === "skip" ? "text-muted-foreground/50" :
                    "text-muted-foreground/40";
                  return (
                    <li key={step.id} className="flex items-start gap-2 text-xs">
                      <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${color} ${step.status === "running" ? "animate-spin" : ""}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className={step.status === "skip" ? "text-muted-foreground/60 line-through" : "text-foreground"}>
                            {step.label}
                          </span>
                          {typeof step.durationMs === "number" && (
                            <span className="text-[10px] font-mono text-muted-foreground/70">{step.durationMs} ms</span>
                          )}
                        </div>
                        {step.detail && (
                          <p className="text-[10px] text-muted-foreground/80 break-words mt-0.5">{step.detail}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>

              {/* Actionable hint on failure */}
              {test.status === "fail" && test.hint && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 flex items-start gap-2">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-amber-100/90 leading-relaxed">{test.hint}</p>
                </div>
              )}

              {/* Detailed connection report (terminal status only) */}
              {(test.status === "ok" || test.status === "fail") && (
                <div className="rounded-md border border-border bg-muted/10 overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/20">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Connection Report
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={copyReport}
                      aria-label="Copy connection report"
                    >
                      <Copy className="w-3 h-3 mr-1" /> Copy
                    </Button>
                  </div>

                  {/* Key/value summary grid */}
                  <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 px-3 py-2.5 text-[11px]">
                    <dt className="text-muted-foreground">Result</dt>
                    <dd className={`font-mono font-semibold ${test.status === "ok" ? "text-emerald-400" : "text-destructive"}`}>
                      {test.status.toUpperCase()}
                    </dd>

                    <dt className="text-muted-foreground">Protocol</dt>
                    <dd className="font-mono text-foreground">{protocol.toUpperCase()}</dd>

                    <dt className="text-muted-foreground">Target</dt>
                    <dd className="font-mono text-foreground break-all">
                      {endpoint.hostname}:{endpoint.port}
                    </dd>

                    <dt className="text-muted-foreground">WS Relay</dt>
                    <dd className="font-mono text-foreground break-all">
                      {endpoint.wsRelayUrl || <span className="text-muted-foreground/60">edge function</span>}
                    </dd>

                    <dt className="text-muted-foreground">Total RTT</dt>
                    <dd className="font-mono text-foreground">
                      {typeof test.latencyMs === "number" ? `${test.latencyMs} ms` : "—"}
                    </dd>

                    <dt className="text-muted-foreground">Timestamp</dt>
                    <dd className="font-mono text-foreground/80 text-[10px]">
                      {new Date().toISOString()}
                    </dd>
                  </dl>

                  {/* Per-step latency breakdown */}
                  {test.steps.length > 0 && (
                    <div className="border-t border-border px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Step latency
                      </p>
                      <ul className="space-y-0.5">
                        {test.steps.map((s) => (
                          <li key={s.id} className="flex items-baseline justify-between gap-3 text-[10px] font-mono">
                            <span className="text-foreground/80 truncate">
                              <span
                                className={
                                  s.status === "ok" ? "text-emerald-400" :
                                  s.status === "fail" ? "text-destructive" :
                                  s.status === "skip" ? "text-muted-foreground/60" :
                                  "text-muted-foreground"
                                }
                              >
                                ●
                              </span>{" "}
                              {s.label}
                            </span>
                            <span className="text-muted-foreground/80 shrink-0">
                              {typeof s.durationMs === "number" ? `${s.durationMs} ms` : "—"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
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

/**
 * ─── Diagnostics Report Generator ───────────────────────────────────
 * Sumariza estado de endereçamento DMX/SFX em JSON/CSV/PDF.
 * Reusa as mesmas regras de validação aplicadas em /diagnostics/dmx-pyro.
 */
import jsPDF from "jspdf";
import type { SFXChannel } from "@/components/editor/live-firing/types";
import { SFX_TYPES } from "@/components/editor/live-firing/constants";
import type { DiagnosticsThresholds } from "@/store/useDiagnosticsThresholds";

const VALID_SFX_TYPES = new Set<string>(SFX_TYPES.map((t) => t.key));

export type Severity = "ok" | "warn" | "fail";

export interface ReportFinding {
  id: string;
  severity: Severity;
  category: "overlap" | "out-of-range" | "duplicate-id" | "invalid-type" | "gap" | "universe-cap" | "universe-gap" | "universe-start" | "invalid-value";
  message: string;
  hint?: string;
  universe?: number;
  channelIds?: string[];
}

export interface UniverseSummary {
  universe: number;
  fixtureCount: number;
  channelsUsed: number;
  occupancyPct: number;
  firstAddress: number;
  lastAddress: number;
  largestGap: number;
}

export interface DiagnosticsReport {
  generatedAt: string;
  showName: string;
  thresholds: DiagnosticsThresholds;
  totals: {
    channels: number;
    universes: number;
    locked: number;
    disabled: number;
    findings: { ok: number; warn: number; fail: number };
  };
  universes: UniverseSummary[];
  findings: ReportFinding[];
  channels: Array<{
    id: string;
    name: string;
    type: string;
    universe: number;
    address: number;
    width: number;
    locked: boolean;
    enabled: boolean;
    manufacturer?: string;
  }>;
}

// ─── Validation (mirrors DmxPyroDiagnostics.validateChannels) ─────

export function buildReport(
  channels: SFXChannel[],
  thresholds: DiagnosticsThresholds,
  showName = "Untitled Show",
): DiagnosticsReport {
  const findings: ReportFinding[] = [];
  const seenIds = new Set<string>();

  for (const c of channels) {
    if (seenIds.has(c.id)) {
      findings.push({
        id: `dup-${c.id}`,
        severity: "fail",
        category: "duplicate-id",
        message: `Canal "${c.name}" tem ID duplicado (${c.id}).`,
        hint: "Renomeie ou regenere o ID do canal.",
        channelIds: [c.id],
      });
    }
    seenIds.add(c.id);

    if (!VALID_SFX_TYPES.has(c.type)) {
      findings.push({
        id: `type-${c.id}`,
        severity: "warn",
        category: "invalid-type",
        message: `Canal "${c.name}" usa tipo SFX desconhecido: "${c.type}".`,
        channelIds: [c.id],
      });
    }
    if (c.dmxAddress < 1 || c.dmxAddress > 512 || c.dmxAddress + c.dmxChannels - 1 > 512) {
      findings.push({
        id: `range-${c.id}`,
        severity: "fail",
        category: "out-of-range",
        message: `Canal "${c.name}" U${c.dmxUniverse} ch ${c.dmxAddress}+${c.dmxChannels} fora do range 1–512.`,
        universe: c.dmxUniverse,
        channelIds: [c.id],
      });
    }
    if (c.dmxChannels < 1 || !Number.isFinite(c.dmxChannels)) {
      findings.push({
        id: `width-${c.id}`,
        severity: "fail",
        category: "invalid-value",
        message: `Canal "${c.name}" tem largura DMX inválida: ${c.dmxChannels}.`,
        channelIds: [c.id],
      });
    }
  }

  const universesMap = new Map<number, SFXChannel[]>();
  for (const c of channels) {
    if (!universesMap.has(c.dmxUniverse)) universesMap.set(c.dmxUniverse, []);
    universesMap.get(c.dmxUniverse)!.push(c);
  }

  const universeSummaries: UniverseSummary[] = [];

  for (const [universe, list] of universesMap) {
    const sorted = [...list].sort((a, b) => a.dmxAddress - b.dmxAddress);

    // Overlaps
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];
        const aEnd = a.dmxAddress + a.dmxChannels - 1;
        if (b.dmxAddress <= aEnd) {
          findings.push({
            id: `ovl-${a.id}-${b.id}`,
            severity: "fail",
            category: "overlap",
            message: `Overlap em U${universe}: "${a.name}" (ch ${a.dmxAddress}–${aEnd}) ↔ "${b.name}" (ch ${b.dmxAddress}).`,
            hint: "Re-endereçar um dos fixtures.",
            universe,
            channelIds: [a.id, b.id],
          });
        }
      }
    }

    // Gaps
    let largestGap = 0;
    for (let i = 1; i < sorted.length; i++) {
      const prevEnd = sorted[i - 1].dmxAddress + sorted[i - 1].dmxChannels - 1;
      const gap = sorted[i].dmxAddress - prevEnd - 1;
      if (gap > largestGap) largestGap = gap;
      if (gap >= thresholds.addressGap) {
        findings.push({
          id: `gap-${universe}-${sorted[i].id}`,
          severity: "warn",
          category: "gap",
          message: `Gap de ${gap} canais em U${universe} entre "${sorted[i - 1].name}" e "${sorted[i].name}".`,
          hint: `Limite atual: ${thresholds.addressGap}. Compactar libera ${gap} endereços.`,
          universe,
          channelIds: [sorted[i - 1].id, sorted[i].id],
        });
      }
    }

    // Cap
    const totalUsed = sorted.reduce((s, c) => s + c.dmxChannels, 0);
    const occupancyPct = (totalUsed / 512) * 100;
    if (occupancyPct >= thresholds.universeCapPct) {
      findings.push({
        id: `cap-${universe}`,
        severity: "warn",
        category: "universe-cap",
        message: `U${universe} está ${occupancyPct.toFixed(1)}% ocupado (${totalUsed}/512).`,
        hint: `Acima do limite ${thresholds.universeCapPct}%.`,
        universe,
      });
    }

    universeSummaries.push({
      universe,
      fixtureCount: sorted.length,
      channelsUsed: totalUsed,
      occupancyPct,
      firstAddress: sorted[0]?.dmxAddress ?? 0,
      lastAddress: sorted.length
        ? sorted[sorted.length - 1].dmxAddress + sorted[sorted.length - 1].dmxChannels - 1
        : 0,
      largestGap,
    });
  }

  // Universe-level checks
  const usedUniverses = Array.from(universesMap.keys()).sort((a, b) => a - b);
  for (let i = 1; i < usedUniverses.length; i++) {
    const skip = usedUniverses[i] - usedUniverses[i - 1] - 1;
    if (skip > thresholds.universeGap) {
      findings.push({
        id: `uni-gap-${usedUniverses[i]}`,
        severity: "warn",
        category: "universe-gap",
        message: `Pulou ${skip} universe(s) entre U${usedUniverses[i - 1]} e U${usedUniverses[i]}.`,
        hint: `Limite atual: ${thresholds.universeGap}.`,
      });
    }
  }
  if (usedUniverses.length > 0 && usedUniverses[0] > thresholds.universeStartHint) {
    findings.push({
      id: "uni-start",
      severity: "warn",
      category: "universe-start",
      message: `Primeiro universe em uso é U${usedUniverses[0]} — esperado ≤ U${thresholds.universeStartHint}.`,
    });
  }

  const counts = { ok: 0, warn: 0, fail: 0 };
  for (const f of findings) counts[f.severity]++;

  return {
    generatedAt: new Date().toISOString(),
    showName,
    thresholds,
    totals: {
      channels: channels.length,
      universes: universesMap.size,
      locked: channels.filter((c) => c.locked).length,
      disabled: channels.filter((c) => c.enabled === false).length,
      findings: counts,
    },
    universes: universeSummaries.sort((a, b) => a.universe - b.universe),
    findings,
    channels: channels.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      universe: c.dmxUniverse,
      address: c.dmxAddress,
      width: c.dmxChannels,
      locked: c.locked,
      enabled: c.enabled !== false,
      manufacturer: c.manufacturer,
    })),
  };
}

// ─── Exporters ────────────────────────────────────────────────────

function downloadBlob(data: BlobPart, filename: string, mime: string) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ts() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportReportJSON(report: DiagnosticsReport): void {
  downloadBlob(JSON.stringify(report, null, 2), `diagnostics-${ts()}.json`, "application/json");
}

export function exportReportCSV(report: DiagnosticsReport): void {
  const lines: string[] = [];
  lines.push("# DMX/Pyro Diagnostics Report");
  lines.push(`# Generated: ${report.generatedAt}`);
  lines.push(`# Show: ${report.showName}`);
  lines.push("");

  lines.push("## Totals");
  lines.push("metric,value");
  lines.push(`channels,${report.totals.channels}`);
  lines.push(`universes,${report.totals.universes}`);
  lines.push(`locked,${report.totals.locked}`);
  lines.push(`disabled,${report.totals.disabled}`);
  lines.push(`findings_ok,${report.totals.findings.ok}`);
  lines.push(`findings_warn,${report.totals.findings.warn}`);
  lines.push(`findings_fail,${report.totals.findings.fail}`);
  lines.push("");

  lines.push("## Universes");
  lines.push("universe,fixtures,channels_used,occupancy_pct,first_address,last_address,largest_gap");
  for (const u of report.universes) {
    lines.push(
      [u.universe, u.fixtureCount, u.channelsUsed, u.occupancyPct.toFixed(2), u.firstAddress, u.lastAddress, u.largestGap]
        .map(csvEscape)
        .join(","),
    );
  }
  lines.push("");

  lines.push("## Findings");
  lines.push("severity,category,universe,message,hint,channel_ids");
  for (const f of report.findings) {
    lines.push(
      [f.severity, f.category, f.universe ?? "", f.message, f.hint ?? "", (f.channelIds ?? []).join("|")]
        .map(csvEscape)
        .join(","),
    );
  }
  lines.push("");

  lines.push("## Channels");
  lines.push("id,name,type,universe,address,width,end_address,locked,enabled,manufacturer");
  for (const c of report.channels) {
    lines.push(
      [c.id, c.name, c.type, c.universe, c.address, c.width, c.address + c.width - 1, c.locked, c.enabled, c.manufacturer ?? ""]
        .map(csvEscape)
        .join(","),
    );
  }

  downloadBlob(lines.join("\n"), `diagnostics-${ts()}.csv`, "text/csv");
}

export function exportReportPDF(report: DiagnosticsReport): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  let y = M;

  const ensureSpace = (need: number) => {
    if (y + need > H - M) {
      doc.addPage();
      y = M;
    }
  };

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("DMX / Pyro Diagnostics Report", M, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Show: ${report.showName}`, M, y);
  doc.text(`Generated: ${new Date(report.generatedAt).toLocaleString()}`, W - M, y, { align: "right" });
  y += 14;
  doc.setDrawColor(200);
  doc.line(M, y, W - M, y);
  y += 16;
  doc.setTextColor(0);

  // Totals
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Summary", M, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const summary = [
    `Channels: ${report.totals.channels}`,
    `Universes: ${report.totals.universes}`,
    `Locked: ${report.totals.locked}`,
    `Disabled: ${report.totals.disabled}`,
    `OK: ${report.totals.findings.ok}   Warn: ${report.totals.findings.warn}   Fail: ${report.totals.findings.fail}`,
  ];
  for (const s of summary) {
    doc.text(s, M, y);
    y += 12;
  }
  y += 6;

  // Thresholds
  doc.setFont("helvetica", "bold");
  doc.text("Thresholds in effect", M, y);
  y += 12;
  doc.setFont("helvetica", "normal");
  doc.text(
    `addressGap≥${report.thresholds.addressGap}   universeGap>${report.thresholds.universeGap}   universeCap≥${report.thresholds.universeCapPct}%   universeStart≤${report.thresholds.universeStartHint}`,
    M,
    y,
  );
  y += 18;

  // Universes table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Universes", M, y);
  y += 14;
  doc.setFontSize(8);
  const uniHeaders = ["U#", "Fixt.", "Used", "Occ.%", "First", "Last", "Gap"];
  const uniColW = [40, 50, 60, 60, 60, 60, 60];
  let x = M;
  doc.setFillColor(230, 230, 230);
  doc.rect(M, y - 9, uniColW.reduce((a, b) => a + b, 0), 12, "F");
  uniHeaders.forEach((h, i) => {
    doc.text(h, x + 4, y);
    x += uniColW[i];
  });
  y += 4;
  doc.setFont("helvetica", "normal");
  for (const u of report.universes) {
    ensureSpace(14);
    y += 10;
    x = M;
    const row = [
      `U${u.universe}`,
      String(u.fixtureCount),
      String(u.channelsUsed),
      `${u.occupancyPct.toFixed(1)}%`,
      String(u.firstAddress),
      String(u.lastAddress),
      String(u.largestGap),
    ];
    row.forEach((v, i) => {
      doc.text(v, x + 4, y);
      x += uniColW[i];
    });
  }
  y += 16;

  // Findings
  ensureSpace(40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Findings (${report.findings.length})`, M, y);
  y += 14;
  doc.setFontSize(8);
  if (report.findings.length === 0) {
    doc.setTextColor(0, 128, 0);
    doc.text("No issues detected.", M, y);
    doc.setTextColor(0);
    y += 14;
  } else {
    for (const f of report.findings) {
      ensureSpace(28);
      const color: [number, number, number] =
        f.severity === "fail" ? [200, 40, 40] : f.severity === "warn" ? [200, 140, 0] : [0, 128, 0];
      doc.setTextColor(...color);
      doc.setFont("helvetica", "bold");
      doc.text(`[${f.severity.toUpperCase()}] ${f.category}`, M, y);
      doc.setTextColor(0);
      doc.setFont("helvetica", "normal");
      y += 11;
      const msgLines = doc.splitTextToSize(f.message, W - 2 * M);
      doc.text(msgLines, M, y);
      y += msgLines.length * 10;
      if (f.hint) {
        doc.setTextColor(110);
        const hintLines = doc.splitTextToSize(`↳ ${f.hint}`, W - 2 * M);
        doc.text(hintLines, M, y);
        y += hintLines.length * 10;
        doc.setTextColor(0);
      }
      y += 4;
    }
  }

  // Channels (compact)
  doc.addPage();
  y = M;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Channels (${report.channels.length})`, M, y);
  y += 14;
  doc.setFontSize(7);
  const chHeaders = ["Name", "Type", "Uni", "Addr", "W", "End", "Lock", "En."];
  const chColW = [140, 60, 30, 40, 30, 40, 40, 40];
  doc.setFillColor(230, 230, 230);
  doc.rect(M, y - 8, chColW.reduce((a, b) => a + b, 0), 11, "F");
  x = M;
  chHeaders.forEach((h, i) => {
    doc.text(h, x + 3, y);
    x += chColW[i];
  });
  y += 4;
  doc.setFont("helvetica", "normal");
  for (const c of report.channels) {
    ensureSpace(12);
    y += 9;
    x = M;
    const row = [
      c.name.length > 22 ? c.name.slice(0, 21) + "…" : c.name,
      c.type,
      `U${c.universe}`,
      String(c.address),
      String(c.width),
      String(c.address + c.width - 1),
      c.locked ? "Y" : "—",
      c.enabled ? "Y" : "—",
    ];
    row.forEach((v, i) => {
      doc.text(v, x + 3, y);
      x += chColW[i];
    });
  }

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`Page ${p} of ${pageCount}`, W - M, H - 20, { align: "right" });
    doc.text("FX KONTROL · Diagnostics", M, H - 20);
  }

  doc.save(`diagnostics-${ts()}.pdf`);
}

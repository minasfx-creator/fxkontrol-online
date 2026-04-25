/**
 * scripts/audit-landing-seo.ts
 * ─────────────────────────────────────────────────────────────────
 * Auditoria automática das tags SEO/OG/Twitter/Canonical/JSON-LD
 * da rota `/landing` para cada variante de target (web | mobile | both).
 *
 * Estratégia:
 *  - Monta um JSDOM por variante apontando para `?target=<variant>`.
 *  - Renderiza <Landing/> com react-dom/client dentro do DOM do JSDOM.
 *  - Aguarda o useEffect popular o <head> (microtasks + 1 frame).
 *  - Coleta tags relevantes e valida contra um checklist canônico.
 *  - Gera relatório Markdown em /mnt/documents/landing-seo-audit.md
 *    e versão JSON em /mnt/documents/landing-seo-audit.json.
 *
 * Uso:
 *   bunx tsx scripts/audit-landing-seo.ts
 *   # ou: bun run scripts/audit-landing-seo.ts
 */
import { JSDOM } from "jsdom";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

type Target = "web" | "mobile" | "both";
const TARGETS: Target[] = ["web", "mobile", "both"];

const EXPECTED_CANONICAL = "https://fxkontrol.online/landing";
const EXPECTED_TITLE_RE = /FX KONTROL/i;
const EXPECTED_DESC_MIN = 80;
const EXPECTED_DESC_MAX = 200;

interface Check {
  name: string;
  pass: boolean;
  detail: string;
}

interface VariantReport {
  target: Target;
  url: string;
  checks: Check[];
  rawHead: Record<string, string | undefined>;
  passCount: number;
  failCount: number;
}

async function auditVariant(target: Target): Promise<VariantReport> {
  const url = `https://fxkontrol.online/landing?target=${target}`;
  const dom = new JSDOM(
    `<!doctype html><html><head><title>boot</title></head><body><div id="root"></div></body></html>`,
    { url, pretendToBeVisual: true, runScripts: "outside-only" },
  );

  // Expose JSDOM globals so React can mount.
  const g = globalThis as any;
  g.window = dom.window;
  g.document = dom.window.document;
  g.navigator = dom.window.navigator;
  g.HTMLElement = dom.window.HTMLElement;
  g.Element = dom.window.Element;
  g.Node = dom.window.Node;
  g.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(Date.now()), 16) as unknown as number;
  g.cancelAnimationFrame = (id: number) => clearTimeout(id as any);
  g.matchMedia = () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    media: "",
    onchange: null,
  });

  // Lazy import after globals are set so React hooks see the DOM.
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { MemoryRouter } = await import("react-router-dom");
  const { default: Landing } = await import("../src/pages/Landing");

  const root = createRoot(dom.window.document.getElementById("root")!);
  root.render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [`/landing?target=${target}`] },
      React.createElement(Landing),
    ),
  );

  // Wait for useEffect + head injection.
  await new Promise((r) => setTimeout(r, 100));

  const head = dom.window.document.head;
  const get = (sel: string) =>
    head.querySelector(sel)?.getAttribute("content") ?? undefined;
  const getHref = (sel: string) =>
    head.querySelector(sel)?.getAttribute("href") ?? undefined;
  const ld = head.querySelector('script[type="application/ld+json"]')?.textContent ?? undefined;

  const raw = {
    title: dom.window.document.title,
    description: get('meta[name="description"]'),
    robots: get('meta[name="robots"]'),
    keywords: get('meta[name="keywords"]'),
    canonical: getHref('link[rel="canonical"]'),
    ogType: get('meta[property="og:type"]'),
    ogTitle: get('meta[property="og:title"]'),
    ogDescription: get('meta[property="og:description"]'),
    ogImage: get('meta[property="og:image"]'),
    ogUrl: get('meta[property="og:url"]'),
    ogLocale: get('meta[property="og:locale"]'),
    twitterCard: get('meta[name="twitter:card"]'),
    twitterTitle: get('meta[name="twitter:title"]'),
    twitterImage: get('meta[name="twitter:image"]'),
    jsonLd: ld,
  };

  const checks: Check[] = [
    {
      name: "title contém FX KONTROL",
      pass: EXPECTED_TITLE_RE.test(raw.title ?? ""),
      detail: raw.title ?? "(vazio)",
    },
    {
      name: "description definida (80-200 chars)",
      pass:
        !!raw.description &&
        raw.description.length >= EXPECTED_DESC_MIN &&
        raw.description.length <= EXPECTED_DESC_MAX,
      detail: `${raw.description?.length ?? 0} chars`,
    },
    { name: "robots = index,follow", pass: raw.robots === "index,follow", detail: raw.robots ?? "(ausente)" },
    { name: "keywords definidas", pass: !!raw.keywords && raw.keywords.length > 10, detail: `${raw.keywords?.length ?? 0} chars` },
    { name: "canonical = produção", pass: raw.canonical === EXPECTED_CANONICAL, detail: raw.canonical ?? "(ausente)" },
    { name: "og:type = website", pass: raw.ogType === "website", detail: raw.ogType ?? "(ausente)" },
    { name: "og:title presente", pass: !!raw.ogTitle, detail: raw.ogTitle ?? "(ausente)" },
    { name: "og:description presente", pass: !!raw.ogDescription, detail: raw.ogDescription ? `${raw.ogDescription.length} chars` : "(ausente)" },
    { name: "og:image (https + extensão imagem)", pass: !!raw.ogImage && /^https:\/\/.+\.(png|jpe?g|webp|avif)/i.test(raw.ogImage), detail: raw.ogImage ?? "(ausente)" },
    { name: "og:url = canonical", pass: raw.ogUrl === EXPECTED_CANONICAL, detail: raw.ogUrl ?? "(ausente)" },
    { name: "og:locale = pt_BR", pass: raw.ogLocale === "pt_BR", detail: raw.ogLocale ?? "(ausente)" },
    { name: "twitter:card = summary_large_image", pass: raw.twitterCard === "summary_large_image", detail: raw.twitterCard ?? "(ausente)" },
    { name: "twitter:title presente", pass: !!raw.twitterTitle, detail: raw.twitterTitle ?? "(ausente)" },
    { name: "twitter:image presente", pass: !!raw.twitterImage, detail: raw.twitterImage ?? "(ausente)" },
    { name: "JSON-LD WebPage válido", pass: !!raw.jsonLd && (() => { try { const j = JSON.parse(raw.jsonLd!); return j["@type"] === "WebPage" && !!j.name && !!j.url; } catch { return false; } })(), detail: raw.jsonLd ? "presente" : "(ausente)" },
  ];

  root.unmount();
  dom.window.close();

  return {
    target,
    url,
    checks,
    rawHead: raw,
    passCount: checks.filter((c) => c.pass).length,
    failCount: checks.filter((c) => !c.pass).length,
  };
}

function renderMarkdown(reports: VariantReport[]): string {
  const ts = new Date().toISOString();
  const totalChecks = reports.reduce((s, r) => s + r.checks.length, 0);
  const totalPass = reports.reduce((s, r) => s + r.passCount, 0);
  const status = totalPass === totalChecks ? "✅ APROVADO" : "⚠️ FALHAS DETECTADAS";

  let md = `# Auditoria SEO — /landing\n\n`;
  md += `**Status global:** ${status}  \n`;
  md += `**Resultado:** ${totalPass}/${totalChecks} checks aprovados  \n`;
  md += `**Variantes auditadas:** ${reports.map((r) => `\`${r.target}\``).join(", ")}  \n`;
  md += `**Gerado em:** ${ts}\n\n---\n\n`;

  for (const r of reports) {
    const icon = r.failCount === 0 ? "✅" : "⚠️";
    md += `## ${icon} target = \`${r.target}\` (${r.passCount}/${r.checks.length})\n\n`;
    md += `**URL auditada:** \`${r.url}\`\n\n`;
    md += `| Check | Status | Detalhe |\n|---|:---:|---|\n`;
    for (const c of r.checks) {
      const detail = c.detail.length > 80 ? c.detail.slice(0, 77) + "…" : c.detail;
      md += `| ${c.name} | ${c.pass ? "✅" : "❌"} | \`${detail.replace(/\|/g, "\\|")}\` |\n`;
    }
    md += `\n<details><summary>Tags brutas coletadas</summary>\n\n\`\`\`json\n${JSON.stringify(r.rawHead, null, 2)}\n\`\`\`\n\n</details>\n\n---\n\n`;
  }

  md += `\n_Relatório gerado por \`scripts/audit-landing-seo.ts\` — auditoria estática do \`<head>\` após render React + useEffect via JSDOM._\n`;
  return md;
}

async function main() {
  console.log("[audit-landing-seo] iniciando auditoria das 3 variantes…\n");
  const reports: VariantReport[] = [];
  for (const t of TARGETS) {
    process.stdout.write(`  • target=${t.padEnd(7)} `);
    try {
      const r = await auditVariant(t);
      reports.push(r);
      console.log(`${r.passCount}/${r.checks.length} ✓`);
    } catch (err) {
      console.log(`ERRO`);
      console.error(err);
      throw err;
    }
  }

  const outDir = "/mnt/documents";
  mkdirSync(outDir, { recursive: true });
  const mdPath = resolve(outDir, "landing-seo-audit.md");
  const jsonPath = resolve(outDir, "landing-seo-audit.json");
  writeFileSync(mdPath, renderMarkdown(reports), "utf8");
  writeFileSync(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2), "utf8");

  const totalPass = reports.reduce((s, r) => s + r.passCount, 0);
  const totalChk = reports.reduce((s, r) => s + r.checks.length, 0);
  console.log(`\n[audit-landing-seo] ${totalPass}/${totalChk} checks aprovados`);
  console.log(`[audit-landing-seo] relatório → ${mdPath}`);
  console.log(`[audit-landing-seo] dados    → ${jsonPath}`);
  if (totalPass !== totalChk) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

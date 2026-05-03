/**
 * Commercial Theme Scope Guard
 * ----------------------------------------------------------------
 * O tema marketing (data-theme="commercial", paleta #1A1A1B + Electric
 * Blue + Safety Orange) é OPT-IN e SÓ pode existir em rotas
 * marketing/landing. Chrome operacional (editor, command, field*,
 * training, pairing, dev) usa o canônico Vantablack/cyan-dessat —
 * brief é REJEITADO lá por OLED/WCAG/semântica WARN.
 *
 * Allow-list curta. Qualquer outra rota que adicionar `data-theme=
 * "commercial"` deve passar por revisão e ser incluída aqui.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ALLOWED_FILES = new Set([
  'src/pages/Landing.tsx',
  'src/pages/Pricing.tsx',
  'src/pages/Comercial.tsx',
  'src/pages/PitchUS.tsx',
  'src/pages/Unsubscribe.tsx',
  // CSS file that DEFINES the theme
  'src/styles/commercial-tokens.css',
  // Form helper used inside commercial pages
  'src/components/comercial/DemoRequestForm.tsx',
  // App.tsx só contém comentário de documentação
  'src/App.tsx',
]);

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx|css)$/.test(entry)) acc.push(full);
  }
  return acc;
}

describe('Commercial theme scope guard', () => {
  it('data-theme="commercial" only appears in allow-listed marketing files', () => {
    const root = resolve(process.cwd(), 'src');
    const files = walk(root);
    const offenders: string[] = [];
    for (const file of files) {
      if (file.includes('__tests__') || /\.(test|spec)\./.test(file)) continue;
      const src = readFileSync(file, 'utf8');
      if (!src.includes('data-theme="commercial"')) continue;
      const rel = file.replace(`${process.cwd()}/`, '');
      if (!ALLOWED_FILES.has(rel)) offenders.push(rel);
    }
    expect(
      offenders,
      `data-theme="commercial" leaked into operational chrome: ${offenders.join(', ')}. ` +
        `Marketing palette (#1A1A1B + Electric Blue + Safety Orange) is REJECTED ` +
        `for operational surfaces (memory: Vantablack #050810 + cyan-dessat is canonical). ` +
        `Either remove the attribute or add the file to ALLOWED_FILES after review.`,
    ).toEqual([]);
  });
});

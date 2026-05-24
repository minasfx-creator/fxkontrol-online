/**
 * Typography Unification Guard
 * ----------------------------------------------------------------
 * Garante que arquivos já migrados para a escala canônica
 * (ds-h1..ds-caption) NÃO regridam para utilities Tailwind brutos
 * (text-xs/sm/base/lg/xl/2xl/3xl/4xl/5xl/6xl).
 *
 * Não valida o app inteiro — só a allow-list. Migrações futuras
 * adicionam o arquivo aqui.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PROTECTED_FILES = [
  'src/pages/Auth.tsx',
  'src/pages/TrainingCenter.tsx',
  'src/pages/IOSReadiness.tsx',
  'src/components/training/safety/SafetyTrainingGate.tsx',
  'src/components/training/coach/MetaHumanCoachPanel.tsx',
];

const RAW_SIZE_RE =
  /\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/g;

describe('Typography DS scale guard', () => {
  for (const rel of PROTECTED_FILES) {
    it(`${rel} uses only ds-* typography utilities`, () => {
      const src = readFileSync(resolve(process.cwd(), rel), 'utf8');
      const matches = src.match(RAW_SIZE_RE) ?? [];
      expect(
        matches,
        `Found legacy text-* sizes in ${rel}: ${matches.join(', ')}. ` +
          `Use text-ds-{h1|h2|h3|h4|body|label|caption} instead.`,
      ).toEqual([]);
    });
  }
});

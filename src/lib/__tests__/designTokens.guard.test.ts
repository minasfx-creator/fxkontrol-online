/**
 * ─── Design Tokens Guard ───────────────────────────────────────────
 * Prevents regression of the dev-tooling design tokens migration.
 *
 * Scope is intentionally narrow: this only enforces the rule on the
 * developer-facing surfaces (emulator panel, replay timeline, audit
 * console) where the design system was unified. The wider Mission
 * Control product UI uses an established tactical palette and is
 * NOT in scope for this guard — it has its own component-level
 * design conventions.
 *
 * If you add a new dev-tooling component, include it in MIGRATED_FILES
 * and use the `text-fx-*` / `bg-fx-*` / `border-fx-*` tokens.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATED_FILES = [
  'src/components/editor/DevSimulationPanel.tsx',
  'src/components/editor/EmulatorTraceTimeline.tsx',
  'src/components/editor/AuditBlackBoxConsole.tsx',
];

// Raw Tailwind color classes that must not appear in migrated files.
// Tokens to use instead live in tailwind.config.ts under `colors.fx.*`.
const FORBIDDEN_PATTERNS: Array<{ re: RegExp; replacement: string }> = [
  { re: /\btext-cyan-\d{2,3}\b/,    replacement: 'text-fx-cyan' },
  { re: /\btext-emerald-\d{2,3}\b/, replacement: 'text-fx-success' },
  { re: /\btext-amber-\d{2,3}\b/,   replacement: 'text-fx-warning' },
  { re: /\btext-red-\d{2,3}\b/,     replacement: 'text-fx-danger' },
  { re: /\btext-violet-\d{2,3}\b/,  replacement: 'text-fx-accent' },
  { re: /\bborder-cyan-\d{2,3}\b/,  replacement: 'border-fx-cyan' },
  { re: /\bborder-red-\d{2,3}\b/,   replacement: 'border-fx-danger' },
  { re: /\bborder-amber-\d{2,3}\b/, replacement: 'border-fx-warning' },
  { re: /\bbg-cyan-\d{2,3}\b/,      replacement: 'bg-fx-cyan' },
  { re: /\bbg-red-\d{2,3}\b/,       replacement: 'bg-fx-danger' },
  { re: /\bbg-amber-\d{2,3}\b/,     replacement: 'bg-fx-warning' },
];

describe('Design Tokens — dev-tooling surfaces', () => {
  for (const file of MIGRATED_FILES) {
    it(`${file} uses semantic fx-* tokens (no raw color classes)`, () => {
      const abs = path.resolve(file);
      const exists = fs.existsSync(abs);
      expect(exists, `expected ${file} to exist`).toBe(true);
      const content = fs.readFileSync(abs, 'utf8');
      const violations: string[] = [];
      for (const { re, replacement } of FORBIDDEN_PATTERNS) {
        const m = content.match(re);
        if (m) violations.push(`  • "${m[0]}" → use "${replacement}"`);
      }
      expect(
        violations,
        `\nHardcoded color classes found in ${file}:\n${violations.join('\n')}\n`,
      ).toEqual([]);
    });
  }

  it('every forbidden pattern has a documented replacement token', () => {
    for (const { re, replacement } of FORBIDDEN_PATTERNS) {
      expect(re).toBeInstanceOf(RegExp);
      expect(replacement).toMatch(/^(text|bg|border)-fx-/);
    }
  });
});

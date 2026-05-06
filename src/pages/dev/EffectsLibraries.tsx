/**
 * /dev/effects-libraries — read-only inspector for the canonical Finale 3D
 * part libraries bundled with FXKONTROL (Showven, Lidu, Magic, Winda, Amazon).
 *
 * Drag-source enabled: cards mirror the EffectLibrarySidebar drag protocol
 * (`application/x-fxk-effect`) so timeline lanes accept them transparently.
 *
 * Plano: Experience Plane (presentation only). Never touches CommandBus,
 * FieldBus, SafetyStateMachine or workMode.
 */
import { useMemo, useState } from 'react';
import {
  getRegistrySummary,
  searchFinaleParts,
  listFinaleLibraries,
} from '@/data/effectsLibraries/registry';
import { finalePartToEffect } from '@/data/effectsLibraries/adapter';
import { parseFinalePartsXlsx } from '@/data/effectsLibraries/import';
import type { FinaleLibrary } from '@/data/effectsLibraries/finalePart';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const PART_TYPES = ['shell','cake','mine','candle','flame','sfx','laser','light','drone','formation','single_shot','waterfall','strobe','set_piece'];

export default function EffectsLibrariesPage() {
  const summary = useMemo(() => getRegistrySummary(), []);
  const libs = useMemo(() => listFinaleLibraries(), []);
  const [query, setQuery] = useState('');
  const [mfr, setMfr] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [imported, setImported] = useState<{ lib: FinaleLibrary; warnings: string[] } | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);

  const results = useMemo(() => searchFinaleParts({
    query: query || undefined,
    manufacturers: mfr ? [mfr] : undefined,
    partTypes: type ? [type] : undefined,
    limit: 200,
  }), [query, mfr, type]);

  async function handleFile(file: File) {
    setImportErr(null);
    try {
      const r = await parseFinalePartsXlsx(file);
      setImported({ lib: r.library, warnings: r.warnings });
    } catch (e) {
      setImportErr((e as Error).message);
      setImported(null);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-ds-h2">Effects Libraries — Finale 3D Parts</h1>
        <p className="text-ds-body text-muted-foreground">
          Canonical Finale 3D part schema (35 columns). Colors rendered via the VDL pipeline (LED-accurate).
          {' '}<strong>{summary.totalParts}</strong> parts across <strong>{summary.totalLibraries}</strong> libraries.
        </p>
        <div className="flex flex-wrap gap-2">
          {summary.byManufacturer.map((m) => (
            <Badge key={m.slug} variant="outline" className="ds-mono">
              {m.manufacturer} · {m.count}
            </Badge>
          ))}
        </div>
      </header>

      <section className="rounded-md border border-border p-4 space-y-3">
        <h2 className="text-ds-h4">Import XLSX (canonical Finale 3D headers or Winda Display Names)</h2>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
          className="text-ds-body"
        />
        {importErr && <div className="text-ds-status-fail">{importErr}</div>}
        {imported && (
          <div className="text-ds-body space-y-1">
            <div>
              <strong>{imported.lib.manufacturer}</strong> · slug <code className="ds-mono">{imported.lib.slug}</code> ·{' '}
              <strong>{imported.lib.count}</strong> parts
            </div>
            {imported.warnings.length > 0 && (
              <ul className="text-ds-status-warn list-disc pl-5">
                {imported.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Search part / description / VDL…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-sm"
          />
          <select value={mfr} onChange={(e) => setMfr(e.target.value)} className="bg-background border border-border rounded px-2 py-1">
            <option value="">All manufacturers</option>
            {libs.map((l) => <option key={l.slug} value={l.manufacturer}>{l.manufacturer}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} className="bg-background border border-border rounded px-2 py-1">
            <option value="">All part types</option>
            {PART_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={() => { setQuery(''); setMfr(''); setType(''); }}>Clear</Button>
          <span className="text-ds-caption text-muted-foreground">{results.length} match{results.length === 1 ? '' : 'es'}</span>
        </div>

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-ds-body">
            <thead className="bg-muted/40 text-ds-caption uppercase">
              <tr>
                <th className="text-left p-2">Part</th>
                <th className="text-left p-2">Manuf.</th>
                <th className="text-left p-2">Type</th>
                <th className="text-left p-2">Caliber</th>
                <th className="text-left p-2">Color</th>
                <th className="text-left p-2">Prefire</th>
                <th className="text-left p-2">Dur</th>
                <th className="text-left p-2">Height</th>
                <th className="text-left p-2 max-w-md">VDL / Description</th>
              </tr>
            </thead>
            <tbody>
              {results.map(({ part, lib }) => {
                const eff = finalePartToEffect(part, { librarySlug: lib.slug });
                return (
                  <tr
                    key={`${lib.slug}:${part.partNumber}`}
                    className="border-t border-border hover:bg-muted/30 cursor-grab"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/x-fxk-effect', eff.id);
                      e.dataTransfer.setData('text/plain', eff.id);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                  >
                    <td className="p-2 ds-mono">{part.partNumber}</td>
                    <td className="p-2">{lib.manufacturer}</td>
                    <td className="p-2"><Badge variant="outline">{part.partType ?? '—'}</Badge></td>
                    <td className="p-2 ds-mono">{part.size ?? '—'}</td>
                    <td className="p-2">
                      <span
                        className="inline-block w-4 h-4 rounded-sm border border-border align-middle mr-2"
                        style={{ backgroundColor: eff.color }}
                        title={eff.color}
                      />
                      <span className="ds-mono text-ds-caption">{eff.color}</span>
                    </td>
                    <td className="p-2 ds-mono">{part.internalDelay ?? '—'}</td>
                    <td className="p-2 ds-mono">{part.duration ?? '—'}</td>
                    <td className="p-2 ds-mono">{part.height ?? '—'}</td>
                    <td className="p-2 text-muted-foreground max-w-md truncate" title={`${part.vdl ?? ''} — ${part.description ?? ''}`}>
                      {part.vdl ?? part.description ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

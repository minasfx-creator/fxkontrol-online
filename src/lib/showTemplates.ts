/**
 * Show Template System
 * Save and load reusable show templates with formation sequences, effects, and scene settings.
 */

import type { DroneFormation } from '@/types/projectTypes';
import type { SceneSettings } from '@/store/useSceneStore';

export interface ShowTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  thumbnail?: string;
  createdAt: string;
  duration: number;
  droneCount: number;
  formationCount: number;
  formations: DroneFormation[];
  sceneSettings?: Partial<SceneSettings>;
  tags: string[];
}

export interface ShowTemplateBundle {
  schemaVersion: 2;
  exportedAt: string;
  source: 'fxk-show-templates';
  templates: ShowTemplate[];
}

export interface ImportTemplateResult {
  imported: ShowTemplate[];
  skipped: number;
}

export type TemplateCategory = 'countdown' | 'celebration' | 'logo' | 'abstract' | 'patriotic' | 'holiday' | 'sports' | 'custom';

export const TEMPLATE_CATEGORIES: Record<TemplateCategory, { label: string; emoji: string }> = {
  countdown: { label: 'Countdown', emoji: '⏱️' },
  celebration: { label: 'Celebration', emoji: '🎉' },
  logo: { label: 'Logo / Brand', emoji: '🏷️' },
  abstract: { label: 'Abstract Art', emoji: '🎨' },
  patriotic: { label: 'Patriotic', emoji: '🏳️' },
  holiday: { label: 'Holiday', emoji: '🎄' },
  sports: { label: 'Sports', emoji: '⚽' },
  custom: { label: 'Custom', emoji: '✏️' },
};

const STORAGE_KEY = 'pyro-show-templates';

export function saveTemplate(template: Omit<ShowTemplate, 'id' | 'createdAt'>): ShowTemplate {
  const full: ShowTemplate = {
    ...template,
    id: `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };

  const existing = loadTemplates();
  existing.push(full);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  return full;
}

function makeTemplateFingerprint(template: Pick<ShowTemplate, 'name' | 'formationCount' | 'droneCount' | 'duration'>): string {
  return [
    template.name.trim().toLowerCase(),
    Math.round(template.duration || 0),
    template.droneCount || 0,
    template.formationCount || 0,
  ].join('|');
}

export function loadTemplates(): ShowTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function deleteTemplate(id: string): void {
  const templates = loadTemplates().filter(t => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function getTemplate(id: string): ShowTemplate | null {
  return loadTemplates().find(t => t.id === id) || null;
}

export function exportTemplateJSON(template: ShowTemplate): string {
  const bundle: ShowTemplateBundle = {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    source: 'fxk-show-templates',
    templates: [template],
  };
  return JSON.stringify(bundle, null, 2);
}

function normalizeTemplate(raw: any): Omit<ShowTemplate, 'id' | 'createdAt'> | null {
  if (!raw || typeof raw !== 'object') return null;
  if (!raw.name || !Array.isArray(raw.formations)) return null;
  const formations = raw.formations.filter(Boolean);
  const formationCount = formations.length;
  const droneCount = Number(raw.droneCount) || formations[0]?.droneCount || 0;
  const inferredDuration = formations.reduce((max: number, f: any) => {
    const end = Number(f?.startTime || 0) + Number(f?.transitionDuration || 0) + Number(f?.holdDuration || 0);
    return Math.max(max, end);
  }, 0);
  return {
    name: String(raw.name),
    description: String(raw.description || ''),
    category: (raw.category || 'custom') as TemplateCategory,
    duration: Number(raw.duration) || inferredDuration,
    droneCount,
    formationCount,
    formations,
    sceneSettings: raw.sceneSettings,
    tags: Array.isArray(raw.tags) ? raw.tags.map((t: unknown) => String(t)) : [],
  };
}

export function importTemplateJSON(json: string): ImportTemplateResult | null {
  try {
    const parsed = JSON.parse(json);
    const candidates = Array.isArray(parsed?.templates)
      ? parsed.templates
      : Array.isArray(parsed)
        ? parsed
        : [parsed];

    const existing = loadTemplates();
    const existingFingerprints = new Set(existing.map(makeTemplateFingerprint));
    const imported: ShowTemplate[] = [];
    let skipped = 0;
    for (const candidate of candidates) {
      const normalized = normalizeTemplate(candidate);
      if (!normalized) { skipped++; continue; }
      const withImportedSuffix = {
        ...normalized,
        name: normalized.name.endsWith(' (Imported)') ? normalized.name : `${normalized.name} (Imported)`,
      };
      const fingerprint = makeTemplateFingerprint(withImportedSuffix);
      if (existingFingerprints.has(fingerprint)) {
        skipped++;
        continue;
      }
      const saved = saveTemplate(withImportedSuffix);
      existingFingerprints.add(fingerprint);
      imported.push(saved);
    }
    return imported.length > 0 || skipped > 0 ? { imported, skipped } : null;
  } catch {
    return null;
  }
}

// Built-in starter templates
export const BUILTIN_TEMPLATES: Omit<ShowTemplate, 'id' | 'createdAt'>[] = [
  {
    name: 'Countdown 5-4-3-2-1',
    description: 'Classic countdown sequence with number formations',
    category: 'countdown',
    duration: 30,
    droneCount: 200,
    formationCount: 6,
    formations: [],
    tags: ['countdown', 'numbers', 'new-year'],
  },
  {
    name: 'Heart Pulse',
    description: 'Heart shape with pulsing color animation',
    category: 'celebration',
    duration: 20,
    droneCount: 150,
    formationCount: 3,
    formations: [],
    tags: ['heart', 'love', 'valentine'],
  },
  {
    name: 'Spiral Galaxy',
    description: 'Expanding spiral with color gradient',
    category: 'abstract',
    duration: 25,
    droneCount: 300,
    formationCount: 4,
    formations: [],
    tags: ['spiral', 'galaxy', 'abstract'],
  },
  {
    name: 'Firework Burst',
    description: 'Drones mimic a firework burst expanding outward',
    category: 'celebration',
    duration: 15,
    droneCount: 250,
    formationCount: 3,
    formations: [],
    tags: ['firework', 'burst', 'celebration'],
  },
  {
    name: 'Niagara Blue & Gold',
    description: 'Alternating UE5 Niagara-inspired blue peony and gold kamuro shells with staggered timing',
    category: 'celebration',
    duration: 40,
    droneCount: 0,
    formationCount: 0,
    formations: [],
    tags: ['niagara', 'unreal', 'blue', 'gold', 'kamuro', 'peony'],
  },
  {
    name: 'Niagara RGB Finale',
    description: 'Grand finale using all three Niagara colors: blue, gold, and pink multi-break crescendo',
    category: 'celebration',
    duration: 60,
    droneCount: 0,
    formationCount: 0,
    formations: [],
    tags: ['niagara', 'unreal', 'finale', 'rgb', 'multi-break'],
  },
];

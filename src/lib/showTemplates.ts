/**
 * Show Template System
 * Save and load reusable show templates with formation sequences, effects, and scene settings.
 */

import type { DroneFormation } from '@/store/useProjectStore';
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
  return JSON.stringify(template, null, 2);
}

export function importTemplateJSON(json: string): ShowTemplate | null {
  try {
    const parsed = JSON.parse(json);
    if (!parsed.name || !parsed.formations) return null;
    return saveTemplate({
      name: parsed.name + ' (Imported)',
      description: parsed.description || '',
      category: parsed.category || 'custom',
      duration: parsed.duration || 0,
      droneCount: parsed.droneCount || 0,
      formationCount: parsed.formationCount || 0,
      formations: parsed.formations || [],
      sceneSettings: parsed.sceneSettings,
      tags: parsed.tags || [],
    });
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

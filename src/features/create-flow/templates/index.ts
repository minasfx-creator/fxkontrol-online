/**
 * Template registry — discoverable list of starter shows.
 *
 * Loaders are async to keep the create-flow chunk small until a template
 * is actually picked.
 */
import type { SegmentType } from '@/features/viewport-tools/types';

export interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  segments: SegmentType[];
  duration: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  load: () => Promise<any>;
}

export const TEMPLATES: TemplateMeta[] = [
  {
    id: 'pyro-sequence',
    name: 'Pyro Sequence Pack',
    description: 'Classic 4-position pyro layout for a quick sequence demo.',
    segments: ['PYRO'],
    duration: 60,
    load: () => import('./pyro-sequence.json').then((m) => m.default),
  },
  {
    id: 'drone-logo',
    name: 'Drone Logo Formation',
    description: 'Empty drone canvas — bring your formation script.',
    segments: ['DRONES'],
    duration: 120,
    load: () => import('./drone-logo.json').then((m) => m.default),
  },
  {
    id: 'light-chase',
    name: 'Light Chase Pack',
    description: '3-spot DMX chase scaffold for stage lighting.',
    segments: ['LIGHT', 'DMX'],
    duration: 90,
    load: () => import('./light-chase.json').then((m) => m.default),
  },
  {
    id: 'festival-full',
    name: 'Festival Full Show',
    description: 'All-segments empty show, 4 minutes — for large festivals.',
    segments: ['PYRO', 'DRONES', 'LIGHT', 'DMX', 'SFX'],
    duration: 240,
    load: () => import('./festival-full.json').then((m) => m.default),
  },
  {
    id: 'wedding-fx',
    name: 'Wedding FX Pack',
    description: 'Aisle pyro + SFX + soft light, 90 seconds.',
    segments: ['PYRO', 'SFX', 'LIGHT'],
    duration: 90,
    load: () => import('./wedding-fx.json').then((m) => m.default),
  },
];

export function getTemplate(id: string): TemplateMeta | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

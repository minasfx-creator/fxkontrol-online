/**
 * Create-flow types — shared by /create routes and createShowPlan().
 */
import type { SegmentType } from '@/features/viewport-tools/types';

export type CreateMode = 'blank' | 'template' | 'generated' | 'imported';

export type EventType = 'festival' | 'wedding' | 'arena' | 'corporate';
export type EventScale = 'small' | 'medium' | 'large';

export interface ShowPlanMeta {
  showId: string;
  name: string;
  mode: CreateMode;
  segments: SegmentType[];
  duration: number;
  createdAt: number;
  // Optional metadata from the wizard or template, for traceability
  templateId?: string;
  eventType?: EventType;
  scale?: EventScale;
}

export interface CreateShowPlanInput {
  mode: CreateMode;
  name?: string;
  segments?: SegmentType[];
  duration?: number;
  templateId?: string;
  eventType?: EventType;
  scale?: EventScale;
}

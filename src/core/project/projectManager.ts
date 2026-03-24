/**
 * ─── Project Manager — Save/Load Shows ──────────────────────────────
 * Manages project state with Lovable Cloud persistence.
 * Local cache in localStorage for offline / fast access.
 * Cloud sync via Supabase for multi-device / SaaS.
 */

import { supabase } from '@/integrations/supabase/client';
import { eventBus } from '@/core/system/eventBus';

export interface ProjectSnapshot {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  duration: number;
  timeline: Record<string, unknown>;
  positions: Record<string, unknown>[];
  environment: Record<string, unknown>;
  settings: Record<string, unknown>;
}

const LOCAL_KEY = 'fxk-project-snapshot';

class ProjectManager {
  private current: ProjectSnapshot | null = null;

  /** Create a new blank project */
  create(name: string): ProjectSnapshot {
    this.current = {
      id: crypto.randomUUID(),
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      duration: 300,
      timeline: {},
      positions: [],
      environment: {},
      settings: {},
    };
    eventBus.emit('SYSTEM.PROJECT_CREATED', { id: this.current.id, name });
    return this.current;
  }

  /** Save snapshot to localStorage (instant) */
  saveLocal(): void {
    if (!this.current) return;
    this.current.updatedAt = Date.now();
    localStorage.setItem(LOCAL_KEY, JSON.stringify(this.current));
    eventBus.emit('SYSTEM.PROJECT_SAVED', { id: this.current.id, target: 'local' });
    console.log('[Project] Saved locally');
  }

  /** Load from localStorage */
  loadLocal(): ProjectSnapshot | null {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    try {
      this.current = JSON.parse(raw);
      eventBus.emit('SYSTEM.PROJECT_LOADED', { id: this.current!.id, source: 'local' });
      console.log('[Project] Loaded from local');
      return this.current;
    } catch {
      console.warn('[Project] Corrupt local data');
      return null;
    }
  }

  /** Save to Lovable Cloud (Supabase projects table) */
  async saveCloud(userId: string): Promise<boolean> {
    if (!this.current) return false;
    this.current.updatedAt = Date.now();

    const { error } = await supabase.from('projects').upsert({
      id: this.current.id,
      user_id: userId,
      name: this.current.name,
      duration: this.current.duration,
    });

    if (error) {
      console.error('[Project] Cloud save failed:', error.message);
      eventBus.emit('ERROR.PROJECT_SAVE', { error: error.message });
      return false;
    }

    // Also persist local
    this.saveLocal();
    eventBus.emit('SYSTEM.PROJECT_SAVED', { id: this.current.id, target: 'cloud' });
    console.log('[Project] Saved to cloud');
    return true;
  }

  /** Load from Lovable Cloud */
  async loadCloud(projectId: string): Promise<ProjectSnapshot | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error || !data) {
      console.warn('[Project] Cloud load failed:', error?.message);
      return null;
    }

    this.current = {
      id: data.id,
      name: data.name,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
      duration: data.duration,
      timeline: {},
      positions: [],
      environment: {},
      settings: {},
    };

    this.saveLocal(); // cache locally
    eventBus.emit('SYSTEM.PROJECT_LOADED', { id: data.id, source: 'cloud' });
    return this.current;
  }

  get(): ProjectSnapshot | null {
    return this.current;
  }

  setSnapshot(snapshot: ProjectSnapshot): void {
    this.current = snapshot;
  }
}

export const projectManager = new ProjectManager();

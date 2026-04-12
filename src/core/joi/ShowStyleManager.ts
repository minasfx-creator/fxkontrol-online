/**
 * ─── ShowStyleManager — Style Learning & Application ───────────────
 * Extracts design patterns from completed shows and stores them as
 * reusable style profiles. JOI uses these to inform future choreography.
 */

import { useProjectStore } from '@/store/useProjectStore';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';
import { supabase } from '@/integrations/supabase/client';

// Type-safe wrapper since show_styles may not be in generated types yet
const showStylesTable = () => supabase.from('show_styles' as any);

export interface ShowStyleProfile {
  id?: string;
  name: string;
  description: string;
  source_show_name: string;
  style_data: ShowStyleData;
}

export interface ShowStyleData {
  /** Position layout metrics */
  position_count: number;
  position_types: Record<string, number>; // e.g. { pyro: 5, drone-pad: 3 }
  spatial_spread: { x_range: number; z_range: number };
  sections_used: string[];

  /** Effect distribution */
  total_effects: number;
  effect_density: number; // effects per second
  top_effects: { id: string; name: string; count: number }[];
  effect_type_ratio: Record<string, number>; // firework vs sfx vs drone

  /** Timing analysis */
  duration: number;
  timing_distribution: {
    first_quarter: number;   // % of effects in 0-25%
    second_quarter: number;
    third_quarter: number;
    fourth_quarter: number;
  };
  avg_gap_between_effects: number;

  /** Dramatic arc shape */
  dramatic_arc: 'building' | 'climactic' | 'wave' | 'steady' | 'finale_heavy';

  /** Drone formations if any */
  formation_count: number;
  formation_types: string[];
}

class ShowStyleManager {
  /** Extract style profile from current project state */
  extractStyle(name: string, description: string = ''): ShowStyleProfile {
    const store = useProjectStore.getState();
    const items = store.timelineItems;
    const positions = store.positions;
    const duration = store.duration;

    // Position analysis
    const posTypes: Record<string, number> = {};
    positions.forEach(p => {
      posTypes[p.type] = (posTypes[p.type] || 0) + 1;
    });

    const xs = positions.map(p => p.x);
    const zs = positions.map(p => p.z);
    const xRange = xs.length > 0 ? Math.max(...xs) - Math.min(...xs) : 0;
    const zRange = zs.length > 0 ? Math.max(...zs) - Math.min(...zs) : 0;

    const sectionsSet = new Set<string>();
    positions.forEach(p => { if (p.section) sectionsSet.add(p.section); });

    // Effect analysis
    const effectCounts = new Map<string, { id: string; name: string; count: number }>();
    const effectTypes: Record<string, number> = {};
    items.forEach(item => {
      const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId);
      const key = effect?.id || item.effectId;
      const existing = effectCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        effectCounts.set(key, { id: key, name: effect?.name || key, count: 1 });
      }
      const type = effect?.type || 'unknown';
      effectTypes[type] = (effectTypes[type] || 0) + 1;
    });

    const topEffects = Array.from(effectCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Timing analysis
    const times = items.map(i => i.startTime).sort((a, b) => a - b);
    const q1 = duration * 0.25;
    const q2 = duration * 0.5;
    const q3 = duration * 0.75;
    const total = items.length || 1;

    const timingDist = {
      first_quarter: times.filter(t => t < q1).length / total,
      second_quarter: times.filter(t => t >= q1 && t < q2).length / total,
      third_quarter: times.filter(t => t >= q2 && t < q3).length / total,
      fourth_quarter: times.filter(t => t >= q3).length / total,
    };

    // Average gap
    let totalGap = 0;
    for (let i = 1; i < times.length; i++) {
      totalGap += times[i] - times[i - 1];
    }
    const avgGap = times.length > 1 ? totalGap / (times.length - 1) : 0;

    // Dramatic arc detection
    let arc: ShowStyleData['dramatic_arc'] = 'steady';
    if (timingDist.fourth_quarter > 0.4) arc = 'finale_heavy';
    else if (timingDist.first_quarter < 0.15 && timingDist.fourth_quarter > 0.3) arc = 'building';
    else if (timingDist.second_quarter > 0.35 || timingDist.third_quarter > 0.35) arc = 'climactic';
    else if (Math.abs(timingDist.first_quarter - timingDist.third_quarter) > 0.15) arc = 'wave';

    return {
      name,
      description,
      source_show_name: store.projectName,
      style_data: {
        position_count: positions.length,
        position_types: posTypes,
        spatial_spread: { x_range: xRange, z_range: zRange },
        sections_used: Array.from(sectionsSet),
        total_effects: items.length,
        effect_density: duration > 0 ? items.length / duration : 0,
        top_effects: topEffects,
        effect_type_ratio: effectTypes,
        timing_distribution: timingDist,
        avg_gap_between_effects: avgGap,
        duration,
        dramatic_arc: arc,
        formation_count: store.droneFormations.length,
        formation_types: store.droneFormations.map(f => f.formationType),
      },
    };
  }

  /** Save a style profile to the database */
  async saveStyle(profile: ShowStyleProfile, userId: string): Promise<{ success: boolean; id?: string; error?: string }> {
    const { data, error } = await showStylesTable()
      .insert({
        user_id: userId,
        name: profile.name,
        description: profile.description,
        source_show_name: profile.source_show_name,
        style_data: profile.style_data as any,
      })
      .select('id')
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, id: (data as any).id };
  }

  /** List all saved styles for a user */
  async listStyles(userId: string): Promise<{ styles: ShowStyleProfile[]; error?: string }> {
    const { data, error } = await showStylesTable()
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return { styles: [], error: error.message };

    return {
      styles: ((data as any[]) || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        description: d.description || '',
        source_show_name: d.source_show_name || '',
        style_data: d.style_data as ShowStyleData,
      })),
    };
  }

  /** Get a single style by ID */
  async getStyle(styleId: string): Promise<ShowStyleProfile | null> {
    const { data, error } = await showStylesTable()
      .select('*')
      .eq('id', styleId)
      .single();

    if (error || !data) return null;
    const d = data as any;

    return {
      id: d.id,
      name: d.name,
      description: d.description || '',
      source_show_name: d.source_show_name || '',
      style_data: d.style_data as ShowStyleData,
    };
  }

  /** Format a style profile as context string for AI injection */
  formatForContext(profile: ShowStyleProfile): string {
    const s = profile.style_data;
    return `[STYLE: ${profile.name}] Source: "${profile.source_show_name}" | ${s.position_count} positions (${Object.entries(s.position_types).map(([t, c]) => `${t}:${c}`).join(',')}) | ${s.total_effects} effects (density: ${s.effect_density.toFixed(2)}/s) | Arc: ${s.dramatic_arc} | Duration: ${s.duration}s | Top effects: ${s.top_effects.slice(0, 5).map(e => `${e.name}×${e.count}`).join(', ')} | Timing: Q1=${(s.timing_distribution.first_quarter * 100).toFixed(0)}% Q2=${(s.timing_distribution.second_quarter * 100).toFixed(0)}% Q3=${(s.timing_distribution.third_quarter * 100).toFixed(0)}% Q4=${(s.timing_distribution.fourth_quarter * 100).toFixed(0)}%`;
  }
}

export const showStyleManager = new ShowStyleManager();

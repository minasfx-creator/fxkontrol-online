/**
 * ─── JOIStyleAwareGenerator — Style-Influenced Generation ──────────
 * Uses learned show styles to influence artifact generation,
 * blueprint design, and choreography suggestions.
 */

import type { ShowStyleProfile, ShowStyleData } from './ShowStyleManager';
import type { JOIArtifact, JOIVisualBlueprint } from './joiTypes';
import { showStyleManager } from './ShowStyleManager';

class JOIStyleAwareGeneratorImpl {
  private activeStyle: ShowStyleProfile | null = null;

  /** Set the active style for generation */
  setActiveStyle(style: ShowStyleProfile | null) {
    this.activeStyle = style;
  }

  /** Get current active style */
  getActiveStyle(): ShowStyleProfile | null {
    return this.activeStyle;
  }

  /** Load and activate a style by ID */
  async activateStyleById(styleId: string): Promise<boolean> {
    const style = await showStyleManager.getStyle(styleId);
    if (style) {
      this.activeStyle = style;
      return true;
    }
    return false;
  }

  /** Generate style-influenced context for AI */
  getStyleContext(): string {
    if (!this.activeStyle) return '';
    return showStyleManager.formatForContext(this.activeStyle);
  }

  /** Derive visual language from style data */
  deriveVisualLanguage(data: ShowStyleData): {
    density: 'sparse' | 'medium' | 'dense';
    rhythm: 'steady' | 'building' | 'explosive';
    color_temperature: 'warm' | 'cool' | 'mixed';
    scale: 'intimate' | 'medium' | 'grand';
  } {
    const density = data.effect_density < 0.5 ? 'sparse'
      : data.effect_density < 2 ? 'medium' : 'dense';

    const rhythm = data.dramatic_arc === 'steady' ? 'steady'
      : data.dramatic_arc === 'finale_heavy' || data.dramatic_arc === 'building' ? 'building'
      : 'explosive';

    // Infer color temperature from dominant effects
    const warmEffects = ['mort-', 'shell-', 'peon-', 'spark-'];
    const coolEffects = ['sfx-01', 'sfx-03', 'mine-'];
    const topIds = data.top_effects.map(e => e.id);
    const warmCount = topIds.filter(id => warmEffects.some(w => id.startsWith(w))).length;
    const coolCount = topIds.filter(id => coolEffects.some(c => id.startsWith(c))).length;
    const color_temperature = warmCount > coolCount ? 'warm' : coolCount > warmCount ? 'cool' : 'mixed';

    const scale = data.position_count < 5 ? 'intimate'
      : data.position_count < 15 ? 'medium' : 'grand';

    return { density, rhythm, color_temperature, scale };
  }

  /** Generate style-aware blueprint annotations */
  annotateBlueprint(blueprint: JOIVisualBlueprint): JOIVisualBlueprint {
    if (!this.activeStyle) return blueprint;

    const visual = this.deriveVisualLanguage(this.activeStyle.style_data);
    const annotations = [...blueprint.annotations];

    annotations.push({
      x: blueprint.canvas.width - 200,
      y: 20,
      text: `Style: ${this.activeStyle.name}`,
      color: 'hsl(38 100% 55%)',
    });
    annotations.push({
      x: blueprint.canvas.width - 200,
      y: 40,
      text: `${visual.density} | ${visual.rhythm} | ${visual.scale}`,
      color: 'hsl(190 100% 50%)',
    });

    return { ...blueprint, annotations };
  }

  /** Generate a style comparison artifact */
  generateStyleComparisonArtifact(styles: ShowStyleProfile[]): JOIArtifact {
    const rows = styles.map(s => ({
      name: s.name,
      source: s.source_show_name,
      effects: s.style_data.total_effects,
      density: s.style_data.effect_density.toFixed(2),
      arc: s.style_data.dramatic_arc,
      positions: s.style_data.position_count,
      duration: `${s.style_data.duration}s`,
    }));

    return {
      id: `art-style-cmp-${Date.now()}`,
      type: 'matrix',
      title: 'Style Comparison Matrix',
      content: JSON.stringify(rows),
      generated_at: Date.now(),
    };
  }
}

export const joiStyleAwareGenerator = new JOIStyleAwareGeneratorImpl();

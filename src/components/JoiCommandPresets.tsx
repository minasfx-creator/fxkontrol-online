/**
 * JoiCommandPresets — Mode-organized presets for the Joi intelligence panel
 * Re-exports from joiModes for backward compatibility
 */
import { Sparkles, Heart, Zap, Music, Building2, PartyPopper, RefreshCw, Trash2 } from 'lucide-react';

export interface OperationalPreset {
  label: string;
  icon: React.ElementType;
  prompt: string;
}

// Legacy presets kept for backward compat (used when mode=show on editor page)
export const OPERATIONAL_PRESETS: OperationalPreset[] = [
  {
    label: 'RÉVEILLON', icon: Sparkles,
    prompt: `Crie um show de Réveillon de 5 minutos com estrutura dramática completa:
- 15 posições em arco (raio 20m)
- ABERTURA (0-45s): Minas silver e gold nas 3 posições centrais
- BUILD (45s-2:30): Chrysanthemum 3" e Willow 4" em leque
- CLÍMAX (2:30-4:00): Shells 6"-8" com stagger 0.3s
- FINALE (4:00-5:00): Barrage com cakes 100-shot + shells 10"-12"
Use create_choreography.`,
  },
  {
    label: 'CASAMENTO', icon: Heart,
    prompt: `Crie um show intimista de casamento de 2 minutos com 8 posições em V-shape. Tons suaves: peony, willow, hearts. Use create_choreography.`,
  },
  {
    label: 'FINALE', icon: Zap,
    prompt: `Crie um finale explosivo de 30 segundos com 20 posições em linha. Barrage máximo com cakes e shells 10"-12". Use create_choreography.`,
  },
  {
    label: 'SHOW 3MIN', icon: Music,
    prompt: `Crie um show pirotécnico completo de 3 minutos com arco dramático e 12 posições em arco. Use create_choreography.`,
  },
  {
    label: 'CORPORATIVO', icon: Building2,
    prompt: `Crie um show corporativo elegante de 3 minutos com 10 posições. Tons: gold, silver, white. Use create_choreography.`,
  },
  {
    label: 'ANIVERSÁRIO', icon: PartyPopper,
    prompt: `Crie um show festivo de aniversário de 1.5 minutos com 8 posições. Multicolorido e alegre. Use create_choreography.`,
  },
  {
    label: 'MODIFICAR', icon: RefreshCw,
    prompt: `Analise o projeto atual e sugira melhorias. Use list_positions e list_effects primeiro.`,
  },
  {
    label: 'LIMPAR', icon: Trash2,
    prompt: `Limpe todo o projeto para recomeçar do zero.
[JOI_CMD]{"action":"clear_project","params":{}}[/JOI_CMD]`,
  },
];

/**
 * JoiCommandPresets — Real show design presets for the Joi chat
 */
import { Sparkles, Heart, Zap, Music, Building2, PartyPopper, RefreshCw, Trash2 } from 'lucide-react';

export interface OperationalPreset {
  label: string;
  icon: React.ElementType;
  prompt: string;
}

export const OPERATIONAL_PRESETS: OperationalPreset[] = [
  {
    label: 'RÉVEILLON',
    icon: Sparkles,
    prompt: `Crie um show de Réveillon de 5 minutos com estrutura dramática completa:
- 15 posições em arco (raio 20m)
- ABERTURA (0-45s): Minas silver e gold nas 3 posições centrais com 1s de intervalo
- BUILD (45s-2:30): Chrysanthemum 3" e Willow 4" em leque esquerda→direita com 0.5s stagger, peônias coloridas intercaladas
- CLÍMAX (2:30-4:00): Shells 6"-8" (Nishiki Kamuro, Peony 8", Horsetail) com stagger 0.3s, waterfalls gold nas laterais
- FINALE (4:00-5:00): Barrage com cakes 100-shot em todas posições + shells 10"-12" com 0.1s stagger, terminar com Kamuro 12"
Use create_choreography com todas as posições e cues.`,
  },
  {
    label: 'CASAMENTO',
    icon: Heart,
    prompt: `Crie um show intimista de casamento de 2 minutos:
- 8 posições em V-shape (ângulo 45°, espaçamento 4m)
- ABERTURA (0-20s): Cold sparks nas 2 posições frontais por 10s
- CORPO (20s-1:30): Peônias vermelhas e azuis alternadas com 1s intervalo, Willow 4" nos vértices do V
- FINAL (1:30-2:00): Heart Shell 4" no centro + Silver Glitter em todas posições com 0.3s stagger
- Tons suaves: peony, willow, hearts — nada agressivo
Use create_choreography.`,
  },
  {
    label: 'FINALE',
    icon: Zap,
    prompt: `Crie um finale explosivo de 30 segundos:
- 20 posições em linha reta (espaçamento 3m, de x=-30 a x=27)
- 0-10s: Cakes 49-shot fan em posições pares + Multi-Break Battery nas ímpares, stagger 0.2s
- 10-20s: Shells 8" (Peony + Nishiki Kamuro) alternados em todas posições, stagger 0.15s
- 20-30s: Shells 10"-12" (Chrysanthemum 10", Willow 10", Grand Peony 12") em barrage com 0.1s stagger, último disparo = Kamuro 12" na posição central
Use create_choreography.`,
  },
  {
    label: 'SHOW 3MIN',
    icon: Music,
    prompt: `Crie um show pirotécnico completo de 3 minutos com arco dramático:
- 12 posições em arco (raio 18m)
- ABERTURA (0-25s): Mine gold + Rising Comet nas 3 posições centrais
- BUILD (25s-1:20): Chrysanthemum 3" e Crossette 4" em sequência esquerda→direita (0.5s), depois direita→esquerda com Brocade Crown 5"
- CLÍMAX (1:20-2:20): Dahlia 6" + Spider 5" simultâneos em pares simétricos, Waterfall gold nas posições 1 e 12, Nishiki Kamuro 8" no centro
- FINALE (2:20-3:00): Cake 100-shot em posições 3,6,9,12 + shells 8"-10" em barrage 0.2s, fechar com Grand Peony 12" + Kamuro 12"
Use create_choreography.`,
  },
  {
    label: 'CORPORATIVO',
    icon: Building2,
    prompt: `Crie um show corporativo elegante de 3 minutos:
- 10 posições em arco (raio 15m)
- ABERTURA (0-30s): Cold sparks (sfx-03) nas 3 posições centrais por 15s, depois Rising Comet (comet-01) nas laterais
- BUILD (30s-1:30): Silver Glitter (peon-05) e Gold Strobing (peon-06) alternados com 0.8s stagger, Brocade Crown 5" (mort-03) nos vértices
- CLÍMAX (1:30-2:20): Kamuro 5" (shell-03) + Nishiki Kamuro 8" (shell-08) em pares simétricos com 0.5s stagger, Gold Waterfall 5m (wf-02) nas posições 1 e 10
- FINALE (2:20-3:00): Cake 49-Shot Fan (cake-02) em posições 2,5,8 + Titanium Shell 4" (shell-01) em barrage 0.2s, fechar com Kamuro 12" (shell-13)
- Tons: gold, silver, white — elegante e sofisticado
Use create_choreography.`,
  },
  {
    label: 'ANIVERSÁRIO',
    icon: PartyPopper,
    prompt: `Crie um show festivo de aniversário de 1.5 minutos:
- 8 posições em arco (raio 12m)
- ABERTURA (0-15s): Color Star Mine (mine-04) nas 3 posições centrais + Crackling Mine (mine-03) nas laterais
- CORPO (15s-1:00): Red Peony 3" (peon-01) + Blue Peony 3" (peon-02) + Green Peony 3" (peon-03) em sequência colorida com 0.5s stagger, Crackling Stars (peon-07) intercaladas
- CLÍMAX (1:00-1:20): Heart Shell 4" (shell-15) no centro + Color Shell 6" (shell-02) em pares simétricos + Confetti (sfx-06) nas posições frontais
- FINALE (1:20-1:30): 25-Shot Z Pattern (cake-01) em posições 2,4,6,8 + Multi-Break 6" (shell-19) no centro, fechar com Grand Peony 12" (shell-12)
- Tons: multicolorido, festivo, alegre
Use create_choreography.`,
  },
];

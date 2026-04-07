/**
 * JoiCommandPresets — Operational preset buttons for the Joi chat
 */
import { Crosshair, Music, Sparkles, Orbit } from 'lucide-react';

export interface OperationalPreset {
  label: string;
  icon: React.ElementType;
  prompt: string;
}

export const OPERATIONAL_PRESETS: OperationalPreset[] = [
  {
    label: 'CRIAR SHOW',
    icon: Sparkles,
    prompt: 'Crie um show de 3 minutos com 20 posições pyro em arco e efeitos variados (chrysanthemum, peony, willow, brocade) escalonados ao longo do tempo.',
  },
  {
    label: 'POSIÇÕES',
    icon: Crosshair,
    prompt: 'Adicione 10 posições pyro em linha reta espaçadas 5 metros, começando em x=-25, z=0.',
  },
  {
    label: 'COREOGRAFIA',
    icon: Music,
    prompt: 'Crie uma coreografia de chrysanthemum gold em sequência nas posições existentes com 0.5s de intervalo entre cada disparo.',
  },
  {
    label: 'FORMAÇÃO',
    icon: Orbit,
    prompt: 'Crie uma formação de 50 drones em espiral a 60m de altura com transição de 8 segundos.',
  },
];

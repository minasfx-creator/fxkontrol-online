/**
 * Training v2 — NPC catalog.
 *
 * Each NPC is a parametrised HumanoidCharacter preset. Style targets
 * "MetaHuman stand-in" within the Three.js / R3F runtime: humanoid
 * proportions, PBR materials, eye-track, lipsync, idle blend.
 */

export type SkinTone = 'fair' | 'olive' | 'tan' | 'brown' | 'deep';
export type BodyType = 'slim' | 'average' | 'athletic' | 'heavy';
export type HairPreset =
  | 'short-dark'
  | 'short-grey'
  | 'long-dark'
  | 'bun-blonde'
  | 'bald'
  | 'cap-curls'
  | 'styled-pompadour';

export type OutfitPreset =
  | 'roadie-vest'
  | 'producer-polo'
  | 'client-blazer'
  | 'hawaiian-drunk'
  | 'security-polo'
  | 'firefighter-inspector'
  | 'dancer-leotard'
  | 'sound-tech';

export interface NPCPersona {
  id: string;
  displayName: string;
  role: string;
  /** Color used to tag dialogue subtitles in HUD. */
  subtitleColor: string;
  voiceProfile: 'baritone' | 'tenor' | 'alto' | 'soprano';
  bodyType: BodyType;
  skinTone: SkinTone;
  hair: HairPreset;
  outfit: OutfitPreset;
  /** Default world position when first spawned. */
  defaultPosition: [number, number, number];
  /** Idle behaviour profile. */
  idleProfile: 'still' | 'pacing' | 'gesticulating' | 'wobbly' | 'alert';
}

export const NPC_CATALOG: Record<string, NPCPersona> = {
  'roadie-veterano': {
    id: 'roadie-veterano',
    displayName: 'Zé Roadie',
    role: 'Técnico-chefe',
    subtitleColor: 'hsl(28 100% 60%)',
    voiceProfile: 'baritone',
    bodyType: 'heavy',
    skinTone: 'tan',
    hair: 'short-grey',
    outfit: 'roadie-vest',
    defaultPosition: [-4, 0.3, 4],
    idleProfile: 'still',
  },
  'produtor-ansioso': {
    id: 'produtor-ansioso',
    displayName: 'Marcelo (Produtor)',
    role: 'Produtor',
    subtitleColor: 'hsl(45 100% 65%)',
    voiceProfile: 'tenor',
    bodyType: 'average',
    skinTone: 'fair',
    hair: 'short-dark',
    outfit: 'producer-polo',
    defaultPosition: [-6, 0.3, 4],
    idleProfile: 'pacing',
  },
  'cliente-indeciso': {
    id: 'cliente-indeciso',
    displayName: 'Dra. Helena (Cliente)',
    role: 'Cliente',
    subtitleColor: 'hsl(280 70% 70%)',
    voiceProfile: 'alto',
    bodyType: 'slim',
    skinTone: 'olive',
    hair: 'long-dark',
    outfit: 'client-blazer',
    defaultPosition: [7, 0.3, -2],
    idleProfile: 'gesticulating',
  },
  'convidado-bebado': {
    id: 'convidado-bebado',
    displayName: 'Jonas',
    role: 'Convidado',
    subtitleColor: 'hsl(340 70% 65%)',
    voiceProfile: 'tenor',
    bodyType: 'average',
    skinTone: 'fair',
    hair: 'cap-curls',
    outfit: 'hawaiian-drunk',
    defaultPosition: [3, 0.3, 6],
    idleProfile: 'wobbly',
  },
  'seguranca': {
    id: 'seguranca',
    displayName: 'Big Tony (Segurança)',
    role: 'Segurança',
    subtitleColor: 'hsl(0 0% 90%)',
    voiceProfile: 'baritone',
    bodyType: 'athletic',
    skinTone: 'brown',
    hair: 'bald',
    outfit: 'security-polo',
    defaultPosition: [8, 0.3, 4],
    idleProfile: 'alert',
  },
  'bombeiro-fiscal': {
    id: 'bombeiro-fiscal',
    displayName: 'Cap. Ribeiro (NFPA)',
    role: 'Inspetor',
    subtitleColor: 'hsl(15 80% 60%)',
    voiceProfile: 'baritone',
    bodyType: 'athletic',
    skinTone: 'tan',
    hair: 'short-dark',
    outfit: 'firefighter-inspector',
    defaultPosition: [0, 0.3, 8],
    idleProfile: 'still',
  },
  'dancarino-passagem': {
    id: 'dancarino-passagem',
    displayName: 'Letícia (Dançarina)',
    role: 'Elenco',
    subtitleColor: 'hsl(195 80% 65%)',
    voiceProfile: 'soprano',
    bodyType: 'slim',
    skinTone: 'deep',
    hair: 'bun-blonde',
    outfit: 'dancer-leotard',
    defaultPosition: [0, 0.3, -3],
    idleProfile: 'pacing',
  },
  'tecnica-som': {
    id: 'tecnica-som',
    displayName: 'Bia (Som)',
    role: 'Técnica de som',
    subtitleColor: 'hsl(160 60% 60%)',
    voiceProfile: 'alto',
    bodyType: 'average',
    skinTone: 'olive',
    hair: 'styled-pompadour',
    outfit: 'sound-tech',
    defaultPosition: [-8, 0.3, -1],
    idleProfile: 'still',
  },
  'eletricista-radio': {
    id: 'eletricista-radio',
    displayName: 'Rádio (Eletricista)',
    role: 'Off-screen',
    subtitleColor: 'hsl(60 70% 60%)',
    voiceProfile: 'tenor',
    bodyType: 'average',
    skinTone: 'tan',
    hair: 'short-dark',
    outfit: 'sound-tech',
    defaultPosition: [0, -10, 0], // hidden
    idleProfile: 'still',
  },
};

export function getNPC(id: string): NPCPersona | undefined {
  return NPC_CATALOG[id];
}

/**
 * Training v2.1 — NPC catalog.
 *
 * Each NPC is a parametrised HumanoidCharacter preset. Style targets
 * "MetaHuman stand-in" within the Three.js / R3F runtime: humanoid
 * proportions, PBR materials, eye-track, lipsync, idle blend.
 *
 * v2.1: +5 personas, +props (helmet/clipboard/walkie/visor),
 * dialogue tone hint per persona.
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
  | 'styled-pompadour'
  | 'crew-cut'
  | 'ponytail'
  | 'fauxhawk';

export type OutfitPreset =
  | 'roadie-vest'
  | 'producer-polo'
  | 'client-blazer'
  | 'hawaiian-drunk'
  | 'security-polo'
  | 'firefighter-inspector'
  | 'dancer-leotard'
  | 'sound-tech'
  | 'electrician-uniform'
  | 'dj-jacket'
  | 'corporate-suit'
  | 'security-female'
  | 'firefighter-junior';

export type PropPreset =
  | 'helmet'
  | 'clipboard'
  | 'walkie-talkie'
  | 'visor'
  | 'headphones'
  | 'tool-belt'
  | 'megaphone';

export interface NPCPersona {
  id: string;
  displayName: string;
  role: string;
  subtitleColor: string;
  voiceProfile: 'baritone' | 'tenor' | 'alto' | 'soprano';
  bodyType: BodyType;
  skinTone: SkinTone;
  hair: HairPreset;
  outfit: OutfitPreset;
  defaultPosition: [number, number, number];
  idleProfile: 'still' | 'pacing' | 'gesticulating' | 'wobbly' | 'alert';
  /** Visible props composited on top of base mesh. */
  props?: PropPreset[];
  /** Default tone for autospoken lines (overridable per line). */
  defaultIntent?: 'urgent' | 'calm' | 'excited' | 'serious' | 'sarcastic';
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
    props: ['walkie-talkie', 'tool-belt'],
    defaultIntent: 'calm',
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
    props: ['clipboard', 'walkie-talkie'],
    defaultIntent: 'urgent',
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
    defaultIntent: 'urgent',
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
    defaultIntent: 'sarcastic',
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
    props: ['walkie-talkie'],
    defaultIntent: 'serious',
  },
  'bombeiro-fiscal': {
    id: 'bombeiro-fiscal',
    displayName: 'Cap. Ribeiro (NFPA)',
    role: 'Inspetor sênior',
    subtitleColor: 'hsl(15 80% 60%)',
    voiceProfile: 'baritone',
    bodyType: 'athletic',
    skinTone: 'tan',
    hair: 'short-dark',
    outfit: 'firefighter-inspector',
    defaultPosition: [0, 0.3, 8],
    idleProfile: 'still',
    props: ['clipboard', 'helmet'],
    defaultIntent: 'serious',
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
    defaultIntent: 'excited',
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
    props: ['headphones'],
    defaultIntent: 'calm',
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
    defaultPosition: [0, -10, 0],
    idleProfile: 'still',
    defaultIntent: 'sarcastic',
  },
  // ── v2.1 — novos personagens ───────────────────────────────────
  'eletricista-paulo': {
    id: 'eletricista-paulo',
    displayName: 'Paulo (Eletricista)',
    role: 'Eletricista certificado',
    subtitleColor: 'hsl(60 80% 65%)',
    voiceProfile: 'baritone',
    bodyType: 'average',
    skinTone: 'tan',
    hair: 'crew-cut',
    outfit: 'electrician-uniform',
    defaultPosition: [-9, 0.3, 5],
    idleProfile: 'still',
    props: ['tool-belt', 'helmet'],
    defaultIntent: 'calm',
  },
  'dj-residente': {
    id: 'dj-residente',
    displayName: 'DJ Kaike',
    role: 'DJ residente',
    subtitleColor: 'hsl(290 75% 70%)',
    voiceProfile: 'tenor',
    bodyType: 'slim',
    skinTone: 'brown',
    hair: 'fauxhawk',
    outfit: 'dj-jacket',
    defaultPosition: [0, 0.9, -6],
    idleProfile: 'pacing',
    props: ['headphones'],
    defaultIntent: 'excited',
  },
  'cliente-corporativo': {
    id: 'cliente-corporativo',
    displayName: 'Sr. Albuquerque',
    role: 'Patrocinador corporativo',
    subtitleColor: 'hsl(220 50% 70%)',
    voiceProfile: 'baritone',
    bodyType: 'average',
    skinTone: 'fair',
    hair: 'short-grey',
    outfit: 'corporate-suit',
    defaultPosition: [9, 0.3, 2],
    idleProfile: 'still',
    defaultIntent: 'serious',
  },
  'seguranca-feminina': {
    id: 'seguranca-feminina',
    displayName: 'Sgt. Marina',
    role: 'Coordenadora segurança',
    subtitleColor: 'hsl(0 0% 95%)',
    voiceProfile: 'alto',
    bodyType: 'athletic',
    skinTone: 'olive',
    hair: 'ponytail',
    outfit: 'security-female',
    defaultPosition: [-8, 0.3, 4],
    idleProfile: 'alert',
    props: ['walkie-talkie'],
    defaultIntent: 'serious',
  },
  'bombeiro-jovem': {
    id: 'bombeiro-jovem',
    displayName: 'Cb. Tavares',
    role: 'Bombeiro júnior',
    subtitleColor: 'hsl(15 75% 65%)',
    voiceProfile: 'tenor',
    bodyType: 'athletic',
    skinTone: 'brown',
    hair: 'crew-cut',
    outfit: 'firefighter-junior',
    defaultPosition: [3, 0.3, 8],
    idleProfile: 'still',
    props: ['helmet', 'walkie-talkie'],
    defaultIntent: 'calm',
  },
};

export function getNPC(id: string): NPCPersona | undefined {
  return NPC_CATALOG[id];
}

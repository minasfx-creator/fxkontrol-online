/**
 * Ground texture registry.
 * Seamless tileable PBR-ish albedos imported from FWsim-style DDS sources,
 * converted to JPG and served from /textures/ground/.
 *
 * Não troca a GrassGround procedural automaticamente — opt-in via UI ou
 * via TexturedGround quando o usuário pedir.
 */
export interface GroundTexture {
  id: string;
  label: string;
  url: string;          // public URL (served from /public)
  size: number;         // square px (1024)
  source: 'fwsim-dds' | 'custom';
  tileMeters: number;   // recommended world-space tile size
}

export const GROUND_TEXTURES: readonly GroundTexture[] = [
  {
    id: 'grass',
    label: 'Grass (seamless)',
    url: '/textures/ground/grass.jpg',
    size: 1024,
    source: 'fwsim-dds',
    tileMeters: 4,
  },
  {
    id: 'dirt',
    label: 'Dirt (seamless)',
    url: '/textures/ground/dirt.jpg',
    size: 1024,
    source: 'fwsim-dds',
    tileMeters: 4,
  },
] as const;

export function getGroundTexture(id: string): GroundTexture | undefined {
  return GROUND_TEXTURES.find(t => t.id === id);
}

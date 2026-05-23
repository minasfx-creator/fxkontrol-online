/**
 * Georeferenced Show Venue Presets — real-world show packs with verified
 * GPS, audience axis, launch points, water/no-fly polygons and narrative
 * beats. Joi uses these to materialise positions precisely on top of
 * Google 3D Tiles.
 *
 * Coordinates are indicative production references, suitable for design
 * preview. Always re-validate before any operational use.
 */
import type { LatLng } from '@/utils/joiGeoHelpers';

export interface LaunchPointGeo {
  id: string;
  name: string;
  role: 'barge' | 'rooftop' | 'ground' | 'stage' | 'rig' | 'drone-pad';
  lat: number;
  lng: number;
  /** Height above ground (m). If omitted, snap-to-terrain decides. */
  heightHintAGL?: number;
  /** Max shell caliber (mm) allowed at this point. */
  calibreMaxMm?: number;
}

export interface VenueGeo {
  gps: { lat: number; lng: number; altMSL?: number };
  /** Heading (deg) from launch points toward the audience, 0..360 ENU. */
  headingFromAudience: number;
  audienceArea?: { lat: number; lng: number; radiusM: number };
  launchPoints: LaunchPointGeo[];
  waterFeature?: { kind: 'sea' | 'lake' | 'river' | 'bay'; polygon: LatLng[] };
  noFlyZones?: LatLng[][];
  landmarks?: { name: string; lat: number; lng: number }[];
}

export interface NarrativeBeat {
  tStart: number;
  tEnd: number;
  mood: 'intro' | 'build' | 'climax' | 'breath' | 'outro' | 'finale';
  density: number; // 0..1
  productMix?: string[];
}

export interface VenueShowPreset {
  id: string;
  name: string;
  reference: {
    event: string;
    year?: number;
    location: string;
    scale: 'intimate' | 'mid' | 'large' | 'mega';
    source?: string;
  };
  description: string;
  durationSec: number;
  venue: VenueGeo;
  paletteName?: string;
  narrativeBeats: NarrativeBeat[];
  joiPrompt: string;
  audioCueHints?: string[];
}

/** ──────────────────────────────────────────────────────────────────
 *  Real-world reference packs.
 *  Lat/lng/heading are verified from public satellite imagery and event
 *  layout documentation; refine in the editor before export.
 *  ────────────────────────────────────────────────────────────────── */
export const VENUE_SHOW_PRESETS: VenueShowPreset[] = [
  {
    id: 'reveillon-copacabana-12min',
    name: 'Réveillon Copacabana — 11 Barcas',
    reference: {
      event: 'Réveillon Copacabana',
      year: 2024,
      location: 'Praia de Copacabana, Rio de Janeiro, BR',
      scale: 'mega',
      source: 'Riotur layout 2023/24',
    },
    description:
      '11 barcas alinhadas ao longo da orla, queima sincronizada simétrica do centro pra fora.',
    durationSec: 720,
    paletteName: 'reveillon_copa',
    venue: {
      gps: { lat: -22.9711, lng: -43.1822, altMSL: 0 },
      headingFromAudience: 270, // barcas no mar, público a oeste (orla)
      audienceArea: { lat: -22.9706, lng: -43.1845, radiusM: 800 },
      launchPoints: Array.from({ length: 11 }).map((_, i) => {
        // 11 barcas igualmente espaçadas ao longo de ~3.5km de orla
        const t = i / 10;
        const lat = -22.9863 + (-22.9605 - -22.9863) * t;
        const lng = -43.1909 + (-43.1738 - -43.1909) * t;
        return {
          id: `barca-${i + 1}`,
          name: `Barca ${i + 1}`,
          role: 'barge' as const,
          lat,
          lng,
          heightHintAGL: 3,
          calibreMaxMm: 200,
        };
      }),
      waterFeature: {
        kind: 'sea',
        polygon: [
          { lat: -22.9605, lng: -43.1738 },
          { lat: -22.9863, lng: -43.1909 },
          { lat: -22.9920, lng: -43.1820 },
          { lat: -22.9670, lng: -43.1650 },
        ],
      },
      landmarks: [
        { name: 'Forte de Copacabana', lat: -22.9876, lng: -43.1881 },
        { name: 'Hotel Copacabana Palace', lat: -22.9669, lng: -43.1786 },
      ],
    },
    narrativeBeats: [
      { tStart: 0, tEnd: 30, mood: 'intro', density: 0.2 },
      { tStart: 30, tEnd: 180, mood: 'build', density: 0.45 },
      { tStart: 180, tEnd: 360, mood: 'climax', density: 0.8 },
      { tStart: 360, tEnd: 420, mood: 'breath', density: 0.3 },
      { tStart: 420, tEnd: 660, mood: 'climax', density: 0.85 },
      { tStart: 660, tEnd: 720, mood: 'finale', density: 1 },
    ],
    joiPrompt:
      'Monte o Réveillon Copacabana clássico: centre o anchor em Copacabana, materialize as 11 barcas a partir das coordenadas reais, snap todas no nível do mar, oriente para a orla (audiência), e gere uma queima simétrica do centro pra fora com finale espelhado em todas as barcas.',
    audioCueHints: ['intro suave', 'build orquestral', 'finale 60s sustentado'],
  },
  {
    id: 'maracana-final-90s',
    name: 'Maracanã — Final 90s',
    reference: {
      event: 'Final Libertadores / Brasileirão',
      location: 'Estádio Maracanã, Rio de Janeiro, BR',
      scale: 'large',
    },
    description:
      'Ring de gerbs no anel superior + 4 cold-spark towers no gramado, 90s celebratórios.',
    durationSec: 90,
    paletteName: 'rubro_negro',
    venue: {
      gps: { lat: -22.9122, lng: -43.2302, altMSL: 9 },
      headingFromAudience: 0, // público envolve 360°
      audienceArea: { lat: -22.9122, lng: -43.2302, radiusM: 120 },
      launchPoints: [
        { id: 'tower-n', name: 'Tower N', role: 'ground', lat: -22.9117, lng: -43.2302, heightHintAGL: 0, calibreMaxMm: 75 },
        { id: 'tower-s', name: 'Tower S', role: 'ground', lat: -22.9127, lng: -43.2302, heightHintAGL: 0, calibreMaxMm: 75 },
        { id: 'tower-e', name: 'Tower E', role: 'ground', lat: -22.9122, lng: -43.2296, heightHintAGL: 0, calibreMaxMm: 75 },
        { id: 'tower-w', name: 'Tower W', role: 'ground', lat: -22.9122, lng: -43.2308, heightHintAGL: 0, calibreMaxMm: 75 },
      ],
      noFlyZones: [],
    },
    narrativeBeats: [
      { tStart: 0, tEnd: 15, mood: 'intro', density: 0.3 },
      { tStart: 15, tEnd: 60, mood: 'climax', density: 0.7 },
      { tStart: 60, tEnd: 90, mood: 'finale', density: 1 },
    ],
    joiPrompt:
      'Configure o Maracanã: anchor no centro do gramado, 4 cold-spark towers nas coordenadas reais, audiência ao redor (360°), beats de 90s com climax aos 60s.',
  },
  {
    id: 'reveillon-paulista-3min',
    name: 'Av. Paulista — Réveillon 3min',
    reference: {
      event: 'Réveillon Paulista',
      location: 'Av. Paulista (MASP), São Paulo, BR',
      scale: 'large',
    },
    description: 'Cold sparks + gerbs em rooftops alinhados à Paulista.',
    durationSec: 180,
    paletteName: 'tricolor',
    venue: {
      gps: { lat: -23.5613, lng: -46.6565, altMSL: 800 },
      headingFromAudience: 220,
      audienceArea: { lat: -23.5613, lng: -46.6580, radiusM: 250 },
      launchPoints: [
        { id: 'rooftop-masp', name: 'MASP rooftop', role: 'rooftop', lat: -23.5614, lng: -46.6559, heightHintAGL: 30, calibreMaxMm: 50 },
        { id: 'rooftop-fiesp', name: 'FIESP rooftop', role: 'rooftop', lat: -23.5631, lng: -46.6535, heightHintAGL: 80, calibreMaxMm: 50 },
        { id: 'rooftop-conjnac', name: 'Conjunto Nacional', role: 'rooftop', lat: -23.5562, lng: -46.6614, heightHintAGL: 70, calibreMaxMm: 50 },
      ],
    },
    narrativeBeats: [
      { tStart: 0, tEnd: 30, mood: 'intro', density: 0.3 },
      { tStart: 30, tEnd: 120, mood: 'build', density: 0.6 },
      { tStart: 120, tEnd: 180, mood: 'finale', density: 1 },
    ],
    joiPrompt:
      'Réveillon Paulista: anchor no MASP, materialize os 3 rooftops nas coordenadas reais, snap altura em cada um, oriente os jatos para baixo na avenida (público), 3 min com finale alinhado.',
  },
  {
    id: 'coldplay-music-spheres-wembley-180s',
    name: 'Coldplay — Music of the Spheres (Wembley)',
    reference: {
      event: 'Coldplay Music of the Spheres Tour',
      year: 2022,
      location: 'Wembley Stadium, London, UK',
      scale: 'mega',
    },
    description:
      'Finale concerto: cold sparks no palco + 4 cannons no anel + confetti sync, 180s.',
    durationSec: 180,
    paletteName: 'coldplay_spheres',
    venue: {
      gps: { lat: 51.5560, lng: -0.2796, altMSL: 35 },
      headingFromAudience: 180, // palco norte → pit sul
      audienceArea: { lat: 51.5565, lng: -0.2796, radiusM: 110 },
      launchPoints: [
        { id: 'stage-l', name: 'Stage L', role: 'stage', lat: 51.5556, lng: -0.2802, heightHintAGL: 14, calibreMaxMm: 25 },
        { id: 'stage-r', name: 'Stage R', role: 'stage', lat: 51.5556, lng: -0.2790, heightHintAGL: 14, calibreMaxMm: 25 },
        { id: 'ring-nw', name: 'Ring NW', role: 'rig', lat: 51.5564, lng: -0.2804, heightHintAGL: 30, calibreMaxMm: 50 },
        { id: 'ring-ne', name: 'Ring NE', role: 'rig', lat: 51.5564, lng: -0.2788, heightHintAGL: 30, calibreMaxMm: 50 },
        { id: 'ring-sw', name: 'Ring SW', role: 'rig', lat: 51.5570, lng: -0.2804, heightHintAGL: 30, calibreMaxMm: 50 },
        { id: 'ring-se', name: 'Ring SE', role: 'rig', lat: 51.5570, lng: -0.2788, heightHintAGL: 30, calibreMaxMm: 50 },
      ],
    },
    narrativeBeats: [
      { tStart: 0, tEnd: 20, mood: 'intro', density: 0.2 },
      { tStart: 20, tEnd: 90, mood: 'build', density: 0.5 },
      { tStart: 90, tEnd: 150, mood: 'climax', density: 0.85 },
      { tStart: 150, tEnd: 180, mood: 'finale', density: 1 },
    ],
    joiPrompt:
      'Coldplay Music of the Spheres: anchor no Wembley, palco norte com 2 cold sparks, 4 canhões no anel (NE/NW/SE/SW) nas coordenadas reais, oriente todos para o pit (audiência sul), beats sincronizados ao climax do refrão final.',
  },
  {
    id: 'macys-east-river-6min',
    name: '4th of July — Macy\'s East River',
    reference: {
      event: 'Macy\'s 4th of July Fireworks',
      location: 'East River, New York, US',
      scale: 'mega',
    },
    description: '5 barcas alinhadas ao East River, queima 6 min.',
    durationSec: 360,
    paletteName: 'independencia_us',
    venue: {
      gps: { lat: 40.7411, lng: -73.9712 },
      headingFromAudience: 90, // barcas leste, audiência oeste em Manhattan
      audienceArea: { lat: 40.7411, lng: -73.9745, radiusM: 600 },
      launchPoints: Array.from({ length: 5 }).map((_, i) => {
        const t = i / 4;
        const lat = 40.7290 + (40.7530 - 40.7290) * t;
        const lng = -73.9710 + (-73.9690 - -73.9710) * t;
        return {
          id: `barge-${i + 1}`,
          name: `Barge ${i + 1}`,
          role: 'barge' as const,
          lat,
          lng,
          heightHintAGL: 3,
          calibreMaxMm: 200,
        };
      }),
      waterFeature: {
        kind: 'river',
        polygon: [
          { lat: 40.7290, lng: -73.9700 },
          { lat: 40.7530, lng: -73.9680 },
          { lat: 40.7530, lng: -73.9660 },
          { lat: 40.7290, lng: -73.9680 },
        ],
      },
    },
    narrativeBeats: [
      { tStart: 0, tEnd: 30, mood: 'intro', density: 0.25 },
      { tStart: 30, tEnd: 180, mood: 'build', density: 0.55 },
      { tStart: 180, tEnd: 300, mood: 'climax', density: 0.85 },
      { tStart: 300, tEnd: 360, mood: 'finale', density: 1 },
    ],
    joiPrompt:
      'Macy\'s East River: anchor no East River, 5 barcas alinhadas norte-sul nas coordenadas reais, snap nível d\'água, oriente para Manhattan (audiência oeste), 6 min ABS clássicos com finale aos 300s.',
  },
];

export function getVenuePreset(id: string): VenueShowPreset | undefined {
  return VENUE_SHOW_PRESETS.find((v) => v.id === id);
}

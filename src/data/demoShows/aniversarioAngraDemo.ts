/**
 * Aniversário Angra — pilot show seed (imported from Finale 3D firing CSV).
 *
 * Provenance: `pilot` — real firing list provided by the user
 * (ANIVERSARIO_ANGRA.csv). 110 cues across 4 fireone_fm modules / 2 positions,
 * ~3:45 of duration.
 *
 * Companion binaries (`.fir` MS Access DB and `.fin` zipped Finale project) are
 * intentionally out of scope here — the CSV is the readable canonical source.
 */
import {
  type ShowPlan,
  type PyroCue,
  type ShowPosition,
  type HardwareModuleConfig,
  createEmptyShowPlan,
} from '@/core/showplan/ShowPlan';
import raw from './aniversarioAngra.generated.json';

interface RawCue {
  time: number; duration: number; prefire: number; deviceDelay: number;
  effectName: string; caliber: number; category: string;
  posName: string; vdl: string; moduleDesc: string;
  moduleAddr: number; slatAddr: number; pinAddr: number;
  heading: number; pitch: number; roll: number;
  x: number; y: number; z: number; notes: string;
}
interface RawSeed {
  id: string; name: string; provenance: 'pilot' | 'validated' | 'marketing_hypothesis';
  durationS: number; totalCues: number; moduleAddrs: number[];
  positions: { name: string; x: number; y: number; z: number }[];
  cues: RawCue[];
}
const SEED = raw as RawSeed;

export const ANIVERSARIO_ANGRA_ID = SEED.id;
export const ANIVERSARIO_ANGRA_DURATION_S = SEED.durationS;
export const ANIVERSARIO_ANGRA_TRANSPORT_REQ: ReadonlyArray<string> = ['fireone_fm'];

function positions(): ShowPosition[] {
  return SEED.positions.map((p) => ({
    id: p.name,
    name: p.name,
    type: 'pyro',
    x: p.x,
    y: p.y,
    z: p.z,
    heading: 0,
    pitch: 0,
  }));
}

function pyroCues(): PyroCue[] {
  return SEED.cues.map((c, i): PyroCue => ({
    id: `angra-${String(i).padStart(3, '0')}`,
    time: c.time,
    positionId: c.posName,
    module: c.moduleAddr,
    channel: c.pinAddr,
    effectId: `finale-${c.effectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`,
    fuseDelay: Math.round(c.deviceDelay * 1000),
    caliber: c.caliber,
    elevation: 90,
    heading: c.heading,
    position: { x: c.x, y: c.y, z: c.z },
    notes: c.vdl,
    rack: c.slatAddr,
    tube: c.pinAddr,
    section: c.posName,
  }));
}

function hardware(): HardwareModuleConfig[] {
  return SEED.moduleAddrs.map((addr) => ({
    id: `fireone-fm-${String(addr).padStart(2, '0')}`,
    label: `FireOne FM #${String(addr).padStart(2, '0')}`,
    type: 'nano-relay-32',
    channelCount: 32,
    address: addr,
  }));
}

export function buildAniversarioAngraShow(): ShowPlan {
  const plan = createEmptyShowPlan();
  plan.metadata = {
    ...plan.metadata,
    id: ANIVERSARIO_ANGRA_ID,
    name: SEED.name,
    venue: 'Angra dos Reis (pilot)',
    gps: null,
    duration: ANIVERSARIO_ANGRA_DURATION_S,
    author: 'Imported from Finale 3D CSV',
    notes: `pilot:user-import — ${SEED.totalCues} cues / ${SEED.moduleAddrs.length} modules.`,
  };
  plan.positions = positions();
  plan.pyroCues = pyroCues();
  plan.hardwareConfig = {
    modules: hardware(),
    muxChannels: 8,
    shiftRegisterBits: 8,
    totalRelays: SEED.moduleAddrs.length * 32,
  };
  return plan;
}

export const ANIVERSARIO_ANGRA_MANIFEST = {
  id: ANIVERSARIO_ANGRA_ID,
  durationS: ANIVERSARIO_ANGRA_DURATION_S,
  transportRequirements: ANIVERSARIO_ANGRA_TRANSPORT_REQ,
  provenance: SEED.provenance,
} as const;

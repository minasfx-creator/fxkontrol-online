/**
 * Mine silhouettes derived from the FWsim vector library
 * (src/assets/fwsim-effect-icons/Mine_*.svg).
 *
 * Each entry describes a fan-shape spray:
 *   - jetAnglesDeg: pitch deviations from vertical (negative = left, positive = right)
 *   - jitterDeg:    angular jitter applied per particle around each jet axis
 *   - crownRatio:   fraction of total particles spawned in a dense ground crown
 *   - crownLifetimeS: lifetime of the crown burst
 */

export interface MineSilhouette {
  id: 'mine_5jet' | 'mine_7jet' | 'mine_9jet' | 'mine_comet_with_silver_tail';
  jetAnglesDeg: number[];
  jitterDeg: number;
  crownRatio: number;
  crownLifetimeS: number;
  /** Optional: when set, renderer should append a dense central spark tail. */
  silverTail?: boolean;
}

export const MINE_SILHOUETTES: Record<MineSilhouette['id'], MineSilhouette> = {
  // Mine_03 reference — 5 distinct radiating jets + base crown
  mine_5jet: {
    id: 'mine_5jet',
    jetAnglesDeg: [-50, -25, -5, 15, 45],
    jitterDeg: 4.5,
    crownRatio: 0.22,
    crownLifetimeS: 0.18,
  },
  // Mine_02 reference — denser fan, 7 jets
  mine_7jet: {
    id: 'mine_7jet',
    jetAnglesDeg: [-55, -35, -18, -3, 12, 30, 50],
    jitterDeg: 3.5,
    crownRatio: 0.18,
    crownLifetimeS: 0.16,
  },
  // Mine_01 reference — wide saturated spray, 9 jets
  mine_9jet: {
    id: 'mine_9jet',
    jetAnglesDeg: [-60, -45, -30, -15, 0, 12, 28, 45, 60],
    jitterDeg: 2.8,
    crownRatio: 0.15,
    crownLifetimeS: 0.14,
  },
  // Mine_Purple_Comet_White_w_Silver_Tail.fwe reference — 1 dense
  // central jet with very tight jitter and a silver spark tail.
  mine_comet_with_silver_tail: {
    id: 'mine_comet_with_silver_tail',
    jetAnglesDeg: [0],
    jitterDeg: 1.5,
    crownRatio: 0.08,
    crownLifetimeS: 0.22,
    silverTail: true,
  },
};

/** Pick a silhouette from caliber + numDevices + cometHead heuristics. */
export function selectMineSilhouette(opts: {
  caliber?: number; numDevices?: number; cometHead?: boolean;
}): MineSilhouette {
  if (opts.cometHead) return MINE_SILHOUETTES.mine_comet_with_silver_tail;
  const cal = opts.caliber ?? 3;
  const n = opts.numDevices ?? 1;
  if (cal >= 5 || n >= 5) return MINE_SILHOUETTES.mine_9jet;
  if (cal >= 3) return MINE_SILHOUETTES.mine_7jet;
  return MINE_SILHOUETTES.mine_5jet;
}

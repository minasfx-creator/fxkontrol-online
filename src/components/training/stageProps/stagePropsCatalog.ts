/**
 * Training v2.2 — Stage Props Catalog.
 *
 * Pure data definitions of ajustable scenic props that can be dropped
 * onto the stage from the editor panel. Each kind has sensible defaults;
 * the user fine-tunes per instance via StagePropsEditorPanel.
 *
 * Zero THREE/React imports — render lives in StageProps3D.tsx.
 */

export type StagePropKind =
  | 'light-rig'
  | 'bleacher'
  | 'delay-tower'
  | 'sub-stack'
  | 'follow-spot-platform'
  | 'pyro-cake-pod';

export interface StagePropDefinition {
  kind: StagePropKind;
  label: string;
  /** Short editor description shown in the catalog. */
  description: string;
  /** Default position in stage-local meters [x, y, z]. */
  defaultPosition: [number, number, number];
  /** Default Y rotation in radians. */
  defaultRotationY: number;
  /** Default uniform scale. */
  defaultScale: number;
}

export const STAGE_PROP_CATALOG: ReadonlyArray<StagePropDefinition> = [
  {
    kind: 'light-rig',
    label: 'Rig de Luz Móvel',
    description: '4 movers + barra de truss curta. Dimensionável.',
    defaultPosition: [0, 0.3, -3.5],
    defaultRotationY: 0,
    defaultScale: 1,
  },
  {
    kind: 'bleacher',
    label: 'Arquibancada Lateral',
    description: 'Tier de 4 fileiras com silhuetas de público.',
    defaultPosition: [-8, 0, 4],
    defaultRotationY: Math.PI / 2,
    defaultScale: 1,
  },
  {
    kind: 'delay-tower',
    label: 'Torre de Delay',
    description: 'Torre de PA com 4 boxes para fundo de pista.',
    defaultPosition: [7, 0, 6],
    defaultRotationY: 0,
    defaultScale: 1,
  },
  {
    kind: 'sub-stack',
    label: 'Sub Stack',
    description: '2 subwoofers empilhados — refresco de graves.',
    defaultPosition: [-4.5, 0, 2.5],
    defaultRotationY: 0,
    defaultScale: 1,
  },
  {
    kind: 'follow-spot-platform',
    label: 'Plataforma Follow-Spot',
    description: 'Tablado elevado + canhão seguidor para FOH.',
    defaultPosition: [0, 0, 8],
    defaultRotationY: Math.PI,
    defaultScale: 1,
  },
  {
    kind: 'pyro-cake-pod',
    label: 'Pod de Cake Pyro',
    description: 'Estação ground-mounted com 4 cake fixtures.',
    defaultPosition: [3, 0.3, -1],
    defaultRotationY: 0,
    defaultScale: 1,
  },
];

export function getStagePropDef(kind: StagePropKind): StagePropDefinition | undefined {
  return STAGE_PROP_CATALOG.find((d) => d.kind === kind);
}

/**
 * Training v2 — Cinematic Mission Scripts catalog.
 *
 * 16 missions: 10 refined + 6 new. Each is a structured MissionScript
 * with briefing, staged objectives (revealed sequentially, GTA-style),
 * NPC events, and a debrief that links to existing reference manuals.
 *
 * SAFETY: all stages are simulation-only. No real hardware is armed,
 * fired, or energised by content here.
 */

import type { MissionScript } from './types';
import { MISSION_SNAP_POINTS } from '../types';

const DEFAULT_SCORE = {
  baseXP: 100,
  timeBonusPerSecond: 2,
  safetyPenalty: 50,
  maxStars: 5,
};

/** Helper: convert legacy snap points → place stage objectives. */
function snapStageObjectives(missionId: string) {
  return (MISSION_SNAP_POINTS[missionId] ?? []).map((sp) => ({
    snapPointId: sp.id,
    equipmentId: sp.equipmentType,
    label: sp.label,
  }));
}

export const MISSION_SCRIPTS: MissionScript[] = [
  // ── Cap. 1 — Montagem ──────────────────────────────────────────
  {
    id: 'tutorial-truss',
    chapter: 'Cap. 1 — Montagem',
    title: '6 da Manhã, Galpão Vazio',
    synopsis:
      'Sua primeira montagem real. Treliça em H — quatro pontos, nivelamento, café frio.',
    scenario: '🏗️ Galpão vazio, 6h. Café frio. O caminhão acabou de chegar.',
    difficulty: 'easy',
    timeLimitSeconds: 180,
    equipment: ['truss-straight', 'truss-corner'],
    locked: false,
    briefing: {
      npcId: 'roadie-veterano',
      lines: [
        { npcId: 'roadie-veterano', text: 'Beleza, novato. Treliça em H, frente e canto.' },
        { npcId: 'roadie-veterano', text: 'Começa pelo canto traseiro. Nivela. Aperta firme — torque 25 N·m.' },
      ],
    },
    stages: [
      {
        id: 's1', kind: 'place', title: 'Cantos traseiros',
        hint: 'Coloque as duas treliças de canto na linha traseira primeiro.',
        budgetSeconds: 60,
        objectives: snapStageObjectives('tutorial-truss').filter((o) => o.equipmentId === 'truss-corner'),
        onEnter: [{ kind: 'speak', npcId: 'roadie-veterano', line: 'Cantos primeiro. Sempre.' }],
      },
      {
        id: 's2', kind: 'place', title: 'Vãos frontais',
        hint: 'Agora as duas retas frontais. Aperto cruzado, igual roda de carro.',
        budgetSeconds: 90,
        objectives: snapStageObjectives('tutorial-truss').filter((o) => o.equipmentId === 'truss-straight'),
        onComplete: [{ kind: 'speak', npcId: 'roadie-veterano', line: 'Bom. Agora confere o nível.' }],
      },
    ],
    debrief: {
      title: 'Truss montada — bem-vindo ao ofício',
      takeaways: [
        'Cantos primeiro estabilizam o gabarito antes dos vãos.',
        'Aperto cruzado distribui carga e evita empenamento.',
        'Torque 25 N·m é típico para conectores cônicos de truss F34.',
      ],
    },
    scoreRules: DEFAULT_SCORE,
  },

  // ── Cap. 2 — SFX & DMX ─────────────────────────────────────────
  {
    id: 'sfx-setup',
    chapter: 'Cap. 2 — SFX & Iluminação',
    title: 'O Eletricista Sumiu',
    synopsis:
      'Sparkulars, flamer e cryo. Sem eletricista. Você vai ter que pensar em PE, fases e RCD.',
    scenario: '⚡ 9h. O eletricista mandou áudio dizendo "tô chegando". Faz 3h.',
    difficulty: 'easy',
    timeLimitSeconds: 150,
    equipment: ['sparkular', 'flamer', 'cryo'],
    locked: false,
    briefing: {
      npcId: 'eletricista-radio',
      lines: [
        { npcId: 'eletricista-radio', text: '*kkkkk* Tô chegando, viu? Sai liberando os SFX!' },
        { npcId: 'roadie-veterano', text: 'Ele não vem. Faz tu mesmo. Confere PE em todo SFX.' },
      ],
    },
    stages: [
      {
        id: 's1', kind: 'place', title: 'Sparkulars na truss',
        hint: 'Sparkulars vão NA truss frontal, voltados para o público — nunca para a banda.',
        objectives: snapStageObjectives('sfx-setup').filter((o) => o.equipmentId === 'sparkular'),
      },
      {
        id: 's2', kind: 'place', title: 'Flamer central',
        hint: 'Flamer central. Verifique 3m de raio livre acima.',
        objectives: snapStageObjectives('sfx-setup').filter((o) => o.equipmentId === 'flamer'),
      },
      {
        id: 's3', kind: 'place', title: 'Cryo no piso',
        hint: 'Cryo CO₂ frontal. Mangueira sem dobra, válvula longe de cabos elétricos.',
        objectives: snapStageObjectives('sfx-setup').filter((o) => o.equipmentId === 'cryo'),
      },
    ],
    debrief: {
      title: 'SFX energizado com segurança',
      takeaways: [
        'Sparkulars apontados para o público — nunca para músicos ou cabos.',
        'Flamer exige 3m verticais livres + chão FR (flame retardant).',
        'Cryo CO₂ acumula em pits — cuidado com asfixia em palco rebaixado.',
      ],
    },
    scoreRules: DEFAULT_SCORE,
  },

  {
    id: 'dmx-config',
    chapter: 'Cap. 2 — SFX & Iluminação',
    title: 'Patch DMX na Correria',
    synopsis: '16 fixtures, 2 universos, 1 hora antes do soundcheck. Sem labels.',
    scenario: '🎛️ Console ligado. 200 cabos. Zero labels. O DJ tá ansioso.',
    difficulty: 'medium',
    timeLimitSeconds: 120,
    equipment: ['moving-head', 'par-can', 'sparkular'],
    locked: false,
    briefing: {
      npcId: 'tecnica-som',
      lines: [
        { npcId: 'tecnica-som', text: 'Patch nos endereços do rider. Movings 1–4, PARs 5–8.' },
        { npcId: 'tecnica-som', text: 'Lembra do terminator 120Ω no fim da chain — sem ele, dá glitch.' },
      ],
    },
    stages: [
      {
        id: 's1', kind: 'place', title: 'Movings na truss frontal',
        objectives: snapStageObjectives('dmx-config').filter((o) => o.equipmentId === 'moving-head'),
      },
      {
        id: 's2', kind: 'place', title: 'PAR Cans + Sparkular',
        objectives: snapStageObjectives('dmx-config').filter((o) => o.equipmentId !== 'moving-head'),
      },
    ],
    debrief: {
      title: 'DMX endereçado',
      takeaways: [
        'Daisy-chain DMX512 ≤ 32 fixtures por linha — depois, splitter ativo.',
        'Terminator 120Ω no último fixture elimina reflexão de sinal.',
        'Endereço ≠ posição física. Sempre rotule cada cabeça.',
      ],
    },
    scoreRules: DEFAULT_SCORE,
  },

  // ── Cap. 3 — Caos ao Vivo ──────────────────────────────────────
  {
    id: 'drunk-invasion',
    chapter: 'Cap. 3 — Caos ao Vivo',
    title: 'Bêbado no Palco',
    synopsis: 'Convidado bêbado invadiu a área técnica. Sparkulars armados. Decisões em segundos.',
    scenario: '🍺 22h. Pista lotada. Segurança sumiu. O cara quer "apertar um botão".',
    difficulty: 'medium',
    timeLimitSeconds: 90,
    equipment: ['sparkular', 'flamer'],
    locked: false,
    briefing: {
      npcId: 'roadie-veterano',
      lines: [
        { npcId: 'convidado-bebado', text: 'Eeeei mano *hic* esse botão aqui é o quê?' },
        { npcId: 'roadie-veterano', text: 'KILL SWITCH AGORA. Coloca os SFX em posição segura. Sem firing.' },
      ],
    },
    stages: [
      {
        id: 's1', kind: 'evacuate', title: 'Acionar Kill Switch SFX',
        hint: 'O kill switch já foi acionado off-screen — agora reposicione os SFX em modo seguro.',
        objectives: [
          { label: 'Reposicione Sparkular em modo seguro', snapPointId: 'sp-1', equipmentId: 'sparkular' },
          { label: 'Reposicione Flamer em modo seguro', snapPointId: 'sp-2', equipmentId: 'flamer' },
        ],
        onEnter: [
          { kind: 'spawn', npcId: 'seguranca', position: [4, 0.3, 6] },
          { kind: 'speak', npcId: 'seguranca', line: 'Sai daqui, parceiro. Vem comigo.' },
        ],
      },
    ],
    debrief: {
      title: 'Incidente contido — show preservado',
      takeaways: [
        'Kill switch SFX deve ser acessível em < 2s do operador principal.',
        'Protocolo: 1) kill switch, 2) chama segurança, 3) reposicionamento, 4) reset.',
        'Documentar no black box: timestamp, descrição, ação tomada.',
      ],
    },
    scoreRules: DEFAULT_SCORE,
  },

  {
    id: 'producer-late',
    chapter: 'Cap. 3 — Caos ao Vivo',
    title: 'Produtor Atrasou 3h',
    synopsis: 'Sem produtor, sem chave do galpão. Cliente ligando. Improvise plano B.',
    scenario: '⏰ Portão fechado. Sem chave. Carga no caminhão. Cliente liga a cada 5min.',
    difficulty: 'hard',
    timeLimitSeconds: 150,
    equipment: ['truss-straight', 'truss-corner', 'moving-head'],
    locked: true,
    briefing: {
      npcId: 'cliente-indeciso',
      lines: [
        { npcId: 'cliente-indeciso', text: 'Cadê vocês?? O DJ chega em 2 horas!' },
        { npcId: 'roadie-veterano', text: 'Vamos pré-montar no estacionamento. Truss base + um moving solo.' },
      ],
    },
    stages: [
      {
        id: 's1', kind: 'place', title: 'Pré-montagem improvisada',
        objectives: snapStageObjectives('producer-late'),
      },
    ],
    debrief: {
      title: 'Plano B executado',
      takeaways: [
        'Triagem de prioridade: monte o que pode ser realocado depois.',
        'Comunique o cliente proativamente — silêncio aumenta ansiedade.',
        'Documente atrasos para futura responsabilização contratual.',
      ],
    },
    scoreRules: DEFAULT_SCORE,
  },

  {
    id: 'full-reveillon',
    chapter: 'Cap. 4 — Show Completo',
    title: 'Réveillon — 5.000 Pessoas',
    synopsis: 'Show de réveillon completo. Pirotecnia, SFX, iluminação. Meia-noite é deadline imutável.',
    scenario: '🎆 31/Dez, 18h. Tudo precisa funcionar à meia-noite. Sem segunda chance.',
    difficulty: 'legendary',
    timeLimitSeconds: 300,
    equipment: ['truss-straight', 'truss-corner', 'moving-head', 'sparkular', 'flamer', 'cryo', 'mortar'],
    locked: true,
    briefing: {
      npcId: 'roadie-veterano',
      lines: [
        { npcId: 'roadie-veterano', text: 'Esta é a final. 5 mil pessoas. Zero tolerância a falha.' },
        { npcId: 'cliente-indeciso', text: 'Tudo perfeito, né? Né?? Meu chefe vai estar lá.' },
        { npcId: 'roadie-veterano', text: 'Vamos por etapas. Truss → SFX → Cryo. Calma.' },
      ],
    },
    stages: [
      {
        id: 's1', kind: 'place', title: 'Estrutura base',
        objectives: snapStageObjectives('full-reveillon').filter((o) => o.equipmentId?.startsWith('truss')),
      },
      {
        id: 's2', kind: 'place', title: 'SFX em altura',
        objectives: snapStageObjectives('full-reveillon').filter((o) =>
          ['sparkular', 'flamer'].includes(o.equipmentId ?? ''),
        ),
      },
      {
        id: 's3', kind: 'place', title: 'Cryo frontal',
        objectives: snapStageObjectives('full-reveillon').filter((o) => o.equipmentId === 'cryo'),
      },
    ],
    debrief: {
      title: 'Réveillon entregue — você é da casa agora',
      takeaways: [
        'Show grande = montagem em ondas, nunca tudo em paralelo.',
        'Cada estágio tem checkpoint próprio: nivelamento, energia, FR clearance.',
        'Backup de todos os subsistemas críticos: console, dimmer, igniter.',
      ],
    },
    scoreRules: { ...DEFAULT_SCORE, baseXP: 1000 },
  },
];

export function getMissionScript(id: string): MissionScript | undefined {
  return MISSION_SCRIPTS.find((m) => m.id === id);
}

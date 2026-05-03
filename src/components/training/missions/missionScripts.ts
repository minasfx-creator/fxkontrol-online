/**
 * Training v2.1 — Cinematic Mission Scripts catalog.
 *
 * 10 missions across 5 chapters. Each mission is a structured MissionScript
 * with briefing, staged objectives, NPC events, cinematic beats and a
 * debrief that links to existing reference manuals.
 *
 * SAFETY: all stages are simulation-only. No real hardware is armed,
 * fired, or energised by content here.
 */

import type { MissionScript, FailureScenario, CinematicBeat } from './types';
import { MISSION_SNAP_POINTS } from '../types';

const DEFAULT_SCORE = {
  baseXP: 100,
  timeBonusPerSecond: 2,
  safetyPenalty: 50,
  maxStars: 5,
};

const COMMON_FAILURES: FailureScenario[] = [
  {
    trigger: 'timeout',
    title: 'TEMPO ESGOTADO',
    flavor: 'O cliente já tá no portão. Você não tá pronto.',
    lesson: 'Em produção real, deadline é contratual. Subestimou o tempo de aperto cruzado em truss F34.',
  },
  {
    trigger: 'safety-violations-exceeded',
    title: 'EXCESSO DE INFRAÇÕES',
    flavor: '5 violações. O bombeiro não vai liberar o show.',
    lesson: 'NFPA 1123 exige zero exposição cruzada de SFX a área não-FR. Repense o layout antes de armar.',
  },
];

function snapStageObjectives(missionId: string) {
  return (MISSION_SNAP_POINTS[missionId] ?? []).map((sp) => ({
    snapPointId: sp.id,
    equipmentId: sp.equipmentType,
    label: sp.label,
  }));
}

const beatBriefingWide: CinematicBeat = {
  id: 'beat-brief-wide', triggerOn: 'briefing', shot: 'wide-establishing', durationMs: 3000,
};

const beatDebriefCrane: CinematicBeat = {
  id: 'beat-debrief-crane', triggerOn: 'debrief', shot: 'crane-down', durationMs: 3500,
};

export const MISSION_SCRIPTS: MissionScript[] = [
  // ═══ Cap. 1 — Carga & Montagem ═══════════════════════════════════
  {
    id: 'tutorial-truss',
    chapter: 'Cap. 1 — Carga & Montagem',
    title: '6 da Manhã, Galpão Vazio',
    synopsis: 'Sua primeira montagem real. Treliça em H — quatro pontos, nivelamento, café frio.',
    scenario: '🏗️ Galpão vazio, 6h. Café frio. O caminhão acabou de chegar.',
    difficulty: 'easy',
    timeLimitSeconds: 180,
    equipment: ['truss-straight', 'truss-corner'],
    locked: false,
    ambient: 'calm',
    cinematicBeats: [
      beatBriefingWide,
      { id: 'beat-corner-otss', triggerOn: 'stage-start', stageId: 's1', shot: 'over-the-shoulder', npcId: 'roadie-veterano', durationMs: 2500 },
      { id: 'beat-corners-done', triggerOn: 'stage-complete', stageId: 's1', shot: 'low-angle-hero', durationMs: 2200 },
      beatDebriefCrane,
    ],
    briefing: {
      npcId: 'roadie-veterano',
      lines: [
        { npcId: 'roadie-veterano', intent: 'calm', text: 'Beleza, novato. Treliça em H, frente e canto.' },
        { npcId: 'roadie-veterano', intent: 'serious', text: 'Começa pelo canto traseiro. Nivela. Aperta firme — torque 25 N·m.' },
      ],
    },
    stages: [
      {
        id: 's1', kind: 'place', title: 'Cantos traseiros',
        hint: 'Coloque as duas treliças de canto na linha traseira primeiro.',
        budgetSeconds: 60, manualRef: 'nfpa-1123',
        objectives: snapStageObjectives('tutorial-truss').filter((o) => o.equipmentId === 'truss-corner'),
        onEnter: [{ kind: 'speak', npcId: 'roadie-veterano', intent: 'calm', line: 'Cantos primeiro. Sempre.' }],
      },
      {
        id: 's2', kind: 'place', title: 'Vãos frontais',
        hint: 'Agora as duas retas frontais. Aperto cruzado, igual roda de carro.',
        budgetSeconds: 90,
        objectives: snapStageObjectives('tutorial-truss').filter((o) => o.equipmentId === 'truss-straight'),
        onComplete: [{ kind: 'speak', npcId: 'roadie-veterano', intent: 'calm', line: 'Bom. Agora confere o nível.' }],
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
    failureScenarios: COMMON_FAILURES,
  },

  {
    id: 'ground-support',
    chapter: 'Cap. 1 — Carga & Montagem',
    title: 'Ground Support Sob Pressão',
    synopsis: 'Quatro colunas + header. Cliente quer ver o palco em pé em 4h.',
    scenario: '🏗️ Quadrilátero ground-support. Empilhadeira não chegou — vai ser na manivela.',
    difficulty: 'medium',
    timeLimitSeconds: 240,
    equipment: ['truss-straight', 'truss-corner'],
    locked: false,
    ambient: 'busy',
    cinematicBeats: [
      beatBriefingWide,
      { id: 'beat-gs-orbit', triggerOn: 'stage-start', stageId: 's1', shot: 'orbit-slow', durationMs: 3500 },
      { id: 'beat-gs-header', triggerOn: 'stage-start', stageId: 's2', shot: 'crane-down', durationMs: 3000 },
      beatDebriefCrane,
    ],
    briefing: {
      npcId: 'roadie-veterano',
      lines: [
        { npcId: 'roadie-veterano', intent: 'calm', text: 'Quatro colunas primeiro. Diagonais alternadas no aperto.' },
        { npcId: 'roadie-veterano', intent: 'serious', text: 'Header só sobe quando as 4 colunas estiverem prumadas.' },
      ],
    },
    stages: [
      {
        id: 's1', kind: 'place', title: 'Colunas (4 cantos)',
        hint: 'Erga as 4 colunas em sequência diagonal: FL → BR → FR → BL.',
        budgetSeconds: 150, manualRef: 'nfpa-1123',
        objectives: snapStageObjectives('ground-support').filter((o) => o.equipmentId === 'truss-corner'),
      },
      {
        id: 's2', kind: 'place', title: 'Header frontal',
        hint: 'Suba o header somente após verificar prumo das 4 colunas.',
        budgetSeconds: 90,
        objectives: snapStageObjectives('ground-support').filter((o) => o.equipmentId === 'truss-straight'),
        onComplete: [{ kind: 'speak', npcId: 'roadie-veterano', intent: 'excited', line: 'Tá em pé. Bonito.' }],
      },
    ],
    debrief: {
      title: 'Ground support em pé — engenharia limpa',
      takeaways: [
        'Sequência diagonal evita esforço lateral em coluna isolada.',
        'Prumo de cada coluna ANTES do header — depois é tarde.',
        'Carga máxima do header ≠ soma de fixtures: derate 25% por dinâmica.',
      ],
    },
    scoreRules: DEFAULT_SCORE,
    failureScenarios: COMMON_FAILURES,
  },

  // ═══ Cap. 2 — Energia & DMX ═══════════════════════════════════════
  {
    id: 'ac-distro-check',
    chapter: 'Cap. 2 — Energia & DMX',
    title: 'Distribuição AC — Quem Aterrou Isso?',
    synopsis: 'Trifásico chegou no main. Bomba L1, bomba L2, RCD no centro. Sem PE = sem show.',
    scenario: '⚡ 8h. O eletricista chegou — pela primeira vez. Você confere TUDO.',
    difficulty: 'medium',
    timeLimitSeconds: 180,
    equipment: ['par-can', 'moving-head'],
    locked: false,
    ambient: 'busy',
    cinematicBeats: [
      beatBriefingWide,
      { id: 'beat-pe-close', triggerOn: 'stage-start', stageId: 's1', shot: 'close-up-reaction', npcId: 'eletricista-paulo', durationMs: 2400 },
      beatDebriefCrane,
    ],
    briefing: {
      npcId: 'eletricista-paulo',
      lines: [
        { npcId: 'eletricista-paulo', intent: 'calm', text: 'Trifásico tá em 220/380V. Aterramento separado, 25Ω máx.' },
        { npcId: 'roadie-veterano', intent: 'serious', text: 'Confere PE em CADA bomba. RCD no centro, 30mA, classe A.' },
      ],
    },
    stages: [
      {
        id: 's1', kind: 'inspect', title: 'PE bombas L1 e L2',
        hint: 'Toque cada PE-bomba para verificar continuidade ao terra.',
        budgetSeconds: 90, manualRef: 'phmsa-2010',
        objectives: snapStageObjectives('ac-distro-check').filter((o) => o.equipmentId === 'par-can'),
      },
      {
        id: 's2', kind: 'inspect', title: 'RCD central',
        hint: 'Pressione o teste do RCD — deve abrir em < 30ms.',
        budgetSeconds: 60,
        objectives: snapStageObjectives('ac-distro-check').filter((o) => o.equipmentId === 'moving-head'),
        onComplete: [{ kind: 'speak', npcId: 'eletricista-paulo', intent: 'calm', line: 'Liberado. Pode subir tensão.' }],
      },
    ],
    debrief: {
      title: 'Energia certificada',
      takeaways: [
        'PE separado de neutro até o quadro principal — TT ou TN-S, nunca TN-C-S no palco.',
        'RCD 30mA classe A pega DC residual; classe AC NÃO serve em show com fixtures LED.',
        'Aterramento ≤25Ω em terra seca — em chuva, refazer medição.',
      ],
    },
    scoreRules: DEFAULT_SCORE,
    failureScenarios: COMMON_FAILURES,
  },

  {
    id: 'dmx-config',
    chapter: 'Cap. 2 — Energia & DMX',
    title: 'Patch DMX na Correria',
    synopsis: '16 fixtures, 2 universos, 1 hora antes do soundcheck. Sem labels.',
    scenario: '🎛️ Console ligado. 200 cabos. Zero labels. O DJ tá ansioso.',
    difficulty: 'medium',
    timeLimitSeconds: 120,
    equipment: ['moving-head', 'par-can', 'sparkular'],
    locked: false,
    ambient: 'busy',
    cinematicBeats: [
      beatBriefingWide,
      { id: 'beat-dmx-dolly', triggerOn: 'stage-start', stageId: 's1', shot: 'dolly-in', durationMs: 2500 },
      beatDebriefCrane,
    ],
    briefing: {
      npcId: 'tecnica-som',
      lines: [
        { npcId: 'tecnica-som', intent: 'calm', text: 'Patch nos endereços do rider. Movings 1–4, PARs 5–8.' },
        { npcId: 'tecnica-som', intent: 'serious', text: 'Lembra do terminator 120Ω no fim da chain — sem ele, dá glitch.' },
      ],
    },
    stages: [
      {
        id: 's1', kind: 'patch', title: 'Movings na truss frontal',
        objectives: snapStageObjectives('dmx-config').filter((o) => o.equipmentId === 'moving-head'),
      },
      {
        id: 's2', kind: 'patch', title: 'PAR Cans + Sparkular',
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
    failureScenarios: COMMON_FAILURES,
  },

  // ═══ Cap. 3 — SFX & Pirotecnia ═══════════════════════════════════
  {
    id: 'sfx-setup',
    chapter: 'Cap. 3 — SFX & Pirotecnia',
    title: 'Sparkulars, Flamer e Cryo',
    synopsis: 'SFX completo. PE conferido. Hora de posicionar com clearance correta.',
    scenario: '🔥 9h. Eletricista liberou. Agora é layout NFPA.',
    difficulty: 'easy',
    timeLimitSeconds: 150,
    equipment: ['sparkular', 'flamer', 'cryo'],
    locked: false,
    ambient: 'calm',
    cinematicBeats: [
      beatBriefingWide,
      { id: 'beat-sfx-low', triggerOn: 'stage-start', stageId: 's2', shot: 'low-angle-hero', durationMs: 2400 },
      beatDebriefCrane,
    ],
    briefing: {
      npcId: 'roadie-veterano',
      lines: [
        { npcId: 'roadie-veterano', intent: 'calm', text: 'Sparkulars na truss, voltados pro público.' },
        { npcId: 'roadie-veterano', intent: 'serious', text: 'Flamer central com 3m verticais livres. Sem cabo perto.' },
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
      title: 'SFX posicionado com segurança',
      takeaways: [
        'Sparkulars apontados para o público — nunca para músicos ou cabos.',
        'Flamer exige 3m verticais livres + chão FR (flame retardant).',
        'Cryo CO₂ acumula em pits — cuidado com asfixia em palco rebaixado.',
      ],
    },
    scoreRules: DEFAULT_SCORE,
    failureScenarios: COMMON_FAILURES,
  },

  {
    id: 'nfpa-mortar-layout',
    chapter: 'Cap. 3 — SFX & Pirotecnia',
    title: 'Layout NFPA 1123 — Mortarios 3"',
    synopsis: 'Bombeiro está olhando. Cada metro de raio importa.',
    scenario: '🎆 Inspetor de bombeiros chegou. NFPA 1123 não negocia.',
    difficulty: 'hard',
    timeLimitSeconds: 180,
    equipment: ['mortar'],
    locked: false,
    ambient: 'calm',
    cinematicBeats: [
      beatBriefingWide,
      { id: 'beat-bombeiro-close', triggerOn: 'stage-start', stageId: 's1', shot: 'close-up-reaction', npcId: 'bombeiro-fiscal', durationMs: 2600 },
      { id: 'beat-mortar-orbit', triggerOn: 'stage-complete', stageId: 's1', shot: 'orbit-slow', durationMs: 3500 },
      beatDebriefCrane,
    ],
    briefing: {
      npcId: 'bombeiro-fiscal',
      lines: [
        { npcId: 'bombeiro-fiscal', intent: 'serious', text: 'NFPA 1123: mortar 3" → raio 70 ft (21m) ao público.' },
        { npcId: 'roadie-veterano', intent: 'calm', text: 'Vamos plotar 3 morteiros respeitando o raio. Inspetor vai conferir cada um.' },
      ],
    },
    stages: [
      {
        id: 's1', kind: 'place', title: 'Plotar morteiros 3"',
        hint: 'Coloque os 3 morteiros nos pontos demarcados. Distância mínima 21m do público.',
        budgetSeconds: 150, manualRef: 'nfpa-1123',
        objectives: snapStageObjectives('nfpa-mortar-layout'),
        onComplete: [
          { kind: 'speak', npcId: 'bombeiro-fiscal', intent: 'serious', line: 'Layout aprovado. Pode armar.' },
        ],
      },
    ],
    debrief: {
      title: 'NFPA 1123 — layout aprovado',
      takeaways: [
        'Mortar 3" exige raio mínimo 70 ft (21m) ao público (NFPA 1123 §6.4).',
        'Fallout zone DOBRA do raio em direção do vento dominante.',
        'Anchoring: 50% do calibre enterrado em areia ou rack metálico certificado.',
      ],
    },
    scoreRules: { ...DEFAULT_SCORE, baseXP: 250 },
    failureScenarios: COMMON_FAILURES,
  },

  // ═══ Cap. 4 — Caos ao Vivo ═══════════════════════════════════════
  {
    id: 'drunk-invasion',
    chapter: 'Cap. 4 — Caos ao Vivo',
    title: 'Bêbado no Palco',
    synopsis: 'Convidado bêbado invadiu a área técnica. Sparkulars armados. Decisões em segundos.',
    scenario: '🍺 22h. Pista lotada. Segurança sumiu. O cara quer "apertar um botão".',
    difficulty: 'medium',
    timeLimitSeconds: 90,
    equipment: ['sparkular', 'flamer'],
    locked: false,
    ambient: 'frantic',
    cinematicBeats: [
      { id: 'beat-drunk-close', triggerOn: 'briefing', shot: 'close-up-reaction', npcId: 'convidado-bebado', durationMs: 2200 },
      { id: 'beat-sec-arrive', triggerOn: 'stage-start', stageId: 's1', shot: 'medium-2shot', npcId: 'seguranca', durationMs: 2400 },
      beatDebriefCrane,
    ],
    briefing: {
      npcId: 'roadie-veterano',
      lines: [
        { npcId: 'convidado-bebado', intent: 'sarcastic', text: 'Eeeei mano *hic* esse botão aqui é o quê?' },
        { npcId: 'roadie-veterano', intent: 'urgent', text: 'KILL SWITCH AGORA. Coloca os SFX em posição segura. Sem firing.' },
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
          { kind: 'speak', npcId: 'seguranca', intent: 'serious', line: 'Sai daqui, parceiro. Vem comigo.' },
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
    failureScenarios: COMMON_FAILURES,
  },

  {
    id: 'rain-emergency',
    chapter: 'Cap. 4 — Caos ao Vivo',
    title: 'Chuva no Show',
    synopsis: 'Front frio chegou de surpresa. Você tem 90s pra proteger SFX antes da banda subir.',
    scenario: '🌧️ Pingou. Pingou de novo. Em 60s vira temporal.',
    difficulty: 'hard',
    timeLimitSeconds: 90,
    equipment: ['sparkular', 'flamer', 'cryo'],
    locked: false,
    ambient: 'frantic',
    cinematicBeats: [
      { id: 'beat-rain-wide', triggerOn: 'briefing', shot: 'wide-establishing', durationMs: 2800 },
      { id: 'beat-rain-dolly', triggerOn: 'stage-start', stageId: 's1', shot: 'dolly-in', durationMs: 2400 },
      beatDebriefCrane,
    ],
    briefing: {
      npcId: 'roadie-veterano',
      lines: [
        { npcId: 'roadie-veterano', intent: 'urgent', text: 'Chuva forte chegando. Sparkulars cobertos AGORA.' },
        { npcId: 'tecnica-som', intent: 'urgent', text: 'Flamer não pode ficar exposto. E o cryo, manda pra lateral.' },
      ],
    },
    stages: [
      {
        id: 's1', kind: 'evacuate', title: 'Cobrir SFX e desligar flamer',
        hint: 'Cobrir Sparkular L+R, desligar Flamer, reposicionar Cryo.',
        budgetSeconds: 90, manualRef: 'manual-pirotecnia-1931',
        objectives: snapStageObjectives('rain-emergency'),
      },
    ],
    debrief: {
      title: 'SFX salvo — show segue',
      takeaways: [
        'IP44 mínimo para SFX outdoor — sparkular não-IP queima em chuva.',
        'Flamer + chuva = vapor = burn-back. Desligar e drenar.',
        'Cryo CO₂ pode ficar — só não pode encharcar a válvula.',
      ],
    },
    scoreRules: { ...DEFAULT_SCORE, baseXP: 250 },
    failureScenarios: COMMON_FAILURES,
  },

  {
    id: 'producer-late',
    chapter: 'Cap. 4 — Caos ao Vivo',
    title: 'Produtor Atrasou 3h',
    synopsis: 'Sem produtor, sem chave do galpão. Cliente ligando. Improvise plano B.',
    scenario: '⏰ Portão fechado. Sem chave. Carga no caminhão. Cliente liga a cada 5min.',
    difficulty: 'hard',
    timeLimitSeconds: 150,
    equipment: ['truss-straight', 'truss-corner', 'moving-head'],
    locked: true,
    ambient: 'busy',
    cinematicBeats: [
      beatBriefingWide,
      { id: 'beat-cli-close', triggerOn: 'briefing', shot: 'close-up-reaction', npcId: 'cliente-indeciso', durationMs: 2400 },
      beatDebriefCrane,
    ],
    briefing: {
      npcId: 'cliente-indeciso',
      lines: [
        { npcId: 'cliente-indeciso', intent: 'urgent', text: 'Cadê vocês?? O DJ chega em 2 horas!' },
        { npcId: 'roadie-veterano', intent: 'calm', text: 'Vamos pré-montar no estacionamento. Truss base + um moving solo.' },
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
    failureScenarios: COMMON_FAILURES,
  },

  // ═══ Cap. 5 — Show Completo ══════════════════════════════════════
  {
    id: 'full-reveillon',
    chapter: 'Cap. 5 — Show Completo',
    title: 'Réveillon — 5.000 Pessoas',
    synopsis: 'Show de réveillon completo. Pirotecnia, SFX, iluminação. Meia-noite é deadline imutável.',
    scenario: '🎆 31/Dez, 18h. Tudo precisa funcionar à meia-noite. Sem segunda chance.',
    difficulty: 'legendary',
    timeLimitSeconds: 360,
    equipment: ['truss-straight', 'truss-corner', 'moving-head', 'sparkular', 'flamer', 'cryo', 'mortar'],
    locked: true,
    ambient: 'frantic',
    cinematicBeats: [
      { id: 'beat-rev-wide', triggerOn: 'briefing', shot: 'wide-establishing', durationMs: 4000 },
      { id: 'beat-rev-corp-close', triggerOn: 'briefing', shot: 'close-up-reaction', npcId: 'cliente-corporativo', durationMs: 2400 },
      { id: 'beat-rev-orbit', triggerOn: 'stage-start', stageId: 's1', shot: 'orbit-slow', durationMs: 4000 },
      { id: 'beat-rev-crane-mid', triggerOn: 'stage-complete', stageId: 's2', shot: 'crane-down', durationMs: 3000 },
      beatDebriefCrane,
    ],
    briefing: {
      npcId: 'roadie-veterano',
      lines: [
        { npcId: 'roadie-veterano', intent: 'serious', text: 'Esta é a final. 5 mil pessoas. Zero tolerância a falha.' },
        { npcId: 'cliente-corporativo', intent: 'urgent', text: 'Tudo perfeito, né? Né?? Meu chefe vai estar lá.' },
        { npcId: 'roadie-veterano', intent: 'calm', text: 'Vamos por etapas. Truss → SFX → Cryo. Calma.' },
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
    failureScenarios: COMMON_FAILURES,
  },
];

export function getMissionScript(id: string): MissionScript | undefined {
  return MISSION_SCRIPTS.find((m) => m.id === id);
}

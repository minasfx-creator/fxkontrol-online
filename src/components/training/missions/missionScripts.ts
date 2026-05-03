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

  // ═══ Cap. 6 — Soundcheck & Pré-Show ══════════════════════════════
  {
    id: 'soundcheck-runthrough',
    chapter: 'Cap. 6 — Soundcheck & Pré-Show',
    title: 'Soundcheck — Cue por Cue',
    synopsis: 'Banda no palco, console aberto. Walk-through dos 3 cues principais antes do público entrar.',
    scenario: '🎤 16h. Banda fazendo passagem. Você dispara cada cue uma vez, sem improviso.',
    difficulty: 'medium',
    timeLimitSeconds: 180,
    equipment: ['moving-head', 'sparkular'],
    locked: false,
    ambient: 'busy',
    cinematicBeats: [
      beatBriefingWide,
      { id: 'beat-sc-otss', triggerOn: 'stage-start', stageId: 's1', shot: 'over-the-shoulder', npcId: 'tecnica-som', durationMs: 2600 },
      { id: 'beat-sc-low', triggerOn: 'stage-start', stageId: 's2', shot: 'low-angle-hero', durationMs: 2400 },
      { id: 'beat-sc-orbit', triggerOn: 'stage-complete', stageId: 's3', shot: 'orbit-slow', durationMs: 3200 },
      beatDebriefCrane,
    ],
    briefing: {
      npcId: 'tecnica-som',
      lines: [
        { npcId: 'tecnica-som', intent: 'calm', text: 'Vamos cue por cue. Sem afobação.' },
        { npcId: 'dj-residente', intent: 'excited', text: 'Manda o sparkular no refrão pra eu sentir o tempo.' },
        { npcId: 'roadie-veterano', intent: 'serious', text: 'Anota o GO em cada cue. Show ao vivo é repetição.' },
      ],
    },
    stages: [
      {
        id: 's1', kind: 'patch', title: 'Cue 1 — Movings entram',
        hint: 'Confira que Movings L/R respondem ao GO 1 sem latência > 80ms.',
        budgetSeconds: 60,
        objectives: snapStageObjectives('soundcheck-runthrough').filter((o) => o.equipmentId === 'moving-head'),
        onEnter: [{ kind: 'speak', npcId: 'tecnica-som', intent: 'calm', line: 'GO 1 — movings.' }],
      },
      {
        id: 's2', kind: 'fire-check', title: 'Cue 3 — Sparkular no refrão',
        hint: 'Dispare Sparkular Central — duração 8s, beat na contagem 4.',
        budgetSeconds: 60, manualRef: 'manual-pirotecnia-1931',
        objectives: snapStageObjectives('soundcheck-runthrough').filter((o) => o.equipmentId === 'sparkular'),
        onEnter: [{ kind: 'speak', npcId: 'dj-residente', intent: 'excited', line: 'Cue 3 — manda ver!' }],
      },
      {
        id: 's3', kind: 'dialogue', title: 'Confirmação com a banda',
        objectives: [{ label: 'Confirmar tempos com banda', snapPointId: 'sp-1', equipmentId: 'moving-head' }],
        dialogue: [
          { npcId: 'dj-residente', intent: 'calm', text: 'Senti o sparkular meio adiantado.' },
          { npcId: 'tecnica-som', intent: 'calm', text: 'Vou pré-roll 120ms. Resolve.' },
          { npcId: 'roadie-veterano', intent: 'calm', text: 'Show fica certo no detalhe.' },
        ],
      },
    ],
    debrief: {
      title: 'Soundcheck limpo — banda alinhada',
      takeaways: [
        'Latência cue→fixture deve ser ≤80ms para sincronia perceptível.',
        'Sparkular precisa de pré-roll (~100–150ms) por causa da rampa térmica.',
        'Anote cada GO no cue sheet — show ao vivo é memória de papel.',
      ],
    },
    scoreRules: { ...DEFAULT_SCORE, baseXP: 200 },
    failureScenarios: COMMON_FAILURES,
  },

  {
    id: 'doors-open',
    chapter: 'Cap. 6 — Soundcheck & Pré-Show',
    title: 'Abertura dos Portões',
    synopsis: 'Bombeiro libera, você faz o sweep final de zonas de fallout antes do público entrar.',
    scenario: '🚪 18h45. Fila lá fora. Inspetor com prancheta. Última chance de pegar uma falha.',
    difficulty: 'medium',
    timeLimitSeconds: 150,
    equipment: ['mortar', 'truss-corner'],
    locked: false,
    ambient: 'calm',
    cinematicBeats: [
      beatBriefingWide,
      { id: 'beat-do-2shot', triggerOn: 'briefing', shot: 'medium-2shot', npcId: 'bombeiro-fiscal', durationMs: 2600 },
      { id: 'beat-do-orbit', triggerOn: 'stage-start', stageId: 's1', shot: 'orbit-slow', durationMs: 3200 },
      { id: 'beat-do-hero', triggerOn: 'stage-complete', stageId: 's2', shot: 'low-angle-hero', durationMs: 2400 },
      beatDebriefCrane,
    ],
    briefing: {
      npcId: 'bombeiro-fiscal',
      lines: [
        { npcId: 'bombeiro-fiscal', intent: 'serious', text: 'Sweep final. Quero ver cada zona de fallout limpa.' },
        { npcId: 'bombeiro-jovem', intent: 'calm', text: 'Marquei as três áreas críticas com cone laranja.' },
        { npcId: 'roadie-veterano', intent: 'calm', text: 'Faz o circuito frente → cantos. 5 minutos.' },
      ],
    },
    stages: [
      {
        id: 's1', kind: 'inspect', title: 'Sweep frente palco',
        hint: 'Caminhe pela frente do palco — qualquer detrito vira projétil em concussão.',
        budgetSeconds: 60, manualRef: 'nfpa-1123',
        objectives: snapStageObjectives('doors-open').filter((o) => o.equipmentId === 'mortar'),
      },
      {
        id: 's2', kind: 'inspect', title: 'Sweep cantos de fallout',
        hint: 'Cantos esquerdo e direito — confira distância e ausência de público entrando lateralmente.',
        budgetSeconds: 75, manualRef: 'nfpa-1123',
        objectives: snapStageObjectives('doors-open').filter((o) => o.equipmentId === 'truss-corner'),
        onComplete: [{ kind: 'speak', npcId: 'bombeiro-fiscal', intent: 'serious', line: 'Liberado. Pode abrir portão.' }],
      },
    ],
    debrief: {
      title: 'Portões abertos — público seguro',
      takeaways: [
        'Sweep visual de fallout é parte do auto de vistoria — não é opcional.',
        'Detrito leve (copo, panfleto) vira projétil em onda de choque a 5m.',
        'Documente o sweep com foto antes da abertura — vira prova em caso de incidente.',
      ],
    },
    scoreRules: { ...DEFAULT_SCORE, baseXP: 220 },
    failureScenarios: COMMON_FAILURES,
  },

  {
    id: 'cue-call-live',
    chapter: 'Cap. 6 — Soundcheck & Pré-Show',
    title: 'Cue Call no Headset',
    synopsis: 'Show rolando. Você chama os cues no headset enquanto operador dispara. Comunicação clara salva tempo.',
    scenario: '🎧 21h. Refrão chegando. Você é a voz no headset.',
    difficulty: 'hard',
    timeLimitSeconds: 120,
    equipment: ['moving-head', 'par-can', 'sparkular'],
    locked: false,
    ambient: 'frantic',
    cinematicBeats: [
      { id: 'beat-cc-close', triggerOn: 'briefing', shot: 'close-up-reaction', npcId: 'tecnica-som', durationMs: 2200 },
      { id: 'beat-cc-otss', triggerOn: 'stage-start', stageId: 's1', shot: 'over-the-shoulder', npcId: 'roadie-veterano', durationMs: 2400 },
      { id: 'beat-cc-dolly', triggerOn: 'stage-start', stageId: 's2', shot: 'dolly-in', durationMs: 2200 },
      { id: 'beat-cc-hero', triggerOn: 'stage-complete', stageId: 's3', shot: 'low-angle-hero', durationMs: 2600 },
      beatDebriefCrane,
    ],
    briefing: {
      npcId: 'roadie-veterano',
      lines: [
        { npcId: 'roadie-veterano', intent: 'serious', text: 'Linguagem padrão: STANDBY → GO. Sem firula.' },
        { npcId: 'tecnica-som', intent: 'calm', text: 'Eu confirmo cada GO. Se duvidar, repete.' },
        { npcId: 'dj-residente', intent: 'excited', text: 'Refrão é em 32 compassos. Conta comigo.' },
      ],
    },
    stages: [
      {
        id: 's1', kind: 'patch', title: 'Standby Movings A',
        hint: '"Standby Movings A em 4 compassos." Confira patch antes de chamar GO.',
        budgetSeconds: 30,
        objectives: snapStageObjectives('cue-call-live').filter((o) => o.equipmentId === 'moving-head'),
      },
      {
        id: 's2', kind: 'patch', title: 'GO PARs B no break',
        hint: 'Break de bateria — chame "GO PARs B" no downbeat seguinte.',
        budgetSeconds: 30,
        objectives: snapStageObjectives('cue-call-live').filter((o) => o.equipmentId === 'par-can'),
        onEnter: [{ kind: 'speak', npcId: 'roadie-veterano', intent: 'urgent', line: 'GO PARs B — agora!' }],
      },
      {
        id: 's3', kind: 'fire-check', title: 'Sparkular no refrão',
        hint: 'Refrão entra. Standby Sparkular → GO no compasso 1.',
        budgetSeconds: 45, manualRef: 'manual-pirotecnia-1931',
        objectives: snapStageObjectives('cue-call-live').filter((o) => o.equipmentId === 'sparkular'),
        onComplete: [
          { kind: 'speak', npcId: 'dj-residente', intent: 'excited', line: 'IIIIISSO! Pegou em cima!' },
          { kind: 'speak', npcId: 'tecnica-som', intent: 'calm', line: 'Cue limpo. Próximo bloco em 2 min.' },
        ],
      },
    ],
    debrief: {
      title: 'Cue call profissional — show no compasso',
      takeaways: [
        'STANDBY antecipa em 4–8 compassos; GO no downbeat exato.',
        'Confirmação de canal ("copy GO movings") evita disparo duplo.',
        'Em refrão, prefira chamar pelo número da contagem que pelo nome do cue.',
      ],
    },
    scoreRules: { ...DEFAULT_SCORE, baseXP: 350 },
    failureScenarios: COMMON_FAILURES,
  },

  {
    id: 'encore-improv',
    chapter: 'Cap. 6 — Soundcheck & Pré-Show',
    title: 'Bis Inesperado',
    synopsis: 'Banda volta pro bis sem aviso. Você tem que improvisar SFX com o que sobrou de carga.',
    scenario: '🎶 23h40. Cortina caiu. Público gritando "MAIS!". Banda sobe de novo.',
    difficulty: 'hard',
    timeLimitSeconds: 90,
    equipment: ['sparkular', 'cryo'],
    locked: false,
    ambient: 'frantic',
    cinematicBeats: [
      { id: 'beat-en-wide', triggerOn: 'briefing', shot: 'wide-establishing', durationMs: 2600 },
      { id: 'beat-en-close', triggerOn: 'briefing', shot: 'close-up-reaction', npcId: 'dj-residente', durationMs: 2000 },
      { id: 'beat-en-dolly', triggerOn: 'stage-start', stageId: 's1', shot: 'dolly-in', durationMs: 2400 },
      { id: 'beat-en-hero', triggerOn: 'stage-complete', stageId: 's2', shot: 'low-angle-hero', durationMs: 2800 },
      beatDebriefCrane,
    ],
    briefing: {
      npcId: 'dj-residente',
      lines: [
        { npcId: 'dj-residente', intent: 'excited', text: 'Eles voltaram! Manda algo no último refrão!' },
        { npcId: 'roadie-veterano', intent: 'serious', text: 'Sobrou 1 carga de Sparkular cada lado. CO₂ tá cheio.' },
        { npcId: 'tecnica-som', intent: 'urgent', text: 'Decide rápido — tem 30s.' },
      ],
    },
    stages: [
      {
        id: 's1', kind: 'fire-check', title: 'Sparkulars laterais',
        hint: 'Aloque 1 carga em L e 1 em R. Sem reserva pra erro.',
        budgetSeconds: 45, manualRef: 'manual-pirotecnia-1931',
        objectives: snapStageObjectives('encore-improv').filter((o) => o.equipmentId === 'sparkular'),
      },
      {
        id: 's2', kind: 'fire-check', title: 'Cryo no clímax',
        hint: 'Cryo de 4s no último compasso — esvazia o tanque.',
        budgetSeconds: 30,
        objectives: snapStageObjectives('encore-improv').filter((o) => o.equipmentId === 'cryo'),
        onComplete: [{ kind: 'speak', npcId: 'dj-residente', intent: 'excited', line: 'PERFEITO! Salvou o bis!' }],
      },
    ],
    debrief: {
      title: 'Bis salvo — improviso disciplinado',
      takeaways: [
        'Improviso ≠ aleatoriedade. Conheça o estoque restante antes de prometer.',
        'Cryo CO₂ tem rampa de 0.8s — dispare 1 compasso antes do clímax.',
        'Documente cargas usadas no bis — afeta inventário do próximo show.',
      ],
    },
    scoreRules: { ...DEFAULT_SCORE, baseXP: 400 },
    failureScenarios: COMMON_FAILURES,
  },

  // ═══ Cap. 7 — Pós-Show & Logística ═══════════════════════════════
  {
    id: 'teardown-rush',
    chapter: 'Cap. 7 — Pós-Show & Logística',
    title: 'Desmontagem 4h — Galpão Tem Outro Show',
    synopsis: 'Show acabou meia-noite. 4h pra desmontar tudo. Próximo cliente chega 5h.',
    scenario: '📦 00h15. Caminhão na rampa. Galpão tem entrega às 5h.',
    difficulty: 'medium',
    timeLimitSeconds: 240,
    equipment: ['cryo', 'sparkular', 'truss-straight'],
    locked: false,
    ambient: 'busy',
    cinematicBeats: [
      beatBriefingWide,
      { id: 'beat-td-orbit', triggerOn: 'stage-start', stageId: 's1', shot: 'orbit-slow', durationMs: 3000 },
      { id: 'beat-td-otss', triggerOn: 'stage-start', stageId: 's2', shot: 'over-the-shoulder', npcId: 'roadie-veterano', durationMs: 2400 },
      { id: 'beat-td-crane', triggerOn: 'stage-complete', stageId: 's3', shot: 'crane-down', durationMs: 3200 },
      beatDebriefCrane,
    ],
    briefing: {
      npcId: 'roadie-veterano',
      lines: [
        { npcId: 'roadie-veterano', intent: 'calm', text: 'Ordem inversa: SFX → fixtures → truss. Sempre.' },
        { npcId: 'tecnica-som', intent: 'serious', text: 'Cryo primeiro — válvula esfria 5min antes de guardar.' },
        { npcId: 'produtor-ansioso', intent: 'urgent', text: 'O dono do galpão tá ligando. Anda!' },
      ],
    },
    stages: [
      {
        id: 's1', kind: 'inspect', title: 'Recolher Cryo (válvula fria)',
        hint: 'Feche válvula, espere 5min, drene linha, só então desconecte.',
        budgetSeconds: 60,
        objectives: snapStageObjectives('teardown-rush').filter((o) => o.equipmentId === 'cryo'),
      },
      {
        id: 's2', kind: 'place', title: 'Descer Sparkulars',
        hint: 'Sparkulars descem ANTES da truss. Cabos enrolados em 8.',
        budgetSeconds: 90,
        objectives: snapStageObjectives('teardown-rush').filter((o) => o.equipmentId === 'sparkular'),
      },
      {
        id: 's3', kind: 'place', title: 'Truss frontal',
        hint: 'Truss desce com guia em cada ponta. Nunca uma pessoa só.',
        budgetSeconds: 90,
        objectives: snapStageObjectives('teardown-rush').filter((o) => o.equipmentId === 'truss-straight'),
        onComplete: [{ kind: 'speak', npcId: 'roadie-veterano', intent: 'calm', line: 'Caminhão fechado. Bora dormir.' }],
      },
    ],
    debrief: {
      title: 'Desmontagem no prazo — case fechado',
      takeaways: [
        'Ordem inversa de montagem evita carga residual em ponto frágil.',
        'Cryo CO₂ exige 5min de despressurização — válvula gelada queima pele.',
        'Truss desce em dupla com guia em cada extremidade — nunca solo.',
      ],
    },
    scoreRules: { ...DEFAULT_SCORE, baseXP: 280 },
    failureScenarios: COMMON_FAILURES,
  },

  {
    id: 'blackbox-debrief',
    chapter: 'Cap. 7 — Pós-Show & Logística',
    title: 'Debrief — Black Box do Show',
    synopsis: 'Sentar com a equipe e revisar o que falhou. Documentar pro próximo show não repetir.',
    scenario: '☕ 02h. Café na mão. Notebook aberto. Black box rodando.',
    difficulty: 'easy',
    timeLimitSeconds: 180,
    equipment: ['moving-head'],
    locked: false,
    ambient: 'calm',
    cinematicBeats: [
      beatBriefingWide,
      { id: 'beat-db-2shot', triggerOn: 'briefing', shot: 'medium-2shot', npcId: 'tecnica-som', durationMs: 2400 },
      { id: 'beat-db-otss', triggerOn: 'stage-start', stageId: 's1', shot: 'over-the-shoulder', npcId: 'roadie-veterano', durationMs: 2400 },
      { id: 'beat-db-close', triggerOn: 'stage-start', stageId: 's2', shot: 'close-up-reaction', npcId: 'tecnica-som', durationMs: 2200 },
      beatDebriefCrane,
    ],
    briefing: {
      npcId: 'roadie-veterano',
      lines: [
        { npcId: 'roadie-veterano', intent: 'calm', text: 'Show foi bom. Mas teve coisa pra melhorar. Senta.' },
        { npcId: 'tecnica-som', intent: 'calm', text: 'Trouxe o log do console. 3 cues fora de tempo.' },
        { npcId: 'produtor-ansioso', intent: 'serious', text: 'Cliente reclamou do atraso na entrada. Bora resolver.' },
      ],
    },
    stages: [
      {
        id: 's1', kind: 'dialogue', title: 'Revisão dos cues atrasados',
        objectives: [{ label: 'Confirmar root cause', snapPointId: 'sp-1', equipmentId: 'moving-head' }],
        dialogue: [
          { npcId: 'tecnica-som', intent: 'calm', text: 'Cue 7, 12 e 18 — todos atrás de pré-roll do sparkular.' },
          { npcId: 'roadie-veterano', intent: 'serious', text: 'Marca no cue sheet: pré-roll padrão 130ms, não 100.' },
          { npcId: 'tecnica-som', intent: 'calm', text: 'Anotado. Próximo show já vai com isso.' },
        ],
      },
      {
        id: 's2', kind: 'dialogue', title: 'Plano de ação',
        objectives: [{ label: 'Definir 3 ações concretas', snapPointId: 'sp-1', equipmentId: 'moving-head' }],
        dialogue: [
          { npcId: 'produtor-ansioso', intent: 'urgent', text: 'Entrada: vou pedir 30min a mais de buffer.' },
          { npcId: 'roadie-veterano', intent: 'calm', text: 'Pré-roll padronizado. Cue sheet versionado.' },
          { npcId: 'tecnica-som', intent: 'calm', text: 'Show profissional é o que aprende com o anterior.' },
        ],
        onComplete: [{ kind: 'speak', npcId: 'roadie-veterano', intent: 'calm', line: 'Bom debrief. Até o próximo.' }],
      },
    ],
    debrief: {
      title: 'Lições documentadas — equipe mais forte',
      takeaways: [
        'Black box do show = log + cue sheet anotado + foto do palco montado.',
        'Debrief sem culpa, com fato: "cue 7 atrasou 130ms" não "Fulano errou".',
        'Toda lição vira regra escrita no manual interno — senão se perde.',
      ],
    },
    scoreRules: { ...DEFAULT_SCORE, baseXP: 180 },
    failureScenarios: COMMON_FAILURES,
  },
];

export function getMissionScript(id: string): MissionScript | undefined {
  return MISSION_SCRIPTS.find((m) => m.id === id);
}

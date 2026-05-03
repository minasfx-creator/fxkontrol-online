
# Training Mode 2.0 — "GTA V Roadie Edition"

Atuando como dev de Unreal Engine 5, vou elevar o módulo `/training` de "puzzle de snap-points" para uma experiência **narrativa, cinemática e tecnicamente útil** — estilo GTA V (briefing → execução → debrief), com NPCs no estilo "stand-in MetaHuman" (proporções humanóides, materiais PBR, eyelines, lipsync básico, idle animado), missões em capítulos com objetivos staged e foco real em montagem de palco profissional.

> Restrição: continuamos em **Three.js / R3F** (não há UE5 runtime no browser). "Estilo MetaHuman / UE5" = **pipeline de aparência** (proporções corretas, skinning simulado por bones, materiais PBR, SSS aproximado, rim light, DOF leve no closeup, motion-matching de idle). Nada de armar/disparar pirotecnia real — segue 100% `workMode = simulation`.

---

## 1. Arquitetura de Missões (Cinematic Mission Spec)

Substituo a `Mission` flat atual por um **MissionScript** estruturado, inspirado em mission flows de Rockstar:

```text
MissionScript
├─ briefing        (cutscene curta + diálogo NPC)
├─ stages[]        (objetivos sequenciais, não paralelos)
│   ├─ stage.kind  ("place" | "patch" | "inspect" | "evacuate" | "fire-check" | "dialogue")
│   ├─ snapPoints  (subset, revelados por stage)
│   ├─ npcEvents   (entradas/saídas de NPCs, falas, gatilhos)
│   ├─ failConds   (timeout, contato com NPC, ordem errada)
│   └─ scoreRules  (precisão, tempo, segurança)
├─ debrief         (relatório técnico real: o que aprendeu)
└─ realWorldRefs   (links para manuais já existentes em MANUALS[])
```

Arquivos novos:
- `src/components/training/missions/missionScripts.ts` — catálogo de scripts.
- `src/components/training/missions/types.ts` — tipos `MissionScript`, `MissionStage`, `NPCEvent`, `DialogueLine`.
- `src/components/training/missions/missionRunner.ts` — máquina de estados pura (stage advance, fail, score), testável.

## 2. Novas Missões (treinamento técnico real)

10 missões reescritas + 6 novas, cobrindo o ciclo real de produção:

| # | Missão | Capítulo | O que treina (real) |
|---|---|---|---|
| 1 | **"6 da Manhã, Galpão Vazio"** | Cap.1 Montagem | Sequência de montagem de truss em H, torque de parafusos, conferência de níveis |
| 2 | **"Rigging Vertical"** | Cap.1 | Rigging de motor, ponto de carga, ângulo seguro de cabo (≤30°), CWLL |
| 3 | **"O Eletricista Sumiu"** | Cap.2 SFX | Distribuição AC, balanço de fases, PE/aterramento, RCD trip teste |
| 4 | **"Patch DMX na Correria"** | Cap.2 | Universo/endereçamento, terminator 120Ω, daisy chain ≤32 fixtures |
| 5 | **"Sparkular Safety Brief"** *(nova)* | Cap.3 SFX | Distância 3m, cone 7m, FR pano, MSDS Ti grão, leitura de display |
| 6 | **"Flame Bar Wind Check"** *(nova)* | Cap.3 SFX | Anemômetro, vento ≤16km/h, abort threshold, comunicação com SM |
| 7 | **"Cryo CO₂ — Asfixia"** *(nova)* | Cap.3 | Ventilação, sensor CO₂ 5000ppm, posicionamento longe de pit |
| 8 | **"Bêbado no Palco"** | Cap.4 Caos | Protocolo de evacuação técnica, kill switch SFX, comunicação rádio |
| 9 | **"Produtor Atrasou 3h"** | Cap.4 | Triagem de prioridade, plano B, comunicação com cliente |
| 10 | **"Chuva 30min Antes"** *(nova)* | Cap.4 | IP rating, lonas, hold/cancel decision tree, salva-show |
| 11 | **"Dimmer com Cheiro"** *(nova)* | Cap.4 | Reconhecer falha térmica, isolar circuito, redundância |
| 12 | **"Soundcheck + Pyro Briefing"** *(nova)* | Cap.5 Pré-show | Walk-through com banda, no-go zones, hand signals |
| 13 | **"Chefe-de-Pista Inspeciona"** | Cap.6 NFPA | Checklist NFPA 1123 ao vivo, raios por calibre, fallout zone |
| 14 | **"Fiscal PHMSA na Porta"** | Cap.6 | Classificação 1.1G–1.4G, manifesto, lacres |
| 15 | **"Réveillon — 5.000 Pessoas"** | Cap.7 Show | Run de 8 stages encadeados, todos os sistemas anteriores |
| 16 | **"Debrief & Lessons Learned"** *(nova)* | Cap.7 | Pós-show: relatório de incidentes, devolução, contagem de invendidos |

Cada missão tem:
- **Briefing cinemático** (3–6s) com câmera dolly e NPC falando.
- **Objetivos revelados em stages** (não tudo de uma vez) — estilo GTA V "Mission Triangle".
- **Diálogo contextual** durante a execução (hint NPC se travar 15s).
- **Debrief técnico** com link para o manual real (`MANUALS[]` já existente).
- **Score breakdown**: precisão (%), tempo, segurança, comunicação.

## 3. NPCs estilo MetaHuman / UE5 (aparência)

Substituo os NPCs box-art atuais por um **HumanoidCharacter** unificado e parametrizável.

`src/components/training/humanoid/HumanoidCharacter.tsx`:
- Esqueleto canônico (16 bones) com `THREE.SkinnedMesh` simulado via grupos hierárquicos.
- **Proporções MetaHuman**: 7.5 heads tall, ombros 2.2 head-widths, etc.
- **Materiais PBR**: `MeshPhysicalMaterial` com `clearcoat` (pele), `sheen` (tecido), `transmission` (óculos).
- **SSS aproximado** via `emissive` modulado pelo dot(N,L) — fake mas convincente em closeup.
- **Eye-tracking**: olhos seguem câmera ou alvo via `lookAt` em meshes oculares separadas.
- **Lipsync básico**: amplitude de boca segue envelope da string falada (chars/s + jaw open).
- **Idle motion-matching**: mistura 3 idle loops (peso, breath, fidget) com Perlin noise.
- **Rim light** dedicada por NPC quando em closeup (cinematográfico).

Personagens:
| ID | Papel | Vibe |
|---|---|---|
| `roadie-veterano` | Mentor (técnico-chefe) | "Big Smoke roadie", barba grisalha, colete fluorescente |
| `produtor-ansioso` | Produtor atrasado | Headset, prancheta, tablet, andando rápido |
| `cliente-indeciso` | Cliente luxo | Blazer, óculos, gesticula |
| `convidado-bebado` | Caos | Camisa florida (mantém vibe atual mas refinado) |
| `eletricista-sumido` | Cameo (off-screen rádio) | Apenas voz |
| `seguranca` | Reage a invasão | Polo preto, rádio |
| `bombeiro-fiscal` | Inspeção NFPA | Capacete branco, prancheta |
| `dancarino-passagem` | Atravessa palco em soundcheck | Risco real de tropeçar em cabo |
| `tecnica-som` | Colega de palco | Headset, fone monitor |

Todos partilham `HumanoidCharacter` — só mudam **skin params** (`outfitPreset`, `bodyType`, `skinTone`, `hairPreset`).

## 4. Cinematografia / Câmera (estilo GTA V cutscene)

`src/components/training/cinema/CinematicCamera.tsx`:
- **Briefing camera**: dolly + crane pré-canned por missão, easing cubic.
- **Mission camera**: orbit padrão (já existe).
- **Closeup camera**: durante diálogos NPC, corta para shot ombro com DOF (fakeBokeh via PostProcessing já no projeto).
- **Letterbox**: barras pretas top/bottom em cutscenes (`<CinematicLetterbox />`).
- **Title card**: nome da missão tipo "MICHAEL" GTA V (canto inferior esq, fade-in).
- **Color grading** (LUT leve): missão noturna = teal/orange, missão dia = neutro.

## 5. UI / HUD refinado

- **Mission Triangle** (canto superior esq): ícone + título + stage atual.
- **Objective list**: stage-aware, mostra próximo objetivo só após completar atual (já não cospe tudo).
- **Dialogue subtitles**: legenda inferior com nome do NPC em cor (estilo GTA), animação typewriter, suporte a skip (Espaço).
- **Radio chatter**: balão lateral quando NPC fala fora de tela.
- **Score popups**: "+50 SAFETY", "+30 SPEED" estilo Rockstar.
- **Star rating final**: 1–5 estrelas calculadas no debrief.

Componentes:
- `src/components/training/hud/MissionTriangle.tsx`
- `src/components/training/hud/DialogueSubtitle.tsx`
- `src/components/training/hud/ScorePopup.tsx`
- `src/components/training/hud/StarRating.tsx`
- `src/components/training/hud/Letterbox.tsx`

## 6. Conteúdo educacional (treinamento real)

Cada stage tem `realWorldFact: string` que aparece no debrief, ex.:

> "**NFPA 1123**: morteiros 6" exigem raio mínimo de 175m até público. Você posicionou a 178m — APROVADO. (Veja Manual NFPA 1123 / 1124 Reference.)"

Linkado ao array `MANUALS[]` já existente em `Training.tsx` — fechamos o loop entre simulador e biblioteca.

## 7. Áudio (opcional, gated)

- **Briefing sting**: synth pad curto no fade-in (Web Audio API, 1 osc + reverb).
- **Diálogo TTS**: usar `useJoiSpeech` (já existe) com vozes diferentes por NPC.
- **Ambient stage**: loop low-freq murmurinho público (gerado via noise filtrado, sem asset).
- Tudo opt-in via toggle "Audio FX" no HUD.

## 8. Testes

- `missionRunner.test.ts` — máquina de estados (stage advance, fail conditions, score calc).
- `missionScripts.test.ts` — todo script tem ≥1 stage, score ≤ 1000, durations coerentes.
- `humanoidCharacter.test.tsx` — render snapshot, props (skinTone, outfit) aplicadas.
- `dialogueSubtitle.test.tsx` — typewriter, skip, multi-line.

Meta: **+25 testes**, suite total >1057 verde.

## 9. Performance

- HumanoidCharacter usa `InstancedMesh` para roupas/acessórios quando >3 NPCs em cena.
- LOD: NPC fora do frustum → idle freeze + materiais simplificados.
- Cutscenes pausam timer da missão (não penaliza jogador).

## 10. Compatibilidade & Rollout

- **Feature flag** `training_v2_cinematic` (default ON) — fallback para fluxo atual se OFF.
- Missions existentes mantêm `id` — progresso do usuário (localStorage) preservado.
- Sem mudanças em `workMode`, `safetyStateMachine`, `commandBus` — 100% simulação.

## 11. Estrutura final de arquivos

```text
src/components/training/
├── humanoid/
│   ├── HumanoidCharacter.tsx        (novo, base)
│   ├── humanoidPresets.ts           (outfits, skin, hair)
│   └── humanoidAnimation.ts         (idle blend, lipsync, eye-track)
├── cinema/
│   ├── CinematicCamera.tsx          (novo)
│   ├── CinematicLetterbox.tsx
│   └── cameraScripts.ts             (presets de dolly por missão)
├── hud/
│   ├── MissionTriangle.tsx
│   ├── DialogueSubtitle.tsx
│   ├── ScorePopup.tsx
│   ├── StarRating.tsx
│   └── Letterbox.tsx
├── missions/
│   ├── types.ts                     (MissionScript, Stage, NPCEvent)
│   ├── missionRunner.ts             (FSM testável)
│   ├── missionScripts.ts            (16 missions detalhadas)
│   └── __tests__/
├── npcs/
│   ├── NPCRegistry.ts               (substitui NPCs.tsx)
│   └── npcCatalog.ts                (9 NPCs com presets MetaHuman)
├── TrainingSimulator.tsx            (refatora para usar missionRunner)
└── (antigos mantidos como fallback v1)
```

## 12. Entregáveis

1. ✅ 16 missões escritas (10 refinadas + 6 novas) — cinematic, staged, com debrief técnico.
2. ✅ HumanoidCharacter unificado (estilo MetaHuman dentro do limite Three.js).
3. ✅ 9 NPCs catalogados com personalidade, diálogos e blocking.
4. ✅ Cutscenes briefing/debrief com letterbox + title card + closeup.
5. ✅ HUD GTA-style (triangle, subtitles, score popups, stars).
6. ✅ Conteúdo educacional real linkado aos manuais existentes.
7. ✅ Feature flag, testes, zero impacto em safety-critical.

---

**Posso seguir e implementar?** Se sim, ao aprovar saio do plan mode e construo na ordem: tipos+runner → HumanoidCharacter → cinema → HUD → missionScripts → wire-up no `TrainingSimulator` → testes.

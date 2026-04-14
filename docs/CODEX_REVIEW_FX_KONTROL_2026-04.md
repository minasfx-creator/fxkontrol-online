# Codex Review — FX KONTROL (Abril de 2026)

> Patch: **minasfx-creator-patch-1**

## Objetivo
Transformar o relatório executivo em um plano de execução **ancorado no estado real do repositório**, com prioridades mensuráveis para performance, SEO técnico e segurança operacional.

---

## 1) Validação objetiva do estado atual (snapshot do código)

Abaixo, os pontos que foram verificados diretamente no repositório durante esta revisão:

| Item | Evidência observada | Leitura de impacto |
|---|---|---|
| Escala do frontend | `src/` contém **633 arquivos** e **190.585 linhas** | Código suficientemente grande para sofrer com custo de bootstrap e hidratação. |
| Escala total do monorepo | **762 arquivos** rastreados | Complexidade transversal entre UI, simulação e bridges de protocolo. |
| Renderização atual | `src/main.tsx` usa apenas `createRoot(...)` | Confirma abordagem CSR pura na entrada; LCP pode depender fortemente de JS para pintar conteúdo crítico. |
| Estado global | Há **17 stores Zustand** em `src/store/` | Fragmentação é real e tende a aumentar repaints/coordenação difícil entre domínios críticos. |
| Protocolos/engines | Presença de módulos dedicados para Art-Net, sACN, OSC, DMX, MAVLink e hardening | Arquitetura já orientada a domínios industriais, apta para consolidação por slices de missão. |

### Conclusão do snapshot
A tese central do relatório (gargalo de main thread + excesso de fragmentação + necessidade de renderização híbrida) é **coerente com o código atual**.

---

## 2) Revisão crítica do relatório original

## 2.1 Pontos fortes
- Diagnóstico correto de que, em SPA/CSR, LCP pode atrasar mesmo com backend rápido.
- Direção correta ao propor pré-renderização/hidratação para conteúdo crítico.
- Boa visão de longo prazo ao conectar runtime (WASM/ECS) com confiabilidade operacional.
- Inclui acessibilidade como requisito estrutural, não apenas “compliance de fim”.

## 2.2 Pontos que precisam de ajuste
- **Métricas absolutas sem rastreabilidade pública** (ex.: score exato, TTFB ultrabaixo) devem ser tratadas como hipótese até anexar artefato de auditoria.
- **“SSG para tudo”** é arriscado em rotas de telemetria e aprovação ao vivo; nessas rotas, o ganho vem de shell leve + ilhas interativas.
- **ECS + WASM + merge de stores no mesmo ciclo** eleva risco de regressão e dificulta rollback cirúrgico.
- Meta de **“Zero-GC” literal** deve virar meta operacional: “sem pausas GC no caminho crítico de comando”.

---

## 3) Plano técnico recomendado (execução em camadas)

## Fase A — Baseline e observabilidade (sem quebrar produção)
1. Congelar baseline por rota crítica (LCP, INP, long tasks, JS bootstrap).
2. Instrumentar RUM para Web Vitals p75 por classe de rota.
3. Criar budgets no CI (bundle JS/CSS e regressão de LCP em rotas públicas).

**Saída obrigatória:** painel único com baseline `D0` + owner por métrica.

## Fase B — Renderização híbrida por categoria de rota
- **Públicas (site/documentação):** SSG/SSR com metadados completos (canonical, OG, JSON-LD).
- **Operação autenticada (NOC/HUD):** shell mínimo pré-renderizado + hidratação progressiva.
- **Editor 3D pesado:** CSR progressivo com lazy boundaries e inicialização por prioridade.

**Regra:** sem migração “big bang”; rollout por rota, com canary.

## Fase C — Estado e fluxo de dados
Reduzir 17 stores para **4 macrodomínios**:
1. `missionStore` (timeline, cue, execução);
2. `hardwareSyncStore` (DMX/sACN/OSC/MAVLink/SMPTE);
3. `simulationStore` (boids, vento, colisão, física);
4. `uiWorkspaceStore` (dock layout, seleção, preferências).

**Prática obrigatória:** seletores estáveis + shallow compare + eventos de domínio explícitos.

## Fase D — Runtime de alta densidade (ECS/WASM)
- Migrar primeiro **hot paths mensuráveis** (partículas, colisão, integração numérica).
- Aplicar object pooling e buffers reutilizáveis antes de portar tudo para WASM.
- Só ampliar escopo WASM após benchmark A/B comprovar ganho com regressão zero funcional.

---

## 4) KPIs executivos revisados (Q3 2026)

| KPI | Alvo | Observação |
|---|---|---|
| LCP p75 (público) | `< 1,8s` desktop / `< 2,5s` mobile | Sem sacrificar precisão visual do painel inicial. |
| INP p75 | `< 200ms` | Foco em comandos de operador (arm/disarm/kill). |
| Long Task p95 no boot | `< 120ms` | Evitar congelamento perceptível no setup inicial. |
| JS inicial rota pública | `< 220KB gzip` | Evitar parser/compile excessivo no first view. |
| Erros de hidratação | `0` | Qualquer mismatch em produção é bloqueador de release. |
| Jitter de sincronização | SLO definido por protocolo | Integrar métrica operacional com performance web. |

---

## 5) Backlog imediato (2 semanas)

1. Introduzir `hydrateRoot` em modo de produção para rotas elegíveis.
2. Definir e documentar lista de rotas “SEO indexáveis” vs “operacionais privadas”.
3. Criar script de auditoria automática para detectar múltiplos `<h1>`, ausência de `aria-label` em botões ícone e falhas de landmark roles.
4. Medir custo de inicialização das stores atuais e publicar ranking de “stores mais caras”.
5. Isolar módulos de inicialização de barramentos para execução sob demanda (evitar boot síncrono total).

---

## 6) Aceite mínimo para aprovar avanço de fase

- [ ] Baseline D0 anexado com evidências reproduzíveis (comando, data, ambiente).
- [ ] Matriz de rotas com estratégia de renderização aprovada (SSG/SSR/CSR).
- [ ] SLO operacional e KPI web no mesmo dashboard de decisão.
- [ ] Plano de rollback por frente (renderização, estado, engine).
- [ ] Canary com critério explícito de promoção/aborto.

---

## 7) Parecer final
O relatório original está **bem orientado estrategicamente**, mas precisava de uma camada de execução com rastreabilidade, escopo incremental e controle de risco por domínio. Com o plano acima, o FX KONTROL passa de “diagnóstico forte” para “programa executável”, com ganhos prováveis em LCP, estabilidade de UI e previsibilidade operacional sem comprometer segurança de missão.

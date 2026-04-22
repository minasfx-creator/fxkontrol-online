# Codex Review — FX KONTROL (Abril 2026)

## Escopo da revisão
Este documento revisa criticamente o relatório executivo fornecido para o FX KONTROL, com foco em:
- consistência técnica;
- completude de plano de execução;
- riscos de implementação;
- métricas de sucesso mensuráveis.

## Veredito executivo
O relatório está **tecnicamente sólido na direção estratégica** (SSG/hidratação progressiva, redução de trabalho na main thread e consolidação de estado), mas ainda está **incompleto para execução operacional** por faltar:
1. baseline reproduzível de performance;
2. metas numéricas por etapa;
3. plano de rollout com mitigação de risco;
4. critérios objetivos de aceite por domínio.

## Pontos fortes
1. **Diagnóstico de LCP bem orientado**: separa TTFB excelente de atraso severo de renderização.
2. **Priorização correta da main thread**: reconhece JS síncrono e hidratação tardia como gargalos.
3. **Direção arquitetural apropriada**: consolidação de stores e proposta ECS para alta cardinalidade de entidades.
4. **Visão sistêmica**: conecta frontend, simulação, hardware-sync e SEO/acessibilidade.

## Lacunas críticas

### 1) Métricas sem protocolo de medição
O relatório cita números fortes (ex.: LCP com render delay ~2,9s), porém não descreve:
- ambiente de teste (desktop/mobile, CPU throttling, rede);
- amostragem (quantas execuções e percentis);
- ferramenta/fonte (Lighthouse local, PSI, RUM);
- rota exata auditada e estado de autenticação.

**Impacto**: risco de otimizar parcialmente um cenário não representativo.

### 2) SSG proposto sem matriz de rotas
A recomendação de SSG é correta para reduzir LCP inicial, mas falta classificar rotas em:
- estáticas públicas (SSG);
- privadas com shell estático + dados dinâmicos;
- rotas estritamente client-only.

**Impacto**: risco de acoplamento indevido com rotas protegidas e regressão de autenticação/hidratação.

### 3) Consolidação de 18 stores sem estratégia de compatibilidade
A meta de unificar em 4 domínios é boa, mas não define:
- ordem de migração;
- API de compatibilidade temporária;
- rollback por feature flag;
- impacto em selectors e assinaturas existentes.

**Impacto**: regressão funcional em fluxos críticos de missão.

### 4) ECS/WASM sem orçamento de integração
Há direção técnica correta, porém falta plano de custo:
- boundary JS↔WASM (serialização/cópia);
- ownership de memória e pooling;
- fallback para dispositivos sem aceleração adequada;
- suite de testes determinísticos para física.

**Impacto**: ganho de CPU pode ser reduzido por overhead de integração.

### 5) Acessibilidade e SEO ainda genéricos
Recomendações WAI-ARIA são pertinentes, mas faltam critérios de aceite, por exemplo:
- `role="log"` com política de anúncio e nível de verbosidade;
- validação automatizada por rota crítica;
- política de heading e landmarks no CI.

## Plano de execução recomendado (90 dias)

### Fase 0 — Baseline e observabilidade (Semana 1-2)
- Definir 3 rotas canônicas: landing, dashboard autenticado, editor pesado.
- Capturar baseline de LCP/INP/TBT/CLS (p50/p75/p95).
- Instrumentar Web Vitals em produção (RUM) com tags de rota e dispositivo.

**Meta**: estabelecer contrato de performance e guardrails de regressão.

### Fase 1 — First Paint real (Semana 3-4)
- Implementar pre-render para shell das rotas públicas e shell autenticado mínimo.
- Trocar `createRoot` por `hydrateRoot` onde houver HTML pré-renderizado.
- Remover placeholder de publicação do caminho crítico de render.

**Meta**: LCP p75 < 2.0s em rota pública desktop.

### Fase 2 — Main thread budget (Semana 5-8)
- Lazy load de painéis secundários e modais pesados.
- Fatiamento de tarefas longas de init/sync (yield cooperativo).
- Code splitting por domínio funcional (editor, simulação, telemetria).

**Meta**: TBT cair >40% nas rotas críticas.

### Fase 3 — Estado e simulação (Semana 9-12)
- Migrar stores para 4 domínios com adaptadores temporários.
- Pilotar ECS no subsistema de partículas de maior custo.
- Prototipar WASM para kernels matemáticos isolados (boids/ballística).

**Meta**: frame time estável em 60Hz no cenário-alvo, sem regressão de segurança.

## KPIs de aceite (objetivos)
- **LCP (p75)**: < 2.5s (público), < 3.0s (dashboard autenticado).
- **INP (p75)**: < 200ms.
- **TBT (lab)**: redução mínima de 40% no editor.
- **Erro funcional**: 0 regressões P0 em Safety State Machine.
- **Acessibilidade**: 0 violações críticas axe-core nas rotas prioritárias.

## Riscos e mitigação
- **Risco**: quebra de fluxo crítico ao consolidar stores.
  - **Mitigação**: migração por fatias + feature flags + rollback por domínio.
- **Risco**: overengineering prematuro com WASM.
  - **Mitigação**: só migrar kernels após perfilador confirmar hotspot >10% CPU total.
- **Risco**: "green lab / red prod".
  - **Mitigação**: decisões orientadas por RUM em produção, não apenas benchmark local.

## Conclusão da revisão
O relatório original acerta no diagnóstico e na direção de arquitetura. Para virar execução de nível industrial, precisa evoluir de um **plano conceitual forte** para um **plano operacional testável**, com baseline, KPIs, critérios de aceite e rollout seguro por fases.

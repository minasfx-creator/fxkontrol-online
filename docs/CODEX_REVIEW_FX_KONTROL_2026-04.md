# Codex Review — FX KONTROL (Abril de 2026)

## Escopo da revisão
Este documento revisa tecnicamente o relatório enviado, com foco em:

- consistência arquitetural;
- plausibilidade de performance (Core Web Vitals);
- plano de execução com risco controlado;
- qualidade de métricas para acompanhamento executivo.

---

## 1) Parecer executivo
O relatório está **estrategicamente bem direcionado** (SSR/SSG para reduzir LCP, consolidação de estado, migração de partes críticas para WASM), mas mistura:

1. hipóteses plausíveis;
2. premissas não comprovadas por evidência do repositório;
3. metas agressivas sem orçamento técnico explícito por etapa.

Resultado: excelente visão macro, porém com lacunas para execução segura em produção.

---

## 2) Pontos fortes do relatório

- Identifica corretamente o gargalo de **Main Thread** como causa provável de Element Render Delay em SPA.
- Propõe mudança de **CSR puro → pré-renderização + hidratação**, alinhada a boas práticas de LCP.
- Introduz **fatiamento por domínios** de estado (slice stores), reduzindo acoplamento acidental.
- Prioriza **acessibilidade semântica (WAI-ARIA)**, que melhora UX e robustez estrutural do HTML.
- Conecta performance com SEO técnico e descoberta por motores modernos.

---

## 3) Pontos críticos / riscos de execução

### 3.1 Métricas absolutas sem fonte auditável
Números como `177.930 LOC`, `670 arquivos`, `17 stores`, `2,9s de Element Render Delay`, `TTFB 0,136ms` e `score zero` exigem rastreabilidade (ferramenta, ambiente, data, URL do relatório de auditoria).

**Risco:** decisões de engenharia baseadas em baseline inconsistente.

### 3.2 "SSG para todas as rotas" pode ser inadequado
Rotas operacionais em tempo real (telemetria, aprovação ao vivo, dashboards de missão) normalmente exigem hidratação pesada e dados voláteis.

**Risco:** adotar SSG universal onde o modelo híbrido seria superior (SSG/SSR/CSR por tipo de rota).

### 3.3 Migração ECS e WASM simultâneas
ECS + pools + WASM + mudança de stores no mesmo ciclo aumenta risco sistêmico.

**Risco:** regressão funcional difícil de isolar, aumento de MTTR.

### 3.4 Meta "Zero-GC" literal
Em runtime web, "zero GC" total é raramente alcançável; objetivo mais realista é **GC não-bloqueante no caminho crítico**.

**Risco:** KPI inalcançável e desvio de foco.

### 3.5 SEO de produto operacional vs site público
Parte das recomendações SEO parece voltada ao site público, mas o texto mistura com painéis autenticados de controle.

**Risco:** otimizações de indexação aplicadas em superfícies que não devem ser indexadas.

---

## 4) Correções de direção recomendadas

### 4.1 Definir baseline reproduzível (D0)
Antes de refatorar, congelar baseline por ambiente:

- Lighthouse (mobile/desktop) em URL e build fixos;
- Web Vitals reais (RUM) com amostragem por rota;
- Perfil de Main Thread (long tasks, scripting, rendering);
- Bundle analysis (JS/CSS por rota).

### 4.2 Arquitetura de renderização por classe de rota
- **Marketing/docs públicas:** SSG + JSON-LD + OG tags no HTML inicial.
- **Dashboards de operação em tempo real:** shell SSR/SSG mínimo + ilhas CSR.
- **Ferramentas pesadas (editor 3D):** CSR progressivo com carregamento por prioridade.

### 4.3 Sequenciamento de migração técnica
1. Observabilidade e budgets de performance.
2. Refatoração de stores (sem mudar engine).
3. Otimização de bootstrap/hidratação.
4. ECS no domínio VFX.
5. WASM para kernels matemáticos mais caros.

### 4.4 KPIs realistas para Q3 2026
- LCP p75 (público): `< 1,8s` desktop, `< 2,5s` mobile.
- INP p75: `< 200ms`.
- Long Task p95 no boot crítico: `< 120ms`.
- JS inicial por rota pública: `< 220KB gzip`.
- Erros de hidratação: `0` em produção.

---

## 5) Plano de execução em 90 dias

### Fase 1 (Semanas 1–3): Instrumentação e higiene crítica
- Inserir RUM de Web Vitals por rota.
- Definir performance budgets no CI.
- Remover bloqueios críticos (scripts síncronos, CSS excessivo inicial).

### Fase 2 (Semanas 4–7): Renderização e estado
- Implementar pré-renderização apenas em rotas públicas.
- Introduzir hidratação progressiva por prioridade visual.
- Consolidar stores por domínio com seletores estáveis e memoização.

### Fase 3 (Semanas 8–10): Runtime pesado
- Migrar VFX hot paths para ECS.
- Introduzir object pools nos subsistemas de partículas.
- Mover kernels numéricos para WASM com benchmark A/B.

### Fase 4 (Semanas 11–13): Hardening e rollout
- Canary release por coortes de tráfego.
- SLOs de performance e regressão automática.
- Playbook de rollback por domínio (render/state/engine).

---

## 6) Checklist de aceitação para diretoria técnica

- [ ] Baseline auditável anexado (ferramentas + datas + ambiente).
- [ ] Top 10 rotas classificadas por estratégia de renderização.
- [ ] Orçamento de JS/CSS por rota formalizado em CI.
- [ ] Plano de risco (rollback) por frente de migração.
- [ ] KPIs com alvo p75/p95 e owner por indicador.

---

## 7) Conclusão do review
A direção do relatório é sólida e alinhada com arquitetura moderna para sistemas web complexos. Para transformar visão em resultado previsível, a prioridade deve ser: **métrica confiável, escopo incremental e rollout controlado**. Sem isso, o programa de otimização corre risco de alta complexidade com baixa rastreabilidade de ganho.

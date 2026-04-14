

# FX KONTROL — Status Técnico Atualizado e Próximas Ações

## Estado Atual do Sistema (Verificado)

| Métrica | Valor Atual | Status |
|---|---|---|
| Arquivos TS/TSX | 766 | Estável |
| Componentes Editor (top-level) | 217 | Reduzido de 314 (71 removidos) |
| Componentes Editor (total c/ subdirs) | 297 | — |
| Stores Zustand | 17 + 1 slice | Fragmentado |
| Dead code removido | 71 arquivos / ~19K LOC | Concluído |
| html2canvas | Dep. transitiva (jsPDF), tree-shaken | Resolvido |
| Codex Review doc | Criado | Concluído |

## O que já foi executado nesta sessão

1. **Codex Review** — Documento `docs/CODEX_REVIEW_FX_KONTROL_2026-04.md` criado com roadmap de 90 dias, KPIs realistas e correções de direção.
2. **Dead code removal** — 71 componentes de editor removidos (19.172 LOC). 7 componentes foram restaurados após quebra de build por imports relativos não detectados.
3. **html2canvas** — Confirmado como dependência transitiva de jsPDF, não entra no bundle final via tree-shaking.

## Próximas Ações Prioritárias (por ordem de impacto)

### Ação 1: Scan de Dead Code Corrigido (Fase 2)
O primeiro scan falhou em detectar imports relativos (`./Component`). Um segundo scan deve:
- Buscar tanto `@/components/editor/X` quanto `./X` e `../X`
- Verificar imports lazy/dinâmicos (`import(...)`)
- Estimar componentes restantes realmente inutilizados entre os 217

### Ação 2: Consolidação dos 17 Stores Zustand → 4 Domínios
Migrar de 17 stores fragmentados para 4 slices de domínio:

```text
Hardware: useMAVLinkStore + useSMPTEStore + useUSBDeviceStore + useFleetStore + useAddressingStore
Simulation: useBoidsStore + useLaserPreviewStore + useLiveSfxStore + useSfxChannelStore + useGenerativeStore
Workspace: useProjectStore + useSceneStore + useViewportStore + useDisplayStore + useRackStore + useInventoryStore + useUndoStore
AI: useAICoPilotStore
```

Cada domínio será um store único com slices internos, mantendo seletores granulares para evitar re-renders.

### Ação 3: Performance Budget no Build
- Adicionar plugin de análise de bundle (`rollup-plugin-visualizer`)
- Configurar limites de tamanho por chunk no CI
- Medir impacto real da remoção de dead code no bundle final

### Ação 4: Instrumentação RUM (Web Vitals por Rota)
- Integrar `web-vitals` com reporting por rota
- Estabelecer baseline LCP/INP/CLS reproduzível

## Recomendação
Executar a **Ação 1** (scan corrigido de dead code) primeiro — é a de menor risco e maior impacto imediato no tamanho do bundle. Em seguida, a **Ação 2** (consolidação de stores) para atacar o problema de fragmentação de estado descrito no relatório.


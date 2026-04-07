
# Limpeza Total — Fase 2: Código Obsoleto, Redundâncias e Scaffolds Mortos

---

## RESUMO

Remoção de ~25 arquivos e ~4.500+ LOC de código morto, redundante ou scaffold não conectado, organizados em 4 categorias.

---

## CATEGORIA 1 — Diretório `platform/` Inteiro (SCAFFOLD MORTO)

O diretório `platform/` (2.957 LOC) contém scaffolds de Rust, C++, Python, Docker e Kubernetes que **nunca são importados pelo app React**. Zero referências em `src/`. Toda a lógica relevante (boids, physics, MAVLink) já foi reimplementada em TypeScript dentro de `src/lib/` e `src/core/`.

| Diretório | Conteúdo | LOC |
|---|---|---|
| `platform/frontend/` | Vanilla JS antigo (renderer, cinematic, fireworks, designer) | ~250 |
| `platform/ai/` | JS stubs (choreographyAI, pathPlanner, slamSystem) | ~400 |
| `platform/simulation/` | JS stubs (digitalTwin, GPU compute) | ~300 |
| `platform/physics-engine-cpp/` | C++ stubs (aerodynamics, drone_physics) | ~400 |
| `platform/swarm-core-rust/` | Rust stubs (boids, collision, formation) | ~600 |
| `platform/drone-control/` | Python MAVLink bridge | ~275 |
| `platform/cluster/` | K8s configs | ~200 |
| `platform/tools/` | Node.js bridges (artnet, osc, sacn, mvr) | ~500 |
| `docker-compose.yml` | 14 services — não executável neste ambiente | ~30 |

**Ação**: Remover `platform/` inteiro (~2.957 LOC).

---

## CATEGORIA 2 — Componentes de UI Não Renderizados / Redundantes

| Arquivo | LOC | Motivo |
|---|---|---|
| `PositionContextMenu.tsx` | ~150 | Importado mas nunca renderizado — substituído por `RadialMenu.tsx` |
| `MiniMap.tsx` | 253 | Zero importações — substituído por `TacticalMinimap.tsx` |
| `destruction/DestructionTargeting.tsx` | 44 | Easter egg "Destruction Mode" — 278 LOC total (4 arquivos) para uma feature cosmética beta |
| `destruction/DestructionIncoming.tsx` | 36 | Idem |
| `destruction/DestructionNuclearAftermath.tsx` | 85 | Idem |
| `DestructionOverlay.tsx` | 113 | Orquestrador do modo destruição |

**Ação**: Remover `PositionContextMenu.tsx`, `MiniMap.tsx`. Remover `destruction/` + `DestructionOverlay.tsx` (278 LOC). Atualizar `SkyCanvas.tsx` para remover import do `DestructionOverlay`. Remover import morto do `PositionContextMenu` em `Index.tsx`.

---

## CATEGORIA 3 — Duplicidade de Imports e Aliases Desnecessários em `Index.tsx`

O `Index.tsx` tem 598 LOC com ~130 lazy imports, incluindo aliases confusos:

| Problema | Exemplo |
|---|---|
| Alias redundante | `const ShowControlPanel = lz(() => import('./ShowCommanderPanel'))` — mesmo componente com 2 nomes |
| Alias redundante | `const SafetyCheckPanel = lz(() => import('./safety/FlightCheckTab'))` — mesmo componente com 2 nomes |
| RadialMenu renderizado 2 vezes | Linhas 431 e 590 — duplicata desnecessária |

**Ação**: Remover aliases `ShowControlPanel` e `SafetyCheckPanel` (usar nomes reais). Remover renderização duplicada de `<RadialMenu />` e `<LiveCard />`. Limpar import morto de `PositionContextMenu`.

---

## CATEGORIA 4 — Arquivos `.cjs` de Teste Remanescentes

| Arquivo | LOC | Motivo |
|---|---|---|
| `test/fxk_ultra_refinement.test.cjs` | ~50 | Teste do CJS já removido na fase 1 — pode ter sobrado |

**Ação**: Verificar e remover se ainda existir.

---

## IMPACTO TOTAL

| Categoria | Arquivos | LOC Removidos |
|---|---|---|
| Platform scaffolds | ~35 | ~2,957 |
| UI redundante | 6 | ~680 |
| Index.tsx cleanup | 1 (edição) | ~15 |
| Testes mortos | 1 | ~50 |
| **Total** | **~42** | **~3,700** |

## ORDEM DE EXECUÇÃO

| Passo | Tarefa |
|---|---|
| 1 | Remover `platform/` inteiro |
| 2 | Remover `PositionContextMenu.tsx`, `MiniMap.tsx` |
| 3 | Remover `destruction/` + `DestructionOverlay.tsx` |
| 4 | Atualizar `SkyCanvas.tsx` — remover import `DestructionOverlay` |
| 5 | Limpar `Index.tsx` — remover imports mortos, aliases, duplicatas |
| 6 | Remover `test/` se remanescente |

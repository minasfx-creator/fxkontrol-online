## Objetivo

Remover a fricção dos sistemas de bloqueio para usuários iniciantes. Hoje, 4 camadas independentes podem travar uma ação no editor 3D / Live Firing:

1. **Lockout Groups (A–E)** — botões vermelhos no Live Firing Panel
2. **Safety Interlock Chain** — exige LOCK → ARM → FIRE
3. **Operational Mode Guard** — bloqueia operações fora do modo permitido
4. **Travas de UI** — itens/camadas marcados como `locked` no editor

A proposta: **todas as 4 camadas ficam desligadas por padrão**. O usuário ativa quando quiser, num único lugar (Configurações → Segurança).

> ⚠️ Vou manter o código das camadas intacto — apenas envolvido por um gate central. Isso garante que operações reais com hardware (Live Mode futuro) ainda possam reativar a segurança sem reescrever nada.

---

## Arquitetura: gate central único

Criar **`src/core/safety/safetyGate.ts`** — fonte de verdade única para "bloqueios estão ativos?".

```ts
// Persistido em localStorage. Default: false (desligado).
interface SafetyGateConfig {
  lockoutGroupsEnabled: boolean;       // Camada 1
  interlockChainEnforced: boolean;     // Camada 2
  modeGuardEnforced: boolean;          // Camada 3
  uiLocksRespected: boolean;           // Camada 4
  masterEnabled: boolean;              // Master switch — se false, ignora todas
}

export const safetyGate = {
  isEnforced(layer): boolean,    // false por padrão
  setMaster(on: boolean),
  setLayer(layer, on: boolean),
  subscribe(fn),                  // Zustand-like
};
```

Persistência: `localStorage` chave `fxk:safety-gate:v1`. Default = todos `false`.

---

## Mudanças por camada

### Camada 1 — Lockout Groups (A–E)
**Arquivos**: `src/components/editor/live-firing/LockoutPanel.tsx`, `src/components/editor/LiveFiringPanel.tsx` (linha ~436, `evaluateFireLockout`)

- `LockoutPanel`: só renderiza se `safetyGate.isEnforced('lockoutGroups')`. Caso contrário, mostra um pequeno chip cinza "Lockout desativado · ativar em Configurações".
- `evaluateFireLockout` em `LiveFiringPanel.tsx`: se gate desligado, retorna `{ allowed: true }` sem checar `activeLockouts`.
- Estado em `useProjectStore` (`activeLockouts`, `toggleLockout`) **fica como está** — só não tem efeito quando o gate está off.

### Camada 2 — Safety Interlock Chain
**Arquivo**: `src/core/safety/SafetyValidator.ts`

No início de `validate(cmd, tick)`, antes do `safetyStateMachine.transition(...)`:

```ts
if (!safetyGate.isEnforced('interlockChain')) {
  // Bypass: log no audit como "GATE_BYPASS" mas permite o comando
  safetyAuditTrail.log({ ...minimal..., event: 'GATE_BYPASS' });
  return { allowed: true };
}
```

Isso preserva o audit trail (auditoria continua honesta) mas não bloqueia o usuário. ARM/FIRE viram comandos diretos.

### Camada 3 — Operational Mode Guard
**Arquivo**: `src/core/hardware/OperationalModeGuard.ts`

Em `assertAllowed(operation)` e `check(operation)`:

```ts
if (!safetyGate.isEnforced('modeGuard')) {
  return { allowed: true, reason: 'ModeGuard disabled by user preference' };
}
```

`ExportCoordinator` e demais consumidores não precisam de mudança — recebem `allowed:true` automaticamente.

### Camada 4 — Travas de UI no editor 3D
**Arquivos**: stores e componentes que checam `.locked` em itens/camadas (rack, addressing, fleet, sfx channels).

Em vez de tocar em N stores, adicionar um helper:

```ts
// src/lib/uiLockHelper.ts
export const isItemLocked = (item: { locked?: boolean }) =>
  safetyGate.isEnforced('uiLocks') && !!item?.locked;
```

E substituir checagens diretas `item.locked` → `isItemLocked(item)` nos pontos de edição (move/delete/edit). Lista a inventariar na execução: `useRackStore`, `useFleetStore`, `useAddressingStore`, `useSfxChannelStore`, `AddressingPanel`, `ShowCommanderPanel`. Render do ícone de cadeado **continua** mostrando — só não bloqueia a ação quando o gate está off.

---

## UI: toggle único em Configurações

**Novo componente**: `src/components/settings/SafetyGateSettings.tsx`, exposto em Settings → "Segurança & Bloqueios".

Layout (mobile-first, viewport 440px):

```
┌─────────────────────────────────────────┐
│ 🛡️  Sistema de Bloqueios                │
│                                         │
│ Por padrão, a plataforma é livre para   │
│ você criar sem travas. Ative bloqueios  │
│ só se você opera hardware real.         │
│                                         │
│ ┌─ Master ─────────────────────────┐    │
│ │ Ativar bloqueios       [  OFF ]  │    │
│ └──────────────────────────────────┘    │
│                                         │
│ Avançado (quando Master ON):            │
│  • Lockout Groups (A–E)      [OFF]      │
│  • Cadeia ARM → FIRE         [OFF]      │
│  • Modo operacional          [OFF]      │
│  • Travas de itens/camadas   [OFF]      │
└─────────────────────────────────────────┘
```

Quando Master OFF, switches avançados ficam desabilitados (todas camadas off). Quando Master ON, usuário escolhe quais camadas individualmente.

**Banner discreto e dispensável** no Live Firing Panel quando bloqueios estão off:
> "🟢 Modo livre · disparos sem interlock. Ativar bloqueios"

(Link leva direto para a aba de configurações. Lembrável: armazenar `dismissed` em localStorage.)

---

## Acessibilidade do toggle

Além de Settings, adicionar atalho:
- Comando rápido na paleta JOI / atalho de teclado (sem nesting Radix)
- Item no menu de contexto da Tactical Dock

---

## O que **não** muda

- Black-box recorder, audit trail, telemetria — continuam gravando tudo (inclusive `GATE_BYPASS`), porque honestidade de logs é independente de UX.
- Hardware real (Live Mode com FieldBus): quando o usuário conectar hardware físico, sugerimos auto-ativar Master via prompt — mas **sem forçar**.
- Estrutura das stores e tipos — só o ponto de avaliação muda.

---

## Arquivos a editar

1. **Novo**: `src/core/safety/safetyGate.ts` (gate central + persistência)
2. **Novo**: `src/lib/uiLockHelper.ts` (helper único `isItemLocked`)
3. **Novo**: `src/components/settings/SafetyGateSettings.tsx` (UI de configuração)
4. **Edit**: `src/core/safety/SafetyValidator.ts` (bypass quando gate off)
5. **Edit**: `src/core/hardware/OperationalModeGuard.ts` (bypass quando gate off)
6. **Edit**: `src/components/editor/live-firing/LockoutPanel.tsx` (esconde + chip)
7. **Edit**: `src/components/editor/LiveFiringPanel.tsx` (`evaluateFireLockout` honra gate + banner "modo livre")
8. **Edit**: pontos de checagem `.locked` (rack/fleet/addressing/sfx) → usar `isItemLocked`
9. **Edit**: rota/menu de Configurações para expor `SafetyGateSettings`
10. **Memory update**: registrar nova regra em `mem://restricoes/operacional-mode-guard-rules` (gate é opt-in agora)

---

## Como o usuário sente isso

- **Novo usuário**: abre o app, cria show, arrasta efeitos, simula dispara — **nada bloqueia**.
- **Usuário avançado / operador real**: vai em Configurações, liga "Ativar bloqueios", recupera 100% da experiência atual de mission-control.
- **Auditoria**: continua intacta — quem auditar logs vê exatamente quando alguém operou em modo livre vs com gates.

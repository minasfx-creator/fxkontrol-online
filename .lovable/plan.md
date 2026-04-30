# Mover FXK16 do FXKPYRO para o Field Test

Tira o `FXK16ConnectionPanel` de dentro do `PyroFireOnePanel` (Live Firing) e adiciona como uma nova aba dedicada no console `/field` (FieldOps), ao lado de Pairing / Field Test / Mobile Link.

## Por que mudar

- Hoje o painel FXK16 fica embutido no header do `PyroFireOnePanel.tsx` (linhas 1635-1638), o que mistura **conexão de hardware** (USB/BLE) com **operação de cue/Live Firing**. Cada vez que o operador abre o Live Firing carrega o painel mesmo sem precisar reconectar.
- Field Ops (`/field`) já é o lugar canônico para pareamento e diagnóstico de transporte (NFC, BLE, transports, Mobile Link). FXK16 pertence a essa família.
- O singleton `useFXK16Bridge` já é compartilhado por todos os consumidores (`PyroControllerCard`, `LiveStatusChip`, `RealHardwareBridgeDialog`, `cueQueueRunner`) — não há acoplamento de estado com o Pyro. Mover só a UI é seguro.

## Mudanças

### 1. Remover do PyroFireOnePanel
Arquivo: `src/components/editor/live-firing/PyroFireOnePanel.tsx`

- Remover o bloco `{/* FXK16 ... */}` das linhas 1635-1638.
- Remover o import `FXK16ConnectionPanel` da linha 33.

O painel continua exatamente igual; o que some é só o card de conexão. Status do hardware continua visível no `LiveStatusChip` que já existe no header do FXKPYRO (lê do mesmo `useFXK16Bridge`).

### 2. Adicionar nova aba no FieldOps
Arquivo: `src/pages/FieldOps.tsx`

- Estender `TabKey` com `'fxk16'`.
- Adicionar `{ key: 'fxk16', label: 'FXK16', sub: 'PYRO RELAY', icon: Cable }` ao array `TABS` (entre Pairing e Field Test).
- Adicionar render condicional `{tab === 'fxk16' && <FXK16Panel />}`.

### 3. Novo wrapper de página
Arquivo novo: `src/components/field/FXK16FieldPanel.tsx`

Wrapper leve que:
- Renderiza o `FXK16ConnectionPanel` em modo `compact={false}` (versão completa, mais espaçada).
- Adiciona contexto/help text explicando: handshake VERSION+STATUS, USB vs BLE, Hold-to-Confirm 800 ms para teste de canal.
- Mostra link discreto para `/dev/fxk16-validate` (harness de validação por canal) e `/dev/fxk16-calibrate` (calibração) — rotas que já existem.
- Usa o mesmo padrão visual de `DevicePairing` (sticky header, padding consistente com as outras abas).

Não mexe em `useFXK16Bridge`, `useFXK16Commands`, nem em nenhum consumidor downstream — o singleton continua único.

### 4. Deep-link
- Hash `#fxk16` já funciona automaticamente pelo `setTabAndHash` existente do FieldOps.
- Adicionar shortcut: rota `/fxk16` em `App.tsx` que faz `<Navigate to="/field#fxk16" replace />`, para conveniência.

## Arquivos tocados

```text
EDIT  src/components/editor/live-firing/PyroFireOnePanel.tsx   (-2 imports/blocos)
EDIT  src/pages/FieldOps.tsx                                   (+1 aba, +1 import lazy)
NEW   src/components/field/FXK16FieldPanel.tsx                 (~80 linhas)
EDIT  src/App.tsx                                              (+1 redirect /fxk16)
```

## Não-objetivos

- Não muda o protocolo, handshake, comandos, ou flags de feature do FXK16.
- Não muda nada no `useFXK16Bridge` (singleton continua disponível para o `cueQueueRunner` durante Live Firing).
- Não toca em segurança/ARM. Hold-to-Confirm 800 ms continua igual.
- Não remove `FXK16ConnectionPanel` em si — só desacopla do PyroFireOnePanel.

## Critério de aceitação

- Abrir `/studio` → Pyro panel não mostra mais o card de conexão FXK16. `LiveStatusChip` continua refletindo o estado.
- Abrir `/field#fxk16` → mostra o `FXK16FieldPanel` com o card completo de conexão USB/BLE e botões de Test / Validate / Calibrate.
- Conectar pelo Field Ops → Live Firing reflete o link imediatamente (singleton compartilhado).
- `/fxk16` redireciona para `/field#fxk16`.

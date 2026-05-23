# FXKONTROL — Go-Live Comercial · 90 Dias

> Documento canônico de GTM. Vive ao lado de `MANIFESTO.md`,
> `strategy-v2.md` e `GO_LIVE_CHECKLIST_HARDWARE_IPHONE.md`.
> **Não é executável.** Comandos físicos seguem o caminho consolidado
> `UI → uiCommandGateway → CommandBus → SafetyStateMachine → FieldBus`.

---

## 1. Posicionamento

**FXKONTROL é o sistema operacional técnico para espetáculos ao vivo.**

Eixo de comunicação:

> **Codificar imaginação. Garantir precisão.**

- **ICP inicial:** produtoras premium de eventos e show design.
- **Usuário diário:** diretor técnico, pirotécnico responsável, piloto
  de drone show, operador de FOH/laser.
- **Comprador:** produtor executivo / sócio técnico da produtora.

## 2. Promessas fixas (contratuais)

1. **Controle técnico unificado** — DMX, Art-Net, sACN, drones,
   pirotecnia, laser e previs 3D em uma única cadeia.
2. **Segurança operacional** — simulação determinística, validação
   pré-show, E-STOP <50 ms, logs em janela de 100 ms, rollback testado.
3. **Experiência premium em campo** — paleta noturna (Vantablack +
   cyan dessat), densidade técnica, mono em telemetria, microinterações
   apenas para confirmação/alerta/estado.

> **Nota de marca:** o brief inicial sugeriu `#121214 / #00FFFF / #FF7700`.
> Esses valores foram **rejeitados** e não devem aparecer em nenhum
> material operacional. Razões: `#121214` perde para Vantablack `#050810`
> em OLED/visão noturna; `#00FFFF` puro causa fadiga sob pressão (canônico
> é cyan dessat `190 70% 58%`); `#FF7700` colide semanticamente com
> `--status-warn` âmbar — usar laranja como destaque de marca quebra o
> contrato de cor. Detalhes em `mem://design/fxk-logo-brand-component`
> e `mem://arquitetura/hierarquia-prioridade-decisoes-design`.
> Materiais públicos (landing `/pitch/us`, decks comerciais) podem usar
> cyan mais saturado, mas **nunca** laranja como destaque.

## 3. Pacotes SaaS

| Pacote | Promessa | Provas exibidas na demo |
|---|---|---|
| **FXKONTROL Previs** | Simulação, Unreal/Pixel Streaming e aprovação remota | Previs 3D, render de demo, fluxo de Client Approval com assinatura |
| **FXKONTROL LiveOps** | Hardware real, DMX/Art-Net, iPhone readiness e runbook | Checklist GO/NO-GO, logs auditáveis, E-STOP em campo, fallback de transporte |
| **FXKONTROL Enterprise** | Compliance, logs, multiusuário e integrações customizadas | Auditoria, SLA, suporte dedicado, integrações sob demanda |

## 4. Fluxo vendável (demo de 15 min)

1. **Criar ou importar show** (template ou import VVIZ/Finale).
2. **Mostrar previs 3D** no Unreal/Pixel Streaming, sem hardware real.
3. **Abrir Go-Live Center** e percorrer checklist operacional.
4. **Anexar evidências:** prints, logs, vídeos curtos, assinaturas.
5. **Decisão GO / NO-GO.**
6. **Exportar relatório** para engenharia, operação e cliente.

## 5. Regras GO / NO-GO

O Go-Live Center calcula **NO-GO** quando qualquer condição abaixo é
verdadeira:

- algum bloqueador não passou;
- bloqueador aprovado **sem evidência obrigatória** anexada;
- rollback **não validado**;
- Engenharia **ou** Operação ainda não assinaram;
- existe bug crítico aberto;
- algum item crítico falhou e ainda exige mitigação.

**GO** só aparece com:

- todos os bloqueadores aprovados,
- evidências presentes em cada bloqueador,
- rollback validado e testado,
- signoffs de Engenharia + Operação completos,
- nenhum risco crítico aberto.

## 6. Roadmap 90 dias

### Dias 1–15 · Fundação

- Checklist do PDF (`docs/GO_LIVE_CHECKLIST_HARDWARE_IPHONE.md`)
  convertido em dados estruturados do app.
- Tela **Go-Live Center** ativa.
- Compatibilidade mapeada: Desktop Chrome, Android Chrome, iPhone Safari
  e iOS Capacitor.
- Mensagens iOS revisadas para transportes indisponíveis (sem toast
  falso de "desconectado").
- Narrativa comercial e pacotes SaaS documentados (este arquivo).

### Dias 16–35 · Demo vendável

- Demo guiada de **15 minutos**.
- Unreal / Pixel Streaming como aprovação remota.
- Script comercial: **problema → integração → segurança → ROI → prova
  técnica**.
- Relatório pós-demo: tempo de setup, alertas, status final, evidências
  anexadas. Reusar `src/lib/strategyReport.ts` e `pdfRenderer.ts`.

### Dias 36–60 · Operação real controlada

- Bancada com **10 ciclos** consecutivos de conecta/desconecta sem
  travamento de UI.
- Heartbeat por **5 minutos** sem timeout indevido.
- ACK de comando em **dummy load** (carga segura).
- E-STOP com lockout visual **<50 ms** + bloqueio físico.
- Logs estruturados por: transporte, timestamp, erro, latência ACK,
  estado armado, sessão.
- Runbook de rollback com responsáveis, janela e validação pós-reversão.

### Dias 61–90 · Piloto comercial

- Piloto controlado com **uma produtora premium**.
- GO/NO-GO formal antes do evento.
- Coleta de evidências: vídeos, métricas, depoimento técnico assinado.
- Case final: previs, operação, segurança, economia de tempo, relatório
  exportado.
- Pricing inicial e onboarding padrão para próximos clientes.

## 7. Identidade aplicada (sem conflito de marca)

A diretriz "Quiet Technical Luxury" é aplicada **em espírito**, não em
valores hex conflitantes:

- **Densidade técnica:** painéis modulares, leitura sob pressão, zero
  decoração.
- **Tipografia:** mono (`JetBrains Mono` via `.ds-mono`) em **IP, DMX
  address, timecode, log panes** — qualquer número que o operador lê
  sob pressão. Display em Rajdhani, corpo em Inter.
- **Microinterações** apenas para: confirmação (Hold-to-Confirm 600 ms),
  alerta (status warn/fail), estado operacional (ARM, FIRE, E-STOP).
- **Paleta operacional canônica e imutável:**
  - Background: Vantablack `#050810`
  - Sync / brand accent: cyan dessat (`190 70% 58%`)
  - OK: verde · Warn: âmbar · Fail: vermelho · Sync: cyan
- **Marca gráfica:** `<FxkLogo />` (pentágono XLR 5-pin, cyan stroke).

## 8. Critérios de claim (para uso comercial)

Reutilizar `src/lib/claims.ts` e `ClaimBadge`:

- **`validated`** — fato/dado com fonte. Usar livremente.
- **`pilot`** — usar com linguagem de piloto + disclaimer auto-anexado.
- **`marketing_hypothesis`** — narrativa apenas, **nunca como garantia**.

NFPA, FAA, latência, redução de custo, alcance e claims de hardware
exigem revisão US antes de virarem garantia comercial.

---

_Versão 1.0 — derivado do plano comercial de 03/maio/2026._
_Mantenedor: equipe FXKONTROL (GTM + Engenharia)._

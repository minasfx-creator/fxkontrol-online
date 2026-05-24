# FXKONTROL — Manifesto de Marca

> Espinha dorsal digital do show ao vivo.
> Onde DMX, pyro, drone, laser e mesh convergem em uma única linha de comando.

---

## 1. Razão de existir

A indústria do espetáculo ao vivo opera há décadas com ferramentas
fragmentadas: um software para timeline, outro para DMX, outro para
disparo, outro para drone, outro para laser. Entre eles, planilhas,
adesivos, rádio HT e fé.

**FXKONTROL existe para acabar com a lacuna entre o que foi planejado
e o que dispara em campo.** Um único plano. Um único relógio. Uma única
cadeia de comando — auditável, rastreável e preparada para falhar com
segurança.

## 2. Crenças

1. **Simulação é execução.** Se não roda igual no 3D, não vai rodar
   igual no campo. Determinismo > improviso.
2. **Hardware honesto.** Nada é "online" até a camada física confirmar.
   Sem dado sintético, sem mock disfarçado de telemetria.
3. **Segurança não é feature, é o piso.** E-STOP em <50 ms,
   intertravamentos físicos em modo real, IA proibida de armar/disparar.
4. **A ferramenta serve o operador, não o operador a ferramenta.**
   Vantablack para visão noturna, mono para timecode, snap para precisão.
5. **Compatibilidade é respeito.** Showven, FireOne, Finale 3D, Art-Net,
   sACN, MAVLink — não reinventamos protocolos consagrados.

## 3. Posicionamento (1 frase)

**Para** equipes técnicas de espetáculos ao vivo
**que** precisam coordenar pyro, drone, laser, DMX e cenografia em tempo real,
**FXKONTROL é** a plataforma de controle e simulação determinística
**que** unifica o plano, o ensaio 3D e o disparo em uma única cadeia auditável,
**diferente de** softwares de cue isolados ou planilhas com rádio,
**porque** garante que o que você vê no estúdio é exatamente o que dispara em campo.

## 4. Público

- **Diretor técnico de show** — quer um plano único, exportável,
  defensável diante de seguradora e bombeiro.
- **Pirotécnico responsável** — quer continuidade, ARM/DISARM com
  confirmação, log de cada ignição.
- **Piloto de drone show** — quer trajetórias sincronizadas com música
  e pyro no mesmo timecode SMPTE.
- **Operador de FOH/laser** — quer DMX/Art-Net/sACN sem surpresa entre
  ensaio e showtime.
- **Produtor / cliente final** — quer ver o show antes do show, em 3D,
  com o terreno real.

## 5. Mensagens-chave

| Audiência | Mensagem | Prova |
|---|---|---|
| Diretor técnico | "Um plano. Um relógio. Uma cadeia auditável." | ShowPlan canônico, log 100ms, export Finale 3D / FireOne / MAVLink |
| Pirotécnico | "Nada arma sem você. Nada dispara sem continuidade." | Hold-to-Confirm 600ms, E-STOP global, Safety State Machine |
| Piloto de drone | "Música, pyro e drone no mesmo timecode." | SMPTE Drop-Frame 29.97, VVIZ streaming, ICET Sync |
| Operador DMX/laser | "Art-Net, sACN, ILDA — do jeito que a indústria já fala." | 33 PPS Art-Net, FB3/FB4 sim, Showven PBUS dual-band |
| Produtor | "Veja o show antes do show, no terreno real." | Google 3D Tiles, Studio Mode cinematográfico, paleta noturna |

## 6. Tom de voz

**Operacional, não publicitário.** Falamos como um briefing de voo:
curto, exato, sem floreio.

| Sim | Não |
|---|---|
| "ARMED. Pressione 600 ms para confirmar." | "Pronto para a magia acontecer ✨" |
| "Continuidade OK em 14/16 canais." | "Tudo certo, pode mandar bala!" |
| "E-STOP latência 38 ms." | "Segurança em primeiro lugar 💪" |
| "Hardware desconectado — modo simulação." | "Ops, parece que algo deu errado." |
| Imperativo curto: "Confirme.", "Aguarde.", "Aborte." | Subjuntivo longo: "Você poderia, por favor…" |

**Regras:**
- Verbo no imperativo para ação crítica.
- Substantivo técnico em **mono** (`DMX 1.512`, `BPM 128.0`, `T+00:14:32:21`).
- Estado sempre com cor semântica: **OK** verde, **WARN** âmbar, **FAIL** vermelho, **SYNC** ciano.
- Zero emoji em UI operacional. Permitido só em landing/marketing.
- Português direto, sem anglicismo evitável (`disparar` > `firar`,
  `ensaio` > `rehearsal`). Termos da indústria mantêm-se em inglês:
  *cue, ARM, DISARM, E-STOP, timecode, master, slave, bus*.

## 7. Identidade visual (resumo)

- **Paleta operacional** (canônica, não negociável):
  Vantablack `#050810`, Cyan dessat (sync), Verde (OK), Âmbar (warn),
  Vermelho (fail). Otimizada para OLED e visão noturna em campo.
- **Paleta marketing** (landing/pitch apenas): pode usar cyan mais
  saturado e fundo `#0F1115`. **Nunca** usar laranja como destaque
  (conflita com âmbar=warn na operação).
- **Tipografia:**
  - Display: Rajdhani / sans condensada — títulos, headers de painel.
  - Texto: Inter — corpo, formulários, descrições.
  - Mono: JetBrains Mono via `.ds-mono` — IP, DMX address, timecode,
    channel mask, qualquer número que o operador lê sob pressão.
- **Marca gráfica:** pentágono inspirado nos 5 pinos do XLR (cyan
  stroke). 5 pinos = convergência de tecnologias (DMX, pyro, drone,
  laser, mesh). Componente `<FxkLogo />`.

## 8. O que NÃO somos

- Não somos um app de "experiência mágica do show".
- Não somos uma rede social de pirotécnicos.
- Não somos um marketplace de efeitos.
- Não somos um software de planejamento offline — somos a cadeia
  inteira: plano → ensaio → disparo → log.
- Não somos "no-code". Somos *low-friction*, *high-determinism*.

## 9. Promessas

1. **Determinismo:** o que você simula é o que dispara.
2. **Honestidade:** se não está conectado, dizemos `disconnected`.
   Sem ícone verde mentiroso.
3. **Latência crítica:** E-STOP < 50 ms. Sempre.
4. **Auditoria:** cada comando em janela de 100 ms na black box.
5. **Compatibilidade:** Finale 3D, Showven, FireOne, Art-Net 4/5, sACN,
   MAVLink, ILDA. Sem reinventar.
6. **Offline-first:** a plataforma continua operando em *degraded mode*
   sem internet. Show não para por causa de Wi-Fi.

## 10. Assinatura

> **FXKONTROL — Plan it. Rehearse it. Fire it. One chain.**

---

_Versão 1.0 — derivado das seções 5–8 do plano de negócios._
_Mantenedor: equipe FXKONTROL. Licença interna._

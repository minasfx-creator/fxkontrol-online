
# Joi Show Creation — Bug Fix & Real Show Design

## Bugs Identificados

| # | Bug | Impacto |
|---|-----|---------|
| 1 | **Effect IDs no system prompt ERRADOS** — Lista diz `"shell-05" = Ring Shell 6"` mas na biblioteca real é `Horsetail 6"`. Idem `shell-06`, `shell-07`, etc. A Joi gera comandos com IDs errados → efeitos não são encontrados | Crítico — efeitos não aparecem |
| 2 | **create_choreography usa effectId fictício** — Exemplo no prompt usa `"shell-chrysanthemum-gold"` que não existe. Joi copia o exemplo → todos os cues falham | Crítico — coreografias vazias |
| 3 | **Fallback de matching não trata effectName com caliber** — AI envia `"effectName":"Chrysanthemum 3\""` mas o fallback de keywords filtra palavras < 3 chars, descartando `3"`. Match parcial funciona mas é frágil | Médio |
| 4 | **Presets genéricos sem estrutura de show real** — "Crie show de 3 min com 20 posições" não dá à Joi informação suficiente para criar um show com arco dramático (abertura, build, clímax, finale) | UX — shows monótonos |
| 5 | **Prompt não instrui sobre layout realista** — Não há guia de como posicionar em arco, V, linha. Joi coloca tudo em x=0 ou espaçamento aleatório | UX — layout irrealista |

## Plano de Implementação

### 1. `supabase/functions/fxk-ai-chat/index.ts` — Fix system prompt

**Corrigir mapeamento completo de effectIds** — Substituir a lista errada por uma gerada diretamente da biblioteca real:

```
Shells: "mort-01" (Chrysanthemum 3"), "mort-02" (Willow 4"), "mort-03" (Brocade Crown 5"), "mort-04" (Coconut Palm 6"), "shell-01" (Titanium Shell 4"), "shell-02" (Color Shell 6"), "shell-03" (Kamuro 5"), "shell-04" (Crossette 4"), "shell-05" (Horsetail 6"), "shell-06" (Spider 5"), "shell-07" (Ring Shell 4"), "shell-08" (Nishiki Kamuro 8"), "shell-09" (Peony 8"), "shell-10" (Chrysanthemum 10"), "shell-11" (Willow 10"), "shell-12" (Grand Peony 12"), "shell-13" (Kamuro 12"), "shell-14" (Palm 8"), "shell-17" (Dahlia 6")
Peônias: "peon-01" (Red Peony), "peon-02" (Blue Peony), "peon-03" (Green Peony), "peon-04" (Purple Dahlia), "peon-05" (Silver Glitter), "peon-06" (Gold Strobing), "peon-07" (Crackling Stars), "peon-08" (Falling Leaves)
Cometas: "comet-01" (Rising Comet), "comet-02" (Falling Comet Trail)
Minas: "mine-01" (Silver Mine), "mine-02" (Gold Mine), "mine-03" (Crackling Mine), "mine-04" (Color Star Mine), "mine-05" (Titanium Mine)
Gerbs/Fontes: "sfx-03" (Cold Sparks), "spark-01" (Silver Spark), "spark-02" (Gold Spark)
Cakes: "cake-01" to "cake-05"
Waterfalls: "wf-01" to "wf-04"
```

**Corrigir exemplo do create_choreography** — Trocar `"shell-chrysanthemum-gold"` por `"mort-01"`.

**Adicionar guia de design de shows reais** — Seção com estrutura dramática:
- **Abertura** (0-15%): Minas + cometas, 2-3 posições centrais
- **Build** (15-50%): Shells 3"-5" escalonados, leque esquerda-centro-direita
- **Clímax** (50-80%): Shells 6"-8" com stagger curto, waterfalls laterais
- **Finale** (80-100%): Barrage de cakes + shells 8"-12" em todas posições, stagger 0.1-0.3s

**Adicionar guia de layouts** — Padrões de posicionamento:
- Arco: `x = R * cos(θ)`, `z = R * sin(θ)` com R=15-25m
- Linha: `x = -W/2 + i * spacing`, `z = 0`
- V-shape: duas linhas em ângulo de 45°

### 2. `src/utils/joiCommandExecutor.ts` — Melhorar matching

- Adicionar fallback por `caliber` + `pattern`: se AI envia `effectName: "Chrysanthemum 6"` → extrair padrão "chrysanthemum" e caliber 6, buscar match na lib por `e.pattern === 'chrysanthemum' && e.caliber === 6`
- Adicionar alias map para termos comuns: `"gold willow" → "mort-02"`, `"brocade" → "mort-03"`, etc.

### 3. `src/components/JoiCommandPresets.tsx` — Presets com show design real

Substituir presets genéricos por templates de shows reais:
- **RÉVEILLON** — Show de 5 min, arco de 15 posições, abertura com minas, finale com barrage
- **CASAMENTO** — Show intimista de 2 min, 8 posições em V, peony/willow suaves
- **FINAL RÁPIDO** — Finale de 30s, 20 posições em linha, barrage de cakes + shells
- **SHOW COMPLETO** — Show de 3 min com estrutura dramática completa

### 4. Deploy + Build

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Fix effect IDs + show design guide no system prompt |
| 2 | Melhorar matching no joiCommandExecutor |
| 3 | Presets de shows reais |
| 4 | Deploy edge function + build |

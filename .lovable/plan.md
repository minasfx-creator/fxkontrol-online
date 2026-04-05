

## Efeito de Glitch Cromático Intermitente ao Receber Comando

### O que será feito

Quando o usuário enviar um comando, a Joi vai exibir um glitch cromático intenso e curto (burst) que depois se dissipa — simulando a "interferência digital" de receber dados. Isso é diferente do glitch contínuo atual (que só aparece no estado `active` enquanto processa).

### Mudanças técnicas

**1. Novo estado `glitching` no `JoiCinematicHologram`**

Adicionar uma prop `glitching` (boolean) que dispara um efeito de glitch intenso por ~800ms:
- Aberração cromática forte (shifts de 4-6px em vez dos atuais 1.5-3px)
- Flash de cor intensa com flicker rápido (step-end timing)
- Distorção horizontal (skewX) pulsante
- Breve flash branco/ciano no corpo todo

**2. Novos keyframes CSS (`src/index.css`)**

```
@keyframes joi-glitch-burst — glitch intenso com skew, translate, opacity flicker (800ms)
@keyframes joi-chroma-burst — aberração cromática amplificada com shifts maiores
@keyframes joi-flash-burst — flash branco/ciano rápido que decai
```

**3. Integrar no `FXKAssistant`**

- Adicionar estado `glitching` que fica `true` por 800ms quando o usuário envia uma mensagem (`send()`)
- Passar `glitching={glitching}` para todas as instâncias de `JoiCinematicHologram`
- O efeito dispara no momento do envio, antes mesmo da resposta chegar

**4. Componente `JoiCinematicHologram`**

Quando `glitching=true`:
- Renderizar overlays de aberração cromática com classes `joi-chroma-burst` (mais intensas que as atuais)
- Aplicar `joi-glitch-burst` no container principal (tremor + distorção)
- Flash overlay com `joi-flash-burst`
- Efeito funciona em qualquer tamanho (sm, md, lg, xl) e no mobile

### Arquivos modificados

| Arquivo | Alteração |
|---|---|
| `src/components/JoiCinematicHologram.tsx` | Nova prop `glitching`, overlays de burst |
| `src/components/FXKAssistant.tsx` | Estado `glitching` + timer de 800ms no `send()` |
| `src/index.css` | 3 novos `@keyframes` para o burst |


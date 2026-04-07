

# Ciclo de Calibracao #17 — Angulos/Burst, Mine/Fan/Cake Polish, Export Documental Inteligente

## 4 Frentes de Trabalho

### 1. Burst no Final da Trajetoria Angular (Bug Fix)

**Problema**: Mine, Fan, Cake, RomanCandle e Comet recebem apenas `angleOffset` mas NAO recebem `launchHeading`/`launchPitch` do cue. O burst da shell (`FireworkBurst`) usa corretamente o quaternion de angulo para posicionar o burst no final da trajetoria, mas os efeitos ground-level (mine, fan, cake, candle, comet) ignoram os angulos do cue — sempre disparam para cima (eixo Y).

**Solucao**: Passar `launchHeading` e `launchPitch` como props para Mine, Fan, Cake, RomanCandle, Comet e aplicar rotacao quaternion ao vetor de direcao de disparo dentro de cada efeito. Isso garante que quando o usuario ajusta o angulo no seletor (PyroLaunchAngle), o efeito segue a trajetoria correta.

### 2. Mine/Fan/Cake — Polish Remanescente

**MineEffect**: Garantir que trail segments usam `launchDir` rotacionado para trilhas de cometa seguirem o angulo correto.

**FanEffect**: Ja tem calibracao por caliber (ciclo #16). Agora aplicar rotacao `launchHeading/Pitch` ao grupo raiz para fan apontar na direcao do cue.

**CakeEffect**: Cada shot individual deve usar `launchDir` rotacionado. Garantir que `getBreakHeight` escala corretamente cada shot burst.

### 3. Export Documental — Modelos Formais por Tipo (SEM transcrever conversa)

**Problema Atual**: `exportJoiPdf` e `exportJoiDocx` recebem `msg.content` (markdown da mensagem inteira da Joi) e renderizam TODO o texto. Quando a Joi gera um orcamento, o markdown pode conter saudacoes, explicacoes e contexto conversacional que NAO pertencem ao documento formal.

**Solucao**: Criar um parser inteligente (`extractDocumentBody`) que:
1. Remove saudacoes/despedidas ("Olá chefinho", "Pronto!", "Aqui está", "Espero que...", etc.)
2. Remove blocos KMZ/codigo/meta
3. Identifica o inicio do conteudo formal (primeira heading ou primeiro bloco estruturado)
4. Identifica o fim do conteudo formal (antes de despedidas/comentarios finais)
5. Para cada `DocType`, aplica template de formatacao especifica:

| DocType | Template |
|---------|----------|
| `orcamento` | Cabecalho empresa, tabela de itens/valores, totais, condicoes de pagamento, validade |
| `declaracao` | Cabecalho oficial, corpo do documento, local/data, assinatura |
| `contrato` | Partes, clausulas numeradas, foro, assinaturas |
| `checklist` | Items com checkboxes, status, responsavel |
| `licitacao` | Referencia edital, habilitacao, proposta tecnica/comercial |
| `geral` | Documento limpo com headings e paragrafos |

Aplicar mesma logica em PDF e DOCX.

### 4. Build Verification

## Arquivos Modificados

| Arquivo | Acao |
|---------|------|
| `src/components/editor/skycanvas/FireworkRenderer.tsx` | Passar `launchHeading`/`launchPitch` para Mine, Fan, Cake, Candle, Comet |
| `src/components/editor/effects/MineEffect.tsx` | Receber heading/pitch, rotacionar direcao de disparo |
| `src/components/editor/effects/FanEffect.tsx` | Receber heading/pitch, rotacionar grupo |
| `src/components/editor/effects/CakeEffect.tsx` | Receber heading/pitch, rotacionar shots |
| `src/components/editor/effects/RomanCandleEffect.tsx` | Receber heading/pitch, rotacionar trajetoria dos shots |
| `src/components/editor/effects/CometEffect.tsx` | Receber heading/pitch, rotacionar direcao |
| `src/utils/joiDocumentParser.ts` | **NOVO** — `extractDocumentBody()` + templates por DocType |
| `src/utils/joiPdfExport.ts` | Usar `extractDocumentBody`, templates formais por tipo |
| `src/utils/joiDocxExport.ts` | Usar `extractDocumentBody`, templates formais por tipo |

## Ordem de Execucao

| Passo | Tarefa |
|-------|--------|
| 1 | `joiDocumentParser.ts` — parser inteligente de extracao de corpo documental |
| 2 | `joiPdfExport.ts` + `joiDocxExport.ts` — integrar parser, templates formais |
| 3 | `FireworkRenderer.tsx` — passar heading/pitch para efeitos ground |
| 4 | Mine, Fan, Cake, RomanCandle, Comet — aplicar rotacao angular |
| 5 | Build verification |


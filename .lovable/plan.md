

# Ciclo #77 — Eliminação de Bugs e Aprimoramento Final de Documentos

## Bugs Identificados

1. **Ordem dos regex no parser causa vazamento de conteúdo anexado** — O pattern `[DOCUMENTO ANEXADO]` (index 2) roda ANTES do pattern de code blocks (index 3). O regex lazy `[\s\S]*?(?=\n\n|$)` para no primeiro `\n\n` dentro do code block, deixando conteúdo residual. Depois, o pattern de code blocks não consegue mais fazer match porque os markers ``` já foram parcialmente consumidos.

2. **PDF: tabelas não ajustam altura para texto longo** — `renderTable` usa `rowH = 8` fixo. Texto que ultrapassa `maxWidth` é truncado silenciosamente por jsPDF em vez de expandir a linha.

3. **PDF: `parsedLines` retornado pelo parser não é usado** — O export recebe `parsedLines` mas processa `body` (string re-serializada), perdendo informação de heading level quando o texto não começa com `#` após reconstrução.

4. **PDF: inline formatting (`**bold**`, `*italic*`, `` `code` ``) não é renderizada** — `stripInlineMarkdown` remove tudo para texto plano. Bold/italic/code são perdidos no PDF.

5. **DOCX: header com cor cyan na marca "FX KONTROL"** — Documentos formais devem manter brand sutil, mas o cyan no header é aceitável; porém o body do documento pode ter resíduos de formatação colorida.

6. **Parser: emojis no meio de texto formal não são removidos** — O regex `DECORATIVE_EMOJI_RE` remove emojis decorativos mas a Joi frequentemente coloca 🎆🔥 etc no meio de frases, deixando espaços duplos residuais.

## Correções Planejadas

### 1. Reordenar e fortalecer `joiDocumentParser.ts`
- Mover pattern de code blocks para ANTES do pattern DOCUMENTO ANEXADO
- Simplificar regex de DOCUMENTO ANEXADO para capturar apenas a tag `[DOCUMENTO ANEXADO:...]` (já que o code block foi removido antes)
- Adicionar collapse de espaços múltiplos após remoção de emojis
- Adicionar patterns para strings residuais como `undefined`, `null`, `[object Object]`

### 2. Melhorar renderização de tabelas no PDF
- Calcular altura real de cada linha baseado no texto mais longo da row (usando `splitTextToSize`)
- Ajustar posição Y das rows dinamicamente
- Adicionar bordas verticais nas colunas para melhor legibilidade

### 3. Adicionar suporte a inline formatting no PDF
- Substituir `stripInlineMarkdown` por um renderer que detecta `**bold**`, `*italic*`, `` `code` `` e alterna `doc.setFont()` inline
- Usar `helvetica bold` para bold, `helvetica italic` para itálico, `courier` para code

### 4. Limpar espaços e linhas residuais
- Após todos os regex, colapsar múltiplas linhas vazias consecutivas em uma só
- Remover espaços duplos/triplos dentro de linhas (resíduo de emoji removal)

## Arquivos

| Ação | Arquivo |
|------|---------|
| Edit | `src/utils/joiDocumentParser.ts` |
| Edit | `src/utils/joiPdfExport.ts` |
| Edit | `src/utils/joiDocxExport.ts` |

## Ordem de Execução
1. Corrigir parser (reordenar patterns, colapsar espaços)
2. Melhorar PDF (tabelas dinâmicas, inline formatting)
3. Ajustes DOCX (consistência)
4. Build verification




# Ciclo #76 — Correção de Bugs no Parser + Tabelas Profissionais ABNT

## Bugs Identificados

1. **Regex `DOCUMENTO ANEXADO` fraco** — o lookahead `(?=\n\n|\n[A-Z]|\n#|$)` falha quando seguido por texto em minúsculas; blocos anexados vazam para o documento
2. **Tabelas sem formatação no PDF** — células renderizadas sem bordas, sem fundo de cabeçalho, sem alinhamento. Apenas `text()` com offset manual
3. **DOCX não suporta tabelas** — `parseMarkdownToDocxChildren` ignora completamente linhas com `|`, tabelas desaparecem
4. **Linhas separadoras `|---|---|` passam no PDF** — o check `!trimmed.startsWith('---')` não pega separadores com pipes
5. **Inline code backticks aparecem** — `\`código\`` é formatado como code no DOCX mas aparece "cru" no PDF
6. **Headings markdown `##` perdem formatação** — `stripMarkdown` remove `#` mas o detector de headers no PDF só reconhece UPPERCASE, perdendo headings normais
7. **Formatação não segue ABNT** — ABNT NBR 14724 exige: margens 3cm esquerda/superior, 2cm direita/inferior; fonte 12pt corpo; espaçamento 1.5 entre linhas; Times New Roman ou Arial

## Deliverables

### 1. Fortalecer `joiDocumentParser.ts`
- Regex DOCUMENTO ANEXADO mais agressivo: captura até próximo `\n\n` ou fim do texto sem lookahead complexo
- Adicionar strip de linhas que são apenas backticks residuais
- Adicionar pattern para capturar blocos JSON soltos `{...}` com `"action":` (JOI_CMD que escapou formatação)

### 2. Reescrever renderização de tabelas no PDF (`joiPdfExport.ts`)
- Detectar blocos de tabela (linhas consecutivas com `|`)
- Primeira linha = cabeçalho com fundo escuro e texto bold branco
- Células com bordas finas, padding interno, alternância de cor (zebra)
- Largura proporcional ao conteúdo
- Seguir ABNT: fonte 10pt em tabelas (redução permitida), bordas horizontais

### 3. Adicionar suporte a tabelas no DOCX (`joiDocxExport.ts`)
- Parsear linhas com `|` como `Table` + `TableRow` + `TableCell`
- Header row com bold e fundo cinza claro
- Bordas em todas as células
- `WidthType.DXA` para largura proporcional

### 4. Aplicar normas ABNT em ambos os exports
- **Margens**: 3cm esquerda e superior, 2cm direita e inferior
- **Fonte corpo**: Arial 12pt (ABNT aceita Arial ou Times)
- **Entrelinha**: 1.5 (PDF: ~7mm, DOCX: line spacing 360)
- **Headings**: 14pt bold, sem recuo colorido excessivo
- **Numeração de páginas**: canto superior direito (ABNT)
- **Tabelas**: bordas horizontais, fonte 10pt

### 5. Melhorar detecção de headings no PDF
- Antes de verificar UPPERCASE, checar se a linha original começava com `#` no markdown
- Preservar info de heading level durante o strip

## Files

| Action | File |
|--------|------|
| Edit | `src/utils/joiDocumentParser.ts` |
| Edit | `src/utils/joiPdfExport.ts` |
| Edit | `src/utils/joiDocxExport.ts` |

## Execution Order
1. Fortalecer parser (regex + JSON solto + backticks)
2. Reescrever PDF com tabelas e ABNT
3. Reescrever DOCX com tabelas e ABNT
4. Build verification


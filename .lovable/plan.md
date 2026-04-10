

# Ciclo #75 — Aprimoramento de Documentos Joi: Legibilidade, Formatação e Limpeza de Comandos

## Problemas Identificados

1. **Blocos `[JOI_CMD]` vazam para o documento** — o parser só remove `[KMZ_READY]` e code blocks
2. **Blocos `[DOCUMENTO ANEXADO]` vazam** — texto de anexo injected no prompt aparece no export
3. **PDF com fontes pequenas demais** — corpo em 9pt, headers 10pt; padrão internacional é 11-12pt corpo
4. **Espaçamento entre linhas muito apertado** no PDF (4.5mm entre linhas)
5. **Emojis aparecem no documento formal** — ☐ e checkboxes ok, mas 🎆🔥 etc não
6. **Linhas separadoras de tabela markdown (`---|---`)** não filtradas
7. **DOCX usa cores cyan nos headings** — documentos formais devem usar preto/escuro

## Deliverables

### 1. Edit `src/utils/joiDocumentParser.ts`
- Adicionar `[JOI_CMD]...[/JOI_CMD]` ao `META_BLOCK_PATTERNS`
- Adicionar `[DOCUMENTO ANEXADO: ...]...` pattern (com o code block do conteúdo)
- Adicionar strip de emojis decorativos (manter ☐/☑ para checklists)
- Filtrar linhas de separador de tabela markdown (`---|---|---`)
- Adicionar mais patterns de farewell/greeting para melhor limpeza

### 2. Edit `src/utils/joiPdfExport.ts`
- Aumentar corpo para 11pt (era 9pt), headers para 13pt (era 10pt)
- Aumentar line height para 5.5mm (era 4.5mm)
- Aumentar margens para 25mm (era 20mm) — padrão ISO
- Melhorar contraste: texto corpo preto (#1a1a1a), não cinza (#333)
- Ajustar bullet indent e table cell sizing proporcionalmente

### 3. Edit `src/utils/joiDocxExport.ts`
- Headings em preto/escuro (era cyan) — documentos formais
- Aumentar body size para 22 (11pt, era 20/10pt)
- Bold text em preto (era amber #E8A317) — profissional
- Ajustar spacing entre parágrafos (after: 120 em vez de 80)

## Files

| Action | File |
|--------|------|
| Edit | `src/utils/joiDocumentParser.ts` |
| Edit | `src/utils/joiPdfExport.ts` |
| Edit | `src/utils/joiDocxExport.ts` |

## Execution Order
1. Fortalecer parser (remover comandos + emojis + separadores)
2. Aprimorar PDF com normas de legibilidade
3. Aprimorar DOCX com formatação profissional
4. Build verification


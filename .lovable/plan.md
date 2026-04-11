

# Ciclo #78 — Bugs Críticos e Gaps na Plataforma

## Bug #1: DOCX Export Quebrado (CRÍTICO)
**`Packer.toBuffer()` não funciona no browser** — a lib `docx` usa JSZip internamente que requer `nodebuffer` para `toBuffer()`. No browser deve-se usar `Packer.toBlob()`.

- **Arquivo**: `src/utils/joiDocxExport.ts` linha 277
- **Fix**: Trocar `Packer.toBuffer(doc)` → `Packer.toBlob(doc)` e usar o blob diretamente

## Bug #2: PDF — Y não atualiza após page break em `renderWrappedFormattedLine`
A função recebe `y` como parâmetro (cópia local), mas `checkBreak` modifica o `y` do escopo externo via closure em `checkPageBreak`. Após page break, a função continua usando o `y` antigo, causando texto renderizado fora da área visível.

- **Arquivo**: `src/utils/joiPdfExport.ts` linhas 62-97
- **Fix**: Refatorar para usar um objeto `{y: number}` passado por referência, ou retornar o novo Y do checkBreak

## Bug #3: Parser — `[DOCUMENTO ANEXADO]` com conteúdo multi-parágrafo vaza
O regex `[DOCUMENTO ANEXADO:[^\]]*\][^\[]*/g` captura até o próximo `[`, mas se não houver outro `[` no texto, consome tudo. E se houver colchetes no conteúdo do documento, para cedo demais.

- **Arquivo**: `src/utils/joiDocumentParser.ts`
- **Fix**: Usar regex mais robusto que captura até `\n\n\n` ou fim do texto

## Bug #4: PDF — Tabelas sem borda superior no header
O `renderTable` desenha fundo do header mas não a borda superior, inferior é desenhada por `doc.line` nas data rows.

- **Fix**: Adicionar borda completa ao redor da tabela

## Correções Planejadas

### 1. Fix DOCX Export (`joiDocxExport.ts`)
```typescript
// Antes:
const buffer = await Packer.toBuffer(doc);
const blob = new Blob([new Uint8Array(buffer)], { type: '...' });

// Depois:
const blob = await Packer.toBlob(doc);
```

### 2. Fix PDF page break Y tracking (`joiPdfExport.ts`)
- Usar objeto `yRef = { value: y }` passado para `renderWrappedFormattedLine` e `renderTable`
- Após `checkPageBreak`, atualizar `yRef.value` para que o renderer use a posição correta

### 3. Fortalecer parser (`joiDocumentParser.ts`)
- Melhorar regex de DOCUMENTO ANEXADO para ser mais agressivo

### 4. Adicionar bordas completas às tabelas no PDF
- Borda superior e inferior ao bloco inteiro da tabela

## Arquivos

| Ação | Arquivo |
|------|---------|
| Edit | `src/utils/joiDocxExport.ts` |
| Edit | `src/utils/joiPdfExport.ts` |
| Edit | `src/utils/joiDocumentParser.ts` |

## Ordem
1. Fix DOCX (bug crítico — export 100% quebrado)
2. Fix PDF page break tracking
3. Fortalecer parser
4. Build verification


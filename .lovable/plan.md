

## Upload Real de Arquivos ao Painel de Acreditação

### Visão Geral

Adicionar upload de arquivos PDF/imagem a cada documento no painel de acreditação, usando o bucket `assets` existente. Cada documento passa a ter um arquivo real associado, com preview e indicador visual.

### Mudanças

**1. Criar bucket policy para acreditação**

Usar o bucket `assets` existente. Os arquivos serão salvos em `accreditation/{user_id}/{timestamp}-{filename}`.

**2. Atualizar `DocEntry` com dados de arquivo**

```typescript
interface DocEntry {
  name: string;
  description: string;
  filePath?: string;      // path no storage
  fileName?: string;      // nome original do arquivo
  fileSize?: number;      // tamanho em bytes
  fileType?: string;      // mime type (pdf, image/*)
}
```

**3. Adicionar upload inline por documento**

- Cada item no checklist obrigatório ganha um botão "Anexar arquivo" (input file hidden)
- Aceita PDF, JPG, PNG (max 20MB)
- Ao selecionar arquivo: upload para `assets` bucket → atualiza o `DocEntry` com `filePath`
- Indicador visual: ícone de clipe + nome do arquivo quando anexado
- Botão de remover arquivo individual

**4. Área de upload drag-and-drop para docs avulsos**

- Dropzone na seção "Seus Documentos" para arrastar e soltar arquivos
- Auto-detecta nome do documento pelo filename
- Adiciona ao array de documents com o arquivo já vinculado

**5. Enviar metadados de arquivo na validação**

- O payload para `validate-accreditation` passa a incluir `fileName` e `fileType` para cada doc
- A IA pode considerar se o arquivo real foi anexado ou se é apenas declarativo

### Arquivos Modificados

| Arquivo | Alteração |
|---|---|
| `src/pages/AccreditationDashboard.tsx` | DocEntry com file fields, upload handlers, dropzone UI, preview de arquivos |
| Migration SQL | RLS policy no bucket `assets` para path `accreditation/` (se necessário) |

### Detalhes Técnicos

```text
Upload flow:
  User clicks "Anexar" or drops file
  → supabase.storage.from('assets').upload(path, file)
  → path: accreditation/{user_id}/{timestamp}-{sanitized_name}
  → DocEntry updated with filePath, fileName, fileSize, fileType
  → Visual indicator shows attached file
  → On validate: filePath sent to edge function for context

File types: application/pdf, image/jpeg, image/png
Max size: 20MB per file
Bucket: assets (existing, private)
```


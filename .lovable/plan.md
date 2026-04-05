

## Exportar DOCX + Voz Fluida com Humor e "Chefinho"

### 1. Exportador DOCX (`src/utils/joiDocxExport.ts`)

Criar utilitário que converte o markdown da Joi em DOCX profissional usando a biblioteca `docx` (já disponível via npm). Mesma identidade visual do PDF (header FX KONTROL, cores cyan/amber, footer "Gerado por JOI"). O markdown será parseado em Paragraphs, TextRuns, tabelas e listas nativas do DOCX.

### 2. Botão DOCX nas Mensagens (`FXKAssistant.tsx`)

Adicionar botão "DOCX" ao lado do botão "PDF" existente em cada mensagem da assistente. Mesmo estilo visual (h-7, ícone FileText, cor verde/teal para diferenciar do cyan do PDF).

### 3. Voz Mais Fluida (`useJoiSpeech.ts`)

- Reduzir `rate` de 1.05 para 0.95 (mais natural e pausada)
- Ajustar `pitch` de 1.1 para 1.15 (ligeiramente mais expressiva)
- Adicionar processamento de texto para inserir pausas naturais: substituir `.` por `... ` e `,` por `, ` para dar ritmo
- Quebrar textos longos em chunks menores para evitar cortes do SpeechSynthesis

### 4. Humor e "Chefinho" no System Prompt (`fxk-ai-chat/index.ts`)

Atualizar a seção TOM E PERSONALIDADE para:
- Sempre chamar o usuário de "chefinho" ou "chefe" de forma carinhosa
- Adicionar toque de humor leve e descontraído (piadas sutis, expressões brasileiras)
- Manter profissionalismo mas com leveza ("Pronto, chefinho! Seu orçamento tá tinindo!")
- Frases de efeito ao concluir tarefas ("Tá entregue, chefinho! Pode confiar na sua Joi 😉")

### 5. Frases Idle com Humor (`FXKAssistant.tsx`)

Atualizar `IDLE_PHRASES` com frases que usam "chefinho" e humor:
- "Aqui firme cuidando de tudo, chefinho!"
- "Tô de olho em tudo... pode relaxar, chefão!"
- "Diga, chefinho! A Joi tá pronta pra resolver!"

---

### Arquivos Modificados

| Arquivo | Alteração |
|---|---|
| `src/utils/joiDocxExport.ts` | Novo — exportador DOCX com branding FX KONTROL |
| `src/components/FXKAssistant.tsx` | Botão DOCX, import, IDLE_PHRASES com humor |
| `src/hooks/useJoiSpeech.ts` | Rate/pitch ajustados, pausas naturais, chunking |
| `supabase/functions/fxk-ai-chat/index.ts` | System prompt com "chefinho" e humor |
| `package.json` | Adicionar `docx` como dependência |

### Detalhes Técnicos

```text
DOCX generation flow:
  Markdown content → parse headers/bullets/tables
  → docx.js Document with branded Header/Footer
  → Packer.toBuffer() → Blob → download

Voice tuning:
  rate: 1.05 → 0.95 (slower, more natural)
  pitch: 1.1 → 1.15 (warmer)
  Long text → split into sentences → speak sequentially
  Add natural pauses via text preprocessing
```


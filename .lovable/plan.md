

## Exportar Documentos da Joi em PDF + Aprimorar Conhecimentos em Licitações e Contratos

### Conceito

Adicionar um botão "Exportar PDF" em cada mensagem da Joi que contenha documentos (orçamentos, declarações, contratos). O PDF será gerado client-side usando a biblioteca `jspdf` + `html2canvas` ou markdown-to-PDF. Além disso, expandir o system prompt com conhecimento profundo em licitações públicas e contratos.

### Mudanças

**1. Botão "Exportar PDF" nas mensagens da assistente (`FXKAssistant.tsx`)**
- Adicionar ícone `Download` (lucide) ao lado dos botões de feedback em cada mensagem da Joi
- Ao clicar, converte o conteúdo markdown da mensagem em PDF formatado
- Usar `jspdf` + `jspdf-autotable` para gerar PDF limpo com:
  - Header com logo/nome "FX KONTROL · Minas Pirotécnica"
  - Data de geração
  - Conteúdo formatado (títulos, tabelas, listas)
  - Footer com "Gerado por JOI · Secretária Executiva AI"
- Instalar dependências: `jspdf`, `html2pdf.js`

**2. Função utilitária de exportação (`src/utils/joiPdfExport.ts`)**
- Receber conteúdo markdown e gerar PDF
- Parsing do markdown para estruturar o documento
- Formatação profissional com a paleta da plataforma (cyan/âmbar/gold)
- Detecção automática do tipo de documento (orçamento, declaração, contrato) para ajustar template

**3. Aprimorar System Prompt — Licitações e Contratos (`fxk-ai-chat/index.ts`)**

Adicionar novas seções ao system prompt:

- **LICITAÇÕES PÚBLICAS**: Lei 14.133/2021 (Nova Lei de Licitações), modalidades (pregão, concorrência, tomada de preços), elaboração de propostas técnicas e de preços, documentação de habilitação jurídica/fiscal/técnica, impugnações e recursos, atas de registro de preços
- **CONTRATOS**: Tipos (prestação de serviços, fornecimento, empreitada), cláusulas obrigatórias, termos aditivos, reajustes, garantias contratuais, rescisão, subcontratação
- **PROPOSTAS COMERCIAIS**: Estrutura profissional, escopo técnico detalhado, cronograma, condições de pagamento, cláusulas de segurança, seguros obrigatórios
- **EDITAIS**: Análise de editais, requisitos de habilitação, propostas técnicas, atestados de capacidade técnica

**4. Novo preset "LICITAÇÃO" nos comandos rápidos**
- Substituir ou adicionar preset: "Me ajude a analisar um edital e preparar proposta para licitação"

### Arquivos

| Arquivo | Alteração |
|---|---|
| `src/utils/joiPdfExport.ts` | **Novo** — Função de exportação markdown→PDF |
| `src/components/FXKAssistant.tsx` | Botão PDF nas mensagens, import do exportador, novo preset LICITAÇÃO |
| `supabase/functions/fxk-ai-chat/index.ts` | Expandir system prompt com licitações, contratos, editais |
| `package.json` | Adicionar `html2pdf.js` |

### Detalhes Técnicos

```text
Fluxo de exportação:
  Mensagem Joi (markdown) 
    → Parse markdown 
    → Renderizar em div oculto com estilos profissionais
    → html2pdf.js captura e gera PDF
    → Download automático "JOI_[tipo]_[data].pdf"
```




## Adicionar Plantas de Distanciamento, Fechamento de Espaço Aéreo e KMZ para Aeronáutica

### Conceito

Três adições interligadas: (1) conhecimento especializado da Joi sobre plantas de distanciamento NFPA e normas brasileiras, (2) procedimentos de fechamento de espaço aéreo (NOTAM/DECEA), e (3) geração de KMZ com zonas de segurança e restrição aérea para submissão à aeronáutica.

### Mudanças

**1. System Prompt — Novas Especialidades (`supabase/functions/fxk-ai-chat/index.ts`)**

Adicionar duas novas seções ao prompt:

**📐 PLANTAS DE DISTANCIAMENTO**
- Distâncias mínimas de segurança conforme NFPA 1123 (tabela por calibre: 50mm→21m, 75mm→42m, 100mm→60m, 150mm→105m, 200mm→140m)
- Distâncias NFPA 1126 (Proximity Displays — reduzidas com proteção)
- Normas brasileiras do Exército (R-105) para raios de segurança
- Geração de plantas de distanciamento com zonas: zona de fogo, zona de segurança (equipe), zona de público, zona de fallout
- Incluir dimensionamento de barricadas e proteções
- Formato: tabela + descrição textual para gerar croqui/planta

**✈️ FECHAMENTO DE ESPAÇO AÉREO (NOTAM/DECEA)**
- Procedimentos para solicitar NOTAM (Notice to Airmen) via DECEA
- Prazos: NOTAM com mínimo 72h de antecedência
- Informações obrigatórias: coordenadas GPS do local, raio de restrição, altitude máxima dos efeitos, horário de início/fim, tipo de atividade (pirotecnia ou RPAS)
- ICA 100-12 e ICA 100-40 para operações de drones
- Contato com SRPV (Serviço Regional de Proteção ao Voo)
- Modelo de formulário para solicitação de NOTAM
- Para drones: autorização SARPAS (DECEA) + registro SISANT (ANAC)

**2. Gerador de KMZ para Aeronáutica (`src/utils/joiAeroKmzExport.ts`) — Novo**

Função que gera KMZ com:
- **Círculo de zona de fogo** (polígono vermelho, raio conforme calibre)
- **Círculo de zona de segurança público** (polígono amarelo, raio NFPA)
- **Cilindro de restrição aérea** (polígono com altitude, raio do NOTAM)
- **Ponto central** (coordenadas GPS do local do show)
- **Metadados**: nome do evento, data, horário, altitudes, responsável técnico
- Compatível com Google Earth e submissão ao DECEA
- Reutiliza a lógica de coordenadas do `geoToolsKmlExporter.ts`

Parâmetros de entrada:
```text
{
  eventName, date, startTime, endTime,
  gpsCenter: { lat, lng },
  maxCaliber (mm) → calcula raios automaticamente,
  maxAltitude (m) → teto de restrição aérea,
  notamRadius (NM) → raio do NOTAM,
  responsibleName, responsibleDoc
}
```

**3. Novo preset "ESPAÇO AÉREO" + Botão KMZ (`FXKAssistant.tsx`)**

- Adicionar preset: `ESPAÇO AÉREO` — "Me ajude a preparar a documentação de fechamento de espaço aéreo e planta de distanciamento"
- Adicionar preset: `PLANTA` — "Gere uma planta de distanciamento de segurança conforme NFPA para este show"
- Na resposta da Joi quando gera plantas/NOTAM, incluir botão "Exportar KMZ Aeronáutica" que chama o gerador

**4. Instrução no System Prompt para KMZ**

Quando a Joi gerar uma planta de distanciamento ou NOTAM, incluir ao final da resposta um bloco especial `[KMZ_READY]` com os parâmetros estruturados, permitindo que o frontend detecte e ofereça o botão de exportação KMZ.

### Arquivos

| Arquivo | Alteração |
|---|---|
| `src/utils/joiAeroKmzExport.ts` | **Novo** — Gerador de KMZ com zonas de segurança e restrição aérea |
| `src/components/FXKAssistant.tsx` | Novos presets ESPAÇO AÉREO e PLANTA, detecção de `[KMZ_READY]`, botão exportar KMZ |
| `supabase/functions/fxk-ai-chat/index.ts` | Novas seções: plantas de distanciamento (NFPA 1123/1126), fechamento espaço aéreo (NOTAM/DECEA/SARPAS) |

### Detalhes Técnicos

```text
Fluxo:
  Usuário pede planta/NOTAM → Joi gera documento com dados estruturados
  → Frontend detecta [KMZ_READY:{json}] na resposta
  → Renderiza botão "Exportar KMZ Aeronáutica"  
  → Clique gera KMZ com zonas circulares e metadados
  → Download automático "NOTAM_[evento]_[data].kmz"

Zonas no KMZ (círculos concêntricos):
  🔴 Zona de Fogo — raio conforme calibre (NFPA 1123)
  🟡 Zona de Segurança — raio de fallout (1.5x zona de fogo)  
  🔵 Restrição Aérea — raio do NOTAM (tipicamente 1-3 NM)
  📍 Ponto Central — coordenadas GPS com metadados
```


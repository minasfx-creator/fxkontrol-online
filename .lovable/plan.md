

# Simplificar Controladores — Fusão Net+Módulo, Eliminar Auto, Check BR2049, IA Holográfica

## Resumo

1. **Fundir** `artnet_modules` (FXK-NET) + `module` (FXK Module) em um único painel **FXK-NET** que combina gestão de rede Art-Net com controle de módulos de campo
2. **Eliminar** `auto_fire` (Auto Fire) como painel separado — a lógica de auto-fire já existe no PyroFireOne
3. **Reimaginar** o Check Slave como um painel diagnóstico BR2049 com testes de canal individuais, scanlines e estética holográfica
4. **Evoluir** o FXK-AI Assistant para estilo "Joi" (BR2049) — assistente holográfico integrado ao workspace, não apenas chat flutuante

## Mudanças

### 1. `src/components/editor/live-firing/types.ts` — Limpar FXCMode

- Remover `'auto_fire'` e `'module'` do tipo `FXCMode`
- `artnet_modules` permanece como key unificada para o painel fusionado

### 2. NEW: `src/components/editor/live-firing/FXKNetPanel.tsx` — Painel Fusionado

Combina ArtNetModulePanel + VirtualIFMx32QPanel em um painel unificado com 2 abas:
- **NETWORK**: Lista de módulos Art-Net com discovery, IP, universo, status de conexão (herda de ArtNetModulePanel)
- **MODULE**: Controle individual do módulo selecionado — grade de ignitores 32-pin, ARM/DISARM, firing, LCD virtual (herda de VirtualIFMx32QPanel)
- Seleção de módulo na aba NETWORK abre automaticamente aba MODULE
- Estética BR2049: borders âmbar, scanlines, font mono, status dots com glow
- Header com telemetria compacta: módulos online, latência, sinal RF

### 3. `src/components/editor/live-firing/CheckSlavePanel.tsx` — BR2049 Channel Diagnostics

Reimaginação completa como terminal de diagnóstico holográfico:
- **Grade de canais expandida**: 32 canais (não apenas 16) com teste individual por canal
- **Teste de continuidade**: botão TEST por canal que pulsa corrente de verificação e mostra resultado (OK/FAIL/OPEN/SHORT) com animação de scan âmbar
- **Barra de resistência visual**: cada canal mostra barra horizontal de resistência com gradiente verde→amarelo→vermelho
- **Teste em lote**: botão "SCAN ALL" com progresso sequencial canal-a-canal com animação tipo Matrix/BR2049
- **Status summary**: contadores PASS/FAIL/OPEN com ícones holográficos
- **Estética BR2049**: background escuro com vinheta, scanlines horizontais, borders âmbar `hsl(32 100% 50%)`, labels em mono tracking-wide, status dots com glow pulsante, overlay de rain-streak sutil
- **Detalhes por canal**: popup/tooltip ao clicar mostrando histórico de resistência, último teste, status do ignitor

### 4. `src/components/FXKAssistant.tsx` — Evolução "Joi" BR2049

Transformar de chat flutuante para assistente holográfico integrado:
- **Modo docked**: ao invés de floating bubble, pode ancorar lateralmente no workspace (slide-in panel de 360px)
- **Holographic avatar**: círculo âmbar animado no header com ondas de áudio quando AI fala (3 barras oscilantes)
- **Thinking visualization**: durante processamento, mostra padrão de onda senoidal âmbar animada (não apenas dots)
- **Context awareness**: presets dinâmicos baseados no modo ativo (se está em PYRO, mostra presets de pirotecnia; se DMX, presets de efeitos)
- **Voice line styling**: respostas da AI com efeito de "materialização" — texto aparece com opacity fade + blur sutil, simulando projeção holográfica
- **Amber rain overlay** no painel inteiro quando idle
- **Close → dissolve animation**: ao fechar, efeito de dissolução holográfica (scale down + blur + fade)

### 5. `src/pages/CommandCenter.tsx` — Atualizar Navegação

- Remover `auto_fire` e `module` das MODE_SECTIONS
- `artnet_modules` → label "FXK-NET" (já está) — agora renderiza `<FXKNetPanel>`
- Atualizar CONSOLE_ACCENTS removendo entries obsoletos
- Check mode label: "Check" → "DIAGNOSTICS"

### 6. `src/components/editor/LiveFiringPanel.tsx` — Atualizar Referências

- Remover `auto_fire` dos MODE_CATEGORIES e SWIPE_MODES
- Remover `module` dos MODE_CATEGORIES
- Case `artnet_modules` → renderizar `<FXKNetPanel>`
- Remover case `module` e case `auto_fire`
- Importar FXKNetPanel, remover imports de ArtNetModulePanel e VirtualIFMx32QPanel

### 7. `src/index.css` — Novas Animações BR2049

- `@keyframes channel-scan`: varredura horizontal por canal (para o teste sequencial)
- `@keyframes holo-dissolve`: scale(1)→scale(0.9) + blur(12px) + opacity(0)
- `@keyframes voice-wave`: oscilação de barras de áudio para avatar da AI
- `.animate-channel-scan`, `.animate-holo-dissolve`, `.animate-voice-wave`

## Arquivos

1. `src/components/editor/live-firing/types.ts` — Limpar FXCMode
2. `src/components/editor/live-firing/FXKNetPanel.tsx` — **NOVO** painel fusionado
3. `src/components/editor/live-firing/CheckSlavePanel.tsx` — Reimaginação BR2049
4. `src/components/FXKAssistant.tsx` — Evolução holográfica "Joi"
5. `src/pages/CommandCenter.tsx` — Navegação simplificada
6. `src/components/editor/LiveFiringPanel.tsx` — Referências atualizadas
7. `src/index.css` — Animações BR2049

## Notas Técnicas

- Sem mudanças no banco de dados
- Sem novas dependências
- AutoFirePanel.tsx e ArtNetModulePanel.tsx ficam como arquivos mortos (não deletados, apenas não importados) — export DEMO_CUES de AutoFirePanel ainda é usado por PyroFireOnePanel
- VirtualIFMx32QPanel reutilizado internamente pelo FXKNetPanel (composição)
- Cores de segurança (vermelho ARM, verde SUCCESS) preservadas




# Consolidação Command Center — 7 Consoles Focados

## Conceito

Reduzir de ~16 modos para **7 consoles** organizados em 3 grupos:

```text
┌─────────────────────────────────────────────┐
│  CONSOLES (4 principais)                    │
│  ├─ FXK-PYRO    → Disparo pirotécnico       │
│  ├─ FXK-DMX     → Efeitos especiais DMX     │
│  ├─ FXK-LIGHT   → grandMA3 / iluminação     │
│  └─ FXK-DRONE   → Comando de drones         │
├─────────────────────────────────────────────┤
│  SHOW CONTROL (1 painel macro)              │
│  └─ SHOW CTRL   → Overview tempo-real dos   │
│                    4 sistemas + timecode     │
├─────────────────────────────────────────────┤
│  TOOLS (2 painéis técnicos)                 │
│  ├─ MODULE      → Controle de módulo campo  │
│  └─ DMX MONITOR → Log de sinais DMX/Art-Net │
└─────────────────────────────────────────────┘
```

## Mudanças

### 1. `src/pages/CommandCenter.tsx` — Simplificar para 7 modos

- **CommandMode** reduzido: `'pyro_fire' | 'super_dmx' | 'fxk_light' | 'drone_ops' | 'show_control' | 'module' | 'dmx_monitor'`
- **FIRE_MODES**: `['pyro_fire', 'super_dmx']` (só esses dois recebem ARM/CUE/PANIC chrome)
- **MODE_SECTIONS**: 3 grupos (CONSOLES, SHOW CONTROL, TOOLS)
- **CONSOLE_ACCENTS**: 7 entries com cores distintas:
  - PYRO: vermelho (`hsl(0 85% 48%)`)
  - DMX: azul (`hsl(200 80% 48%)`)
  - LIGHT: índigo (`hsl(240 50% 52%)`)
  - DRONE: teal (`hsl(165 100% 42%)`)
  - SHOW CTRL: âmbar (`hsl(32 100% 50%)`)
  - MODULE: violeta (`hsl(270 60% 50%)`)
  - DMX MONITOR: verde (`hsl(120 70% 42%)`)
- **renderDirectPanel**: `fxk_light` → `<MA3ControlPanel>`, `drone_ops` → `<DroneCommandPanel>`, `show_control` → `<ShowControlPanel>`, `module` → `<FXKNetPanel>`, `dmx_monitor` → `<DMXMonitorPanel>`
- Remover imports de: VirtualControllerHub, PBusMonitorPanel, WiFiDirectControlPanel, ConnectionManagerPanel, RadioControlPanel, FieldMap2D, MobileLinkMode, SettingsPanel
- **Mobile categories**: 2 categorias — "CONSOLES" (4) e "TOOLS" (3)

### 2. NEW: `src/components/editor/ShowControlPanel.tsx` — Show Control Macro

Painel de visão macro que mostra os 4 sistemas em tempo real:
- **Layout quad-split**: 4 quadrantes, um por sistema (PYRO / DMX / LIGHT / DRONE)
- Cada quadrante mostra:
  - Status (ONLINE/OFFLINE/ARMED) com dot pulsante
  - Contador de canais/dispositivos ativos
  - Último comando executado com timestamp
  - Mini barra de atividade (sparkline)
- **Barra central de Timecode**: HH:MM:SS:FF display grande
- **Contadores globais**: Total armed, total fired, uptime
- **Log de eventos unificado**: Lista scrollável dos últimos 50 comandos de todos os sistemas, com timestamp e cor por sistema
- Estética BR2049: fundo escuro, borders âmbar, quadrantes com glow sutil do sistema correspondente

### 3. NEW: `src/components/editor/DMXMonitorPanel.tsx` — DMX Signal Monitor

Monitor de sinais DMX para teste entre plataformas:
- **Barra de 512 canais**: Grid visual mostrando valores DMX (0-255) por canal com cores de intensidade (preto→âmbar→branco)
- **Seleção de universo**: dropdown para escolher universo DMX (0-15)
- **Seleção de source**: Art-Net / sACN / Internal — de onde capturar
- **Log de comandos**: Lista cronológica de todos os pacotes DMX recebidos com:
  - Timestamp (ms precision)
  - Source IP / protocolo
  - Universo + canais alterados
  - Valores anterior → novo
- **Filtros de log**: por universo, por range de canais, por source
- **Botão CLEAR LOG** e **EXPORT CSV**
- **Indicadores**: pacotes/segundo, latência média, erros de sequência
- Estética BR2049: terminal escuro, valores em mono verde/âmbar, scanlines

### 4. `src/components/editor/LiveFiringPanel.tsx` — Atualizar MODE_CATEGORIES

- Reduzir categorias para alinhar com os 7 modos
- FIRE: `super_dmx`, `pyro_fire`
- TOOLS: `show_control`, `module`, `dmx_monitor`
- Casos de renderização para `show_control`, `module`, `dmx_monitor`
- Remover casos obsoletos (simple_dmx, manual_fire, check_slave, controllers, pbus, wifi_direct, connections, radio, field_map, mobile_link, settings, etc.)

### 5. `src/components/editor/live-firing/types.ts` — Atualizar FXCMode

- Simplificar para: `'super_dmx' | 'pyro_fire' | 'fxk_light' | 'drone_ops' | 'show_control' | 'module' | 'dmx_monitor' | 'settings'`

## Arquivos

1. `src/components/editor/ShowControlPanel.tsx` — **NOVO** painel macro dos 4 sistemas
2. `src/components/editor/DMXMonitorPanel.tsx` — **NOVO** monitor de sinais com log
3. `src/pages/CommandCenter.tsx` — Simplificação radical para 7 modos
4. `src/components/editor/LiveFiringPanel.tsx` — Atualização de categorias
5. `src/components/editor/live-firing/types.ts` — FXCMode simplificado

## Notas Técnicas

- Sem mudanças no banco de dados
- Componentes removidos da navegação (Controllers, P-BUS, WiFi Direct, Connections, Radio, Field Map, Mobile Link, Settings, Check Slave, Simple DMX, Manual Fire) continuam como arquivos — apenas não são acessíveis pelo Command Center
- FXK-DMX (`super_dmx`) absorve funcionalidades de Simple DMX e Manual Fire internamente
- FXK-PYRO (`pyro_fire`) já inclui Check Slave / Diagnostics como sub-tab
- O ShowControlPanel usa dados dos stores existentes (`useLiveSfxStore`, `useSfxChannelStore`) sem novas APIs
- DMXMonitorPanel opera com dados simulados/mock inicialmente — pronto para conectar com Art-Net relay real


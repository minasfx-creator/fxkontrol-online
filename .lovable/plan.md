

# Reorganização Inteligente de Menus, Real-time Show Control, Persistência DMX Log & Refine AI UX

## 1. Reorganizar Menus por Função

### `src/pages/CommandCenter.tsx`
Reorganizar `MODE_SECTIONS` em 3 grupos lógicos com ícones e labels claros:

```text
┌─ EXECUTION (Disparo/Controle ao vivo) ──┐
│  FXK-PYRO   — Disparo pirotécnico        │
│  FXK-DMX    — Efeitos especiais DMX       │
├─ MONITORING (Supervisão em tempo real) ──┤
│  SHOW CTRL  — Overview macro 4 sistemas   │
│  DMX MONITOR — Log de sinais DMX          │
│  FXK-LIGHT  — grandMA3 iluminação         │
│  FXK-DRONE  — Comando de drones           │
├─ HARDWARE (Configuração de campo) ───────┤
│  MODULE     — Controle módulo campo       │
└──────────────────────────────────────────┘
```

- EXECUTION agrupa os dois consoles de disparo direto (fire modes)
- MONITORING agrupa tudo que é visualização/acompanhamento em tempo real
- HARDWARE agrupa configuração de equipamento físico
- Atualizar `MOBILE_CATEGORIES` para refletir os 3 grupos
- Ícones: `Flame` para Execution, `Activity` para Monitoring, `Cpu` para Hardware

### `src/components/editor/LiveFiringPanel.tsx`
Simplificar `MODE_CATEGORIES` para alinhar com a nova estrutura de 7 modos (remover modos obsoletos como `simple_dmx`, `manual_fire`, `check_slave`, `controllers`, `pbus`, `wifi_direct`, `connections`, `radio`, `field_map`, `mobile_link`).

### `src/components/editor/live-firing/types.ts`
Reduzir `FXCMode` para os 7 modos reais + `settings`:
```typescript
export type FXCMode = 'super_dmx' | 'pyro_fire' | 'fxk_light' | 'drone_ops' | 'show_control' | 'module' | 'dmx_monitor' | 'settings';
```

## 2. Real-time Show Control Panel

### `src/components/editor/ShowControlPanel.tsx`
- Adicionar `useEffect` com `supabase.channel('show-telemetry')` para escutar eventos real-time dos 4 sistemas via Realtime subscriptions
- Subscrever `postgres_changes` na tabela `artnet_modules` para detectar módulos online/offline
- Adicionar sparkline com dados reais: acumular últimos 20 data points de atividade por sistema em `useRef`
- Adicionar indicadores de latência por sistema (ms desde último pacote recebido)
- Mover de random sparkline data para dados reais do `useSfxChannelStore` com buffer circular de 20 amostras atualizado a cada 500ms

## 3. Persistência do Log DMX

### Nova tabela: `dmx_logs`
```sql
CREATE TABLE public.dmx_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  session_id text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'Art-Net',
  protocol text NOT NULL DEFAULT 'Art-Net',
  universe integer NOT NULL DEFAULT 0,
  channel_data jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dmx_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own dmx logs" ON public.dmx_logs FOR ALL TO authenticated USING (is_project_owner(project_id)) WITH CHECK (is_project_owner(project_id));
CREATE INDEX idx_dmx_logs_project_session ON public.dmx_logs(project_id, session_id);
```

### `src/components/editor/DMXMonitorPanel.tsx`
- Adicionar botão "SAVE LOG" que faz batch insert dos packetLog na tabela `dmx_logs`
- Adicionar botão "LOAD HISTORY" que carrega logs salvos de sessões anteriores
- Gerar `sessionId` único por mount (uuid)
- Auto-save a cada 100 pacotes ou 30 segundos (o que vier primeiro)
- Adicionar toggle "AUTO-SAVE" no header com estado persistido em localStorage

## 4. Refinar UX do Assistente AI (Joi)

### `src/components/FXKAssistant.tsx`
- **Respostas contextuais**: Detectar `window.location` para mostrar presets relevantes ao modo atual (se Command Center → presets de disparo; se Editor → presets de design)
- **Histórico de sessão**: Salvar últimas 10 mensagens em `localStorage` e restaurar ao reabrir
- **Feedback de qualidade**: Adicionar botões 👍/👎 sutis em cada resposta da AI
- **Modo expandido**: Adicionar botão de expand para full-width (de 360px para 560px) com transição suave
- **Auto-scroll melhorado**: Scroll só quando user está no bottom (detectar scroll position)
- **Input multiline**: Trocar `<input>` por `<textarea>` com auto-resize (max 4 linhas), Enter envia, Shift+Enter nova linha
- **Indicador de conexão**: Dot no header mostrando se a edge function está acessível (ping no mount)
- **Limpeza de conversa**: Botão "CLEAR" no header para resetar mensagens
- **Animação de entrada refinada**: Presets aparecem com stagger delay (50ms cada)
- **Timestamp sutil**: Mostrar hora em cada mensagem (HH:MM)

## Arquivos

1. `src/components/editor/live-firing/types.ts` — Limpar FXCMode
2. `src/pages/CommandCenter.tsx` — Reorganizar menus por função
3. `src/components/editor/LiveFiringPanel.tsx` — Simplificar MODE_CATEGORIES
4. `src/components/editor/ShowControlPanel.tsx` — Real-time com dados reais
5. `src/components/editor/DMXMonitorPanel.tsx` — Persistência + auto-save
6. `src/components/FXKAssistant.tsx` — UX refinements
7. Migration SQL — Tabela `dmx_logs`

## Notas Técnicas
- Tabela `dmx_logs` usa `jsonb` para channel_data (flexível para diferentes formatos de pacote)
- Auto-save usa debounce para evitar writes excessivos
- Realtime no ShowControl usa canais existentes do Supabase
- Nenhuma nova dependência


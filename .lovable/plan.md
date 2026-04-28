## Plano: Diagnóstico Robusto de Conexão iPhone ↔ USB

### Causa Raiz

O iOS Safari (PWA) **não suporta WebUSB nem Web Serial API** — qualquer chamada `navigator.serial.requestPort()` ou `navigator.usb.requestDevice()` falha silenciosamente ou nem aparece no botão. Hoje o app trata isso como "nenhum dispositivo encontrado", confundindo o usuário. A conexão USB no iPhone só funciona via build nativo Capacitor + plugin serial + adaptador MFi.

Além disso, mesmo no caminho nativo, faltam:
1. Detecção de plataforma (iOS Safari vs iOS Capacitor vs desktop)
2. Mensagens de erro acionáveis (cabo errado, falta de MFi, sem permissão)
3. Fallback BLE quando USB não está disponível
4. Bridge do `@capacitor-community/serial` para os adapters existentes

### Mudanças

**1. Detector de capacidade (`src/lib/platformCapabilities.ts`) — novo**
Identifica: `ios-safari-pwa`, `ios-capacitor`, `android-capacitor`, `desktop-chrome`, `desktop-firefox`, `desktop-safari`. Retorna `{ webSerial, webUsb, webBle, capacitorSerial, capacitorBle }` e `recommendedTransports[]`.

**2. Bridge Capacitor Serial (`src/core/discovery/CapacitorSerialDiscoverer.ts`) — novo**
- Tenta carregar dinamicamente `@capacitor-community/serial` (lazy import, sem quebrar build web).
- Implementa a mesma interface `TransportDiscoverer` dos web discoverers.
- No iPhone nativo enumera `/dev/cu.usbserial-*` via plugin.
- Registra no `UnifiedHardwareRegistry` lado-a-lado com WebSerial.

**3. Diagnóstico claro no `USBConnectionPanel` e `EasyConnectPanel`**
- Banner no topo quando capability check falha:
  - iOS Safari PWA → "USB não disponível no Safari. Instale o app FX KONTROL nativo (link para `/install` ou docs)."
  - iOS Capacitor sem plugin → "Plugin serial ausente — execute `npx cap sync ios` após instalar `@capacitor-community/serial`."
  - Desktop sem permissão → "Clique em CONECTAR para autorizar o dispositivo."
- Botão "Diagnosticar" expande relatório:
  - Plataforma detectada
  - APIs disponíveis (✓/✗)
  - Plugins Capacitor carregados
  - Cabo recomendado (Lightning Camera Adapter / USB-C OTG ativo)
  - Lista de VID/PID conhecidos
- Mensagens de erro de `requestPort()` agora mapeadas:
  - `NotFoundError` → "Nenhum dispositivo selecionado ou nenhum compatível."
  - `SecurityError` → "Permissão negada — verifique HTTPS e gesto do usuário."
  - `NotAllowedError` → "iOS bloqueou o acesso — use o app nativo."

**4. Atualizar `capacitor.config.ts`**
- Adicionar plugin config block para `CapacitorSerial` com timeout, baud padrão.
- Comentário inline com checklist de Info.plist.

**5. Atualizar `docs/iphone-usb-serial.md`**
- Tabela "Sintoma → Diagnóstico → Ação" expandida.
- Seção "Como o app diagnostica automaticamente" descrevendo o painel novo.
- Comando de install: `npm install @capacitor-community/serial && npx cap sync ios`.

**6. Hook `useHardwareDiagnostics` (`src/hooks/useHardwareDiagnostics.ts`) — novo**
Centraliza: capability detection, ping de cada discoverer, contagem de portas autorizadas vs visíveis, classificação do problema. Consumido pelos painéis de UI.

**7. Adicionar fallback BLE automático no `EasyConnectPanel`**
- Quando capability detector retornar iOS Safari, esconder a aba USB e destacar BLE como caminho primário.
- Mostrar tooltip "USB indisponível no Safari" no chip USB desabilitado.

### Detalhes Técnicos

**Estrutura de diagnóstico:**
```text
PlatformCapabilities {
  platform: 'ios-safari-pwa'
  webSerial: false  → bloqueio raiz
  webUsb: false
  webBle: false
  capacitorSerial: false (não rodando em Capacitor)
  recommendation: 'install-native-app'
  hint: 'Acesse /install para baixar o app nativo'
}
```

**Lazy load do plugin (não quebra build web):**
```ts
async function loadCapSerial() {
  if (!window.Capacitor?.isNativePlatform()) return null;
  try {
    const mod = await import('@capacitor-community/serial');
    return mod.Serial;
  } catch { return null; }
}
```

**Ordem do `UnifiedHardwareRegistry` no iPhone nativo:**
`CapacitorSerial` → `CapacitorBLE` → fallback web APIs (caso rode em Chrome iOS futuramente).

### Arquivos

**Novos:**
- `src/lib/platformCapabilities.ts`
- `src/core/discovery/CapacitorSerialDiscoverer.ts`
- `src/hooks/useHardwareDiagnostics.ts`
- `src/components/editor/hardware/HardwareDiagnosticsBanner.tsx`

**Editados:**
- `src/core/hardware/UnifiedHardwareRegistry.ts` (registra CapacitorSerialDiscoverer)
- `src/components/editor/USBConnectionPanel.tsx` (banner + erros mapeados)
- `src/components/editor/EasyConnectPanel.tsx` (fallback BLE no iOS)
- `src/lib/usbEngine.ts` (mapeamento de erros em `requestSerialPort`)
- `capacitor.config.ts` (plugin block)
- `docs/iphone-usb-serial.md` (troubleshooting expandido)

### Fora do Escopo

- Não vamos instalar `@capacitor-community/serial` no `package.json` automaticamente (decisão do usuário fazer no clone local + `npx cap sync`). O código carrega via dynamic import e degrada graciosamente.
- Não vamos reativar nenhum sistema de bloqueio — diagnóstico é puramente informativo.
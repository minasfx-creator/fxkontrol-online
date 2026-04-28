## Plano: Wizard de Permissão USB iOS-First

### Objetivo

Criar uma página `/pairing/usb` dedicada ao processo de autorização de hardware USB no iPhone, em formato wizard (passo-a-passo), com QA visual em cada etapa, detecção contextual de plataforma e log auditável do acessório/protocolo selecionado.

### Fluxo do Wizard (5 passos)

```text
┌─ 1. WELCOME ─────────────────────────────────────────────┐
│  Detecta plataforma. Mostra rota correta:                │
│  • iOS Safari PWA → "Use o app nativo" (CTA /install)    │
│  • iOS Capacitor s/ plugin → instruções npm install      │
│  • iOS Capacitor c/ plugin → SEGUIR PARA PASSO 2         │
│  • Desktop / Android → também segue (caminho universal)  │
└──────────────────────────────────────────────────────────┘
            ↓
┌─ 2. CABLE CHECK ─────────────────────────────────────────┐
│  Ilustração do cabo correto (Lightning Camera Adapter    │
│  ou USB-C OTG). Checklist visual:                        │
│  ☐ Adaptador MFi conectado (visual)                      │
│  ☐ Hardware ligado (LED de power)                        │
│  ☐ Cabo de DADOS (não só carga)                          │
│  Botão "Já está tudo conectado" → PASSO 3                │
└──────────────────────────────────────────────────────────┘
            ↓
┌─ 3. AUTHORIZE ───────────────────────────────────────────┐
│  Botão grande "AUTORIZAR DISPOSITIVO" — chama            │
│  requestSerialPort() ou plugin Capacitor.                │
│  Mostra spinner e banner de erro acionável               │
│  (USBConnectionError com hint).                          │
│  Sucesso → captura {vid, pid, label, manufacturer,       │
│             serialNumber, protocol} → PASSO 4            │
└──────────────────────────────────────────────────────────┘
            ↓
┌─ 4. CLASSIFY ────────────────────────────────────────────┐
│  Mostra dispositivo autorizado + dropdown de protocolo:  │
│  • Showven PBUS (19200)  • ENTTEC DMX Pro (57600)        │
│  • DMX512 Open (250000)  • FireOne Custom                │
│  • Genérico (escolhe baud/parity)                        │
│  Auto-sugere baseado em VID/PID conhecido.               │
│  Botão "Confirmar" → registra em portRegistry +          │
│  pairingAuditLog → PASSO 5                               │
└──────────────────────────────────────────────────────────┘
            ↓
┌─ 5. SUCCESS ─────────────────────────────────────────────┐
│  Resumo: dispositivo + protocolo + timestamp.            │
│  Linha de auditoria: "Autorizado por [user] às HH:MM:SS  │
│  via [transport] em [device.label]".                     │
│  CTAs: [Conectar outro] [Abrir Studio] [Ver log]         │
└──────────────────────────────────────────────────────────┘
```

### Componentes & Arquivos

**Novos:**
- `src/pages/UsbPairingWizard.tsx` — página principal, máquina de estados de 5 steps com `useReducer`. Mobile-first (max-w-md, vh-full no iPhone), Vantablack + Cyan.
- `src/components/pairing/WizardStepIndicator.tsx` — barra de progresso 5 dots cyan/muted.
- `src/components/pairing/WelcomeStep.tsx` — usa `useHardwareDiagnostics` para roteamento condicional.
- `src/components/pairing/CableCheckStep.tsx` — ilustração SVG inline (Lightning + adaptador) + checklist tap-to-confirm.
- `src/components/pairing/AuthorizeStep.tsx` — botão grande + spinner + erro inline com `USBConnectionError.hint`.
- `src/components/pairing/ClassifyStep.tsx` — dropdown de protocolo com auto-sugestão.
- `src/components/pairing/SuccessStep.tsx` — card resumo + CTAs.
- `src/lib/pairingAuditLog.ts` — log persistente (localStorage) das autorizações: `{ at, vid, pid, label, protocol, transport, success, errorCode? }`. Capped a 100 entradas. Exporta `recordPairing()`, `getRecentPairings()`, `clearPairings()`.

**Editados:**
- `src/App.tsx` — registrar `<Route path="/pairing/usb" element={<ProtectedRoute><UsbPairingWizard /></ProtectedRoute>} />` (lazy import).
- `src/pages/Install.tsx` — adicionar CTA "Já instalou? Pareie um dispositivo USB →" linkando para `/pairing/usb`.

### Detalhes Técnicos

**Máquina de estados (useReducer):**
```ts
type Step = 'welcome' | 'cable' | 'authorize' | 'classify' | 'success';
type Action =
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'AUTHORIZED'; device: AuthorizedDevice }
  | { type: 'PROTOCOL_SELECTED'; profile: USBDeviceProfile }
  | { type: 'ERROR'; error: USBConnectionError }
  | { type: 'RESET' };
```

**Audit log entry:**
```ts
interface PairingAuditEntry {
  id: string;            // crypto.randomUUID()
  at: number;            // Date.now()
  transport: 'webserial' | 'webusb' | 'capacitor-serial';
  vendorId?: number;
  productId?: number;
  serialNumber?: string;
  label: string;
  protocolKind: string;  // 'pbus' | 'enttec-pro' | etc.
  protocolLabel: string;
  baudRate: number;
  success: boolean;
  errorCode?: string;
  platform: Platform;    // de platformCapabilities
}
```

**iOS-first responsivo:**
- Layout `min-h-dvh` (dynamic viewport — evita corte com toolbar Safari).
- Botões `min-h-[56px]` (Apple HIG touch target).
- Safe-area padding via `env(safe-area-inset-*)`.
- `<HardwareDiagnosticsBanner compact />` no topo de cada step para contexto.
- Suporta gesto de swipe (back) no Step 1 fechar a página.

**Roteamento contextual no Welcome step:**
- Se `recommendation === 'install-native-app'` → CTA primário vai para `/install`, secundário "Continuar mesmo assim" libera o wizard (operador pode estar em desktop testando).
- Se `recommendation === 'install-cap-plugin'` → instrução copy-pasteable.

### Fora do Escopo

- Não criamos backend para sincronizar log entre dispositivos — fica em localStorage (auditoria local). Se o usuário quiser cloud, pode ser adicionado depois via Supabase.
- Não substituímos o `USBConnectionPanel` existente — o wizard é uma rota dedicada complementar ("primeiro pareamento"); o painel continua útil para uso recorrente.
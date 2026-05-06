## Round 1 — Integrar módulos do SkyCanvas legado ao novo `/skycanvas`

Você subiu o `Index.tsx` legado (861 linhas, ~80 painéis lazy). Vou puxar **só os módulos do plane Show/Experience** (criação, edição, simulação, render). Tudo do plane Hardware/Safety (LiveFiring, DMXOutput, Bluetooth, NFC, Radio, MA3, SACN, Fleet, Geofence, MAVLink, FlightLog, Telemetry, FlightCheck) **fica fora** — esses já vivem em `/command`, `/field`, `/pairing/*`.

### O que entra agora (Round 1 — núcleo de criação)

**Library (Left 280) — passa de 4 → 7 abas**
- Catalog → `SupplierCatalogPanel`
- Marketplace → `TemplateMarketplace`
- Templates legado → `ShowTemplatesPanel` (substitui o stub atual)

**Inspector (Right 320) — passa de 5 → 11 abas**
- Effect → `EffectEditor`
- Chain → `ChainEditorPanel`
- Light → `LightProgramPanel`
- Laser → `LaserControlPanel`
- Boids → `BoidsPanel`
- Particle → `ParticleEditorPanel`

**Timeline (180) — passa de 3 → 5 abas**
- Waveform → `AudioWaveform` (já existe, alimentado pelo audio master clock)
- Storyboard → `StoryboardPanel`

### O que NÃO entra (decisão consciente, justificada)

| Painel | Motivo |
|---|---|
| `LiveFiringPanel`, `DMXOutputPanel`, `BluetoothPanel`, `NFCPairPanel`, `RadioControlPanel`, `MA3ControlPanel`, `SACNMonitorPanel`, `RemoteControlPanel`, `MAVLinkPanel` | Hardware live → `/command` + `/pairing` |
| `SafetyPanel`, `FlightCheckTab`, `DiagnosticPanel`, `CollisionPanel`, `WeatherPanel`, `GeofencePanel` | Safety/preflight → `/command` |
| `FleetManagementPanel`, `BatteryPanel`, `TelemetryDashboard`, `FlightLogPanel`, `MobileLinkMonitor` | Telemetria/frota → `/field` |
| `ShowCommanderPanel`, `VirtualControllerHub`, `HardwareHubPanel`, `ShowvenEquipmentPanel` | Operação → `/command` |
| `SwarmGPTPanel`, `SmartScriptAssistant`, `StudioPromptModal` | IA dedicada → `/ai-builder` (já no Master Menu) |
| `MobileTabBar`, `MobileFloatingPanel`, `MobileHUD`, `MobileQuickActions`, `MobileWelcomeScreen`, `MobileConsoleFullscreen`, `LiveModeOverlay`, `UnifiedPanelMenu` | Mobile shell legado → substituídos por `MobilePanelSwitcher` v2 atual |
| `CinematicIntro`, `SplashScreen` | Já desativados no legado |
| `VenueShowOverlay`, `VenueQuickSelector` | Já cobertos por `LibraryGeoTab` |
| `GoogleMapsPanel`, `IndoorSimPanel`, `SiteLayoutPanel`, `SiteModelsPanel`, `FieldMap2D` | Geo já coberto por `LibraryGeoTab` (consolidar depois, sem duplicar) |
| `AROverlayPanel` | Adiado para Round 2 (overlay de viewport, não tab) |
| `ScriptWindow`, `WaypointEditor`, `PositionWindow`, `EffectLibrary` (antigo), `Timeline` (antigo) | Já substituídos por equivalentes DS v1 (TimelineStripView, EffectLibrarySidebar usado em LibraryEffectsTab, etc.) |
| `ReportsPanel`, `RackManager`, `AddressingPanel`, `InventoryPanel`, `LogisticsPanel`, `FiringExportPanel`, `LabelsPanel`, `VideoRecorderPanel`, `ModelImportPanel`, `ScriptingToolsPanel`, `AudienceAnalyzerPanel`, `PIDPanel`, `PositionGroupsPanel`, `SceneEditorPanel`, `SoundLevelPanel`, `ShowSharePanel`, `VersioningPanel`, `ClientApprovalPanel`, `TrajectoryOptimizerPanel`, `ManufacturerCalibrationPanel`, `TakeoffGridPanel`, `TransitionPlannerPanel`, `VideoChoreoPanel`, `GenerativeEffectsPanel`, `SetlistPanel`, `RiderPanel`, `BudgetPanel`, `ShowPreviewPanel`, `MobileLinkPanel`, `ShowSettingsPanel`, `ShowInspectorPanel`, `SynesthesiaPanel`, `QAStudioPanel`, `DMXPanel`, `SMPTEPanel` | **Round 2** (avalio individualmente — alguns são ferramentas grandes que merecem `/dev/*` ou rota própria; outros viram aba) |

### Implementação técnica

1. **10 wrappers `*Tab.tsx` novos** em `src/components/skycanvas/tabs/`:
   - `LibraryCatalogTab.tsx`, `LibraryMarketplaceTab.tsx`, `LibraryTemplatesTab.tsx` (substitui o atual stub)
   - `InspectorEffectTab.tsx`, `InspectorChainTab.tsx`, `InspectorLightTab.tsx`, `InspectorLaserTab.tsx`, `InspectorBoidsTab.tsx`, `InspectorParticleTab.tsx`
   - `TimelineWaveformTab.tsx`, `TimelineStoryboardTab.tsx`
   
   Padrão: `<section role="region" aria-label tabIndex={-1}>` + lazy boundary externa via `TabbedDockPanel`. `onClose` passado como no-op (a aba não fecha).

2. **`SkyCanvas.tsx`** — registra as novas abas em cada `TabbedDockPanel`. Mantém defaultValue atual.

3. **`skyActions.ts`** — adiciona ações de Master Menu para abrir cada aba nova (Library/Marketplace/Inspector/Boids/Lasers etc.) com kbd opcional.

4. **`skycanvas.safetyImports.guard.spec.ts`** — sem mudança; ele já cobre `src/components/skycanvas/**` recursivamente. Os wrappers passam porque importam só de `@/components/editor/*` (que não tem regex banido nos arquivos puxados — vou validar antes de finalizar).

5. **Smoke test** — estendo `skycanvas.editorShell.smoke.spec.ts`: assert dos 10 novos wrappers existirem e serem referenciados em `SkyCanvas.tsx`.

### O que FICA igual

- Contrato Plane Show/Experience: zero CommandBus / FieldBus / SafetyStateMachine / workMode.
- A11y já entregue (roving tabindex, aria-controls, tooltips kbd, skip-link, focus-on-toggle).
- Persistência de layout cloud + localStorage.
- Audio master clock + Show3D Engine sync.
- `Index.tsx` legado **não** é deletado nesta rodada (rota `/editor/*` segue funcionando — DELETE entra na Rodada 2 do `ROUTE_AUDIT.md`).

### Próximas rodadas (não nesta resposta)

- **Round 2**: viewport overlays (AR Compass, BoxSelect, EdgeSnap, Alignment), 4º chip mobile "HUD", `SelectionStatusBar` na topbar, persistência da aba ativa por slot no cloud.
- **Round 3**: triagem dos ~30 painéis "Round 2" listados acima — cada um vira aba, ferramenta `/dev/*` ou é descartado.
- **Round 4**: deletar `Index.tsx` + redirect `/editor` → `/skycanvas`.

### Aprovar?

Posso executar o **Round 1** (10 wrappers + SkyCanvas wiring + skyActions + smoke test). Vai ficar tudo verde no mesmo loop. Confirma?

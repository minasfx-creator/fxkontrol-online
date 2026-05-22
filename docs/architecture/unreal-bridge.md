# FXKONTROL ↔ Unreal Engine 5.7 — Bridge Contract

## Princípio absoluto

**Voo real e disparo pyro são EXCLUSIVOS do app web FXKONTROL** via
`uiCommandGateway → CommandBus → SafetyStateMachine → FieldBus`.

Unreal Engine é **review/preview only**. Pixel Streaming nunca arma,
nunca dispara, nunca muta workMode.

```text
┌────────────── Unreal (Review) ──────────────┐    ┌──── FXKONTROL Web (Comando) ────┐
│ PCG · MovieRenderPipeline · PixelStreaming  │    │ uiCommandGateway · CommandBus    │
│ DMX preview (U1-7) · SunPosition · Datasmith│    │ SafetyStateMachine · FieldBus    │
│ AllowPixelStreamingCommands=0               │    │ MultiTransportLink (real HW)     │
└─────────────────────────────────────────────┘    └──────────────────────────────────┘
                          ▲                                    │
                          │ Datasmith / DMX preview (read-only)│
                          └────────────────────────────────────┘
```

## Convenção DMX (universos reservados)

| Universo | Uso | Owner |
|---|---|---|
| 1–5 | Fixtures (lights, fog, video) | exporter padrão |
| 6 | Drone LED / pixel preview | exporter VVIZ U6 |
| 7 | Pyro / SFX preview | exporter pyro U7 |

`BP_SwarmManager` consome o stream VVIZ direto do exporter web (read-only).

## Plugins UE 5.7 habilitados

PCG, PCGGeometryScriptInterop, PixelStreaming (review-only),
MovieRenderPipeline, RemoteControl, SunPosition, Datasmith, PythonScript.
Cesium ainda **pendente** (instalar via Fab).

## Layout `/Game/FXKONTROL/Tech/`

```text
PCG/        — venues procedurais, safety volumes
Materials/  — materiais base FXK
PixelStreaming/  — assets de stream/review
DMX/        — patches de preview U1-7
Geo/        — terrenos, mapas Cesium (futuro)
```

## Toolkit local (não vive neste repo)

Scripts em `tools/`:
- `check_fxkontrol_tech.py` — valida plugins + folder structure
- `create_fxkontrol_tech_assets.py` — cria pastas e importa texturas
- `run_pixel_streaming_preview.ps1` — sobe signalling + UE em stream

Distribuído como `fxkontrol-unreal-tech.zip` (artifact, não commit aqui).

## Proibições

- ❌ Pixel Streaming **nunca** envia ARM/FIRE/E_STOP
- ❌ UE Python **nunca** muta ShowPlan canônico
- ❌ DMX U6/U7 do UE **nunca** sai do laptop de review (preview LAN only)
- ❌ Operadores **nunca** comandam show de dentro do UE

## Permitido

- ✅ Importar Datasmith do venue para PCG
- ✅ Render approval (.mp4 via MovieRenderPipeline) para cliente
- ✅ Preview WYSIWYG no PixelStreaming (cliente em iPad/laptop)
- ✅ Receber DMX U1-7 do exporter web em modo `listen-only`

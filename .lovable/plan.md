

# Refatorar artnet-bridge em Módulos por Action

## Contexto

Edge Functions do Supabase exigem que todo código da função fique em `index.ts` (sem subpastas). Porém, módulos compartilhados em `supabase/functions/_shared/` são permitidos. A refatoração extrai tipos, validação, packet builders e handlers para `_shared/artnet/`, deixando `index.ts` como um router fino.

## Arquivos a Criar

### 1. `supabase/functions/_shared/artnet/types.ts`
- `DMXUniverseData`, `ArtNetRequest` interfaces
- Constantes: `ARTNET_HEADER`, `ARTNET_OPCODE_DMX`, `ARTNET_PROTOCOL_VERSION`

### 2. `supabase/functions/_shared/artnet/validation.ts`
- `validateUniverse(data)` — validação de ranges e channels
- `requireUniverses(universes)` — guard que retorna `Response | null`

### 3. `supabase/functions/_shared/artnet/packets.ts`
- `buildArtDmxPacket(data)` — constrói ArtDmx binary
- `buildArtPollPacket()` — 14-byte ArtPoll
- `buildArtSyncPacket()` — 14-byte ArtSync
- `buildArtRdmPacket(opts)` — ArtRdm com payload
- Helper `toBase64(packet)` compartilhado

### 4. `supabase/functions/_shared/artnet/handlers.ts`
- `handleValidate(universes)` — retorna Response
- `handlePoll(targetIp, targetPort)` — retorna Response
- `handleSync()` — retorna Response
- `handleRdm(body)` — retorna Response
- `handleExportBinary(universes, targetIp, targetPort)` — retorna Response
- `handleSend(universes, targetIp, targetPort)` — retorna Response

Cada handler é uma função pura `(...args) => Response`.

## Arquivo a Modificar

### 5. `supabase/functions/artnet-bridge/index.ts`
Reduzido a ~30 linhas: CORS preflight + JSON parse + switch/dispatch para o handler correto + catch genérico. Zero lógica de negócio.

```text
serve → handleCors → parse body → switch(action) {
  'validate' → handleValidate(universes)
  'poll'     → handlePoll(targetIp, targetPort)
  'sync'     → handleSync()
  'rdm'      → handleRdm(body)
  'export-binary' → handleExportBinary(universes, ...)
  'send'     → handleSend(universes, ...)
  default    → jsonError('Unknown action')
}
```

## Detalhes

- Comportamento funcional 100% idêntico ao atual — refactoring puro
- `jsonOk` e `jsonError` de `_shared/response.ts` reutilizados nos handlers
- Constante `ARTNET_HEADER` instanciada uma vez em `types.ts`, importada onde necessário
- Cast `as any` no handler RDM eliminado com tipagem explícita


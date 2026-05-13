## Adicionar uploads aos paths canônicos (rodada consolidada v3)

Mesmo padrão das rodadas anteriores: copiar uploads aos paths canônicos sem editar nada existente. Nenhum dos novos arquivos é referenciado pelo código vivo, e nem `scripts/` nem `src/seo/` existem ainda — adição limpa.

### Esta rodada — 7 novos arquivos

| Upload | Destino |
|---|---|
| `audit-landing-seo.ts` | `scripts/audit-landing-seo.ts` |
| `bridge-cert.windows.ps1` | `scripts/bridge-cert.windows.ps1` |
| `build-windows-offline-installer.ps1` | `scripts/build-windows-offline-installer.ps1` |
| `prepare-ios-native.ps1` | `scripts/prepare-ios-native.ps1` |
| `local-bridge.mjs` | `scripts/local-bridge.mjs` |
| `vite-plugin-bundle-budget.ts` | `scripts/vite-plugin-bundle-budget.ts` |
| `vite-plugin-precache-guard.ts` | `scripts/vite-plugin-precache-guard.ts` |
| `vite-plugin-sitemap.ts` | `scripts/vite-plugin-sitemap.ts` |

### Acumulado das rodadas anteriores (também a copiar)

Frontend: `src/dev/fxk16AsciiEmulator.ts`, `src/dev/__tests__/fxk16AsciiEmulator.test.ts`, `src/config/fxkProduct.ts`, `src/config/landing.ts`, `src/config/landing.test.ts`.

Firmware: `firmware/fxk32q-esp32s3/{platformio.ini, README.md, src/main.ino, src/fxk32q_config.h, src/fxk32q_pinmap.h, src/fxk32q_protocol.{h,cpp}, src/fxk32q_relay.{h,cpp}, src/fxk32q_rs485.{h,cpp}}`.

### Pendências observadas (NÃO bloqueiam esta rodada)

Os scripts/plugins novos referenciam dependências e arquivos que **não existem no repo hoje**. Eles são adicionados como **standalone** (não plugados em `vite.config.ts` nem `package.json`):

1. `audit-landing-seo.ts` precisa `jsdom` + um React tree montável de `<Landing/>`. Roda fora do build padrão.
2. `local-bridge.mjs` precisa `ws` e os certs em `.certs/bridge/` (gerados pelo `bridge-cert.windows.ps1`). Os scripts npm `bridge:local` / `bridge:cert:windows` referenciados ainda não existem em `package.json`.
3. `vite-plugin-sitemap.ts` precisa `src/seo/publicRoutes.mjs` (não existe) com `PUBLIC_ROUTES`, `SITE_ORIGIN`, `buildSitemapXml`. Sem ele o plugin é no-op silencioso (warn-only no caso atual).
4. `vite-plugin-bundle-budget.ts` e `vite-plugin-precache-guard.ts` só rodam se forem importados em `vite.config.ts` — vou deixar ambos disponíveis mas **não plugar**.
5. Firmware FXK32Q ainda falta `fxk32q_artnet.{h,cpp}` (referenciado por `main.ino`).

Vou criar `scripts/_PENDING.md` listando essas dependências para próxima rodada explícita do usuário.

### Não muda

- Zero edição em `vite.config.ts`, `package.json`, `App.tsx`, rotas, sidebar, Supabase.
- Sem instalar `jsdom`, `ws`, `tsx` ou outras deps mencionadas pelos scripts.
- Sem mudança em safety/workMode/CommandBus/uiCommandGateway.
- Pluggar bundle-budget / precache-guard / sitemap em `vite.config.ts` fica para rodada futura explícita (envolve risco de quebrar build atual e exige ajustar `globPatterns` PWA).

### Verificação pós-implementação

1. `bun vitest run src/dev/__tests__/fxk16AsciiEmulator.test.ts src/config/landing.test.ts` → verde.
2. Build do app não deve quebrar (nenhum dos novos arquivos é importado pelo código vivo).
3. `scripts/_PENDING.md` documenta as 5 dependências pendentes com instruções concisas pra próxima rodada.

### Memória

Adicionar entradas curtas ao `mem://index.md`:
- `mem://hardware/fxk32q-firmware-tree`
- `mem://funcionalidades/fxk16-ascii-emulator-bench`
- `mem://infra/scripts-tree-standalone` — `scripts/` contém SEO audit, bundle-budget, precache-guard, sitemap-generator, local-bridge HTTPS+WS, certs Windows, iOS native prep, Windows offline installer; **standalone**, não plugados em vite.config nem package.json até decisão explícita.

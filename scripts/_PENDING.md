# scripts/ — pendências (standalone, NÃO plugados)

Arquivos nesta pasta foram adicionados aos paths canônicos mas **não estão integrados** ao build/runtime atual. Para ativá-los numa próxima rodada explícita, resolver as dependências abaixo.

## 1. `audit-landing-seo.ts`
- Precisa: `bun add -d jsdom @types/jsdom tsx`
- Precisa: `<Landing/>` montável fora do React-DOM real (ou snapshot SSR).
- Sem npm script. Sugerido: `"audit:seo": "tsx scripts/audit-landing-seo.ts"`.

## 2. `local-bridge.mjs`
- Precisa: `bun add -d ws`
- Precisa: certs em `.certs/bridge/{key.pem,cert.pem}` — gerados por `bridge-cert.windows.ps1` (Windows) ou equivalente em `mkcert`/`openssl`.
- Sem npm script. Sugerido: `"bridge:local": "node scripts/local-bridge.mjs"`, `"bridge:cert:windows": "powershell -ExecutionPolicy Bypass -File scripts/bridge-cert.windows.ps1"`.

## 3. `vite-plugin-sitemap.ts`
- Precisa: `src/seo/publicRoutes.mjs` exportando `PUBLIC_ROUTES: string[]`, `SITE_ORIGIN: string`, `buildSitemapXml(routes, origin): string`.
- Sem essa fonte, plugin é warn-only no-op.
- Plugar em `vite.config.ts` só após criar a fonte canônica de rotas públicas (decidir: `/`, `/pricing`, `/comercial`, `/pitch/us`, `/unsubscribe`).

## 4. `vite-plugin-bundle-budget.ts` e `vite-plugin-precache-guard.ts`
- Disponíveis em `scripts/`, **não importados** em `vite.config.ts`.
- Antes de plugar: revisar `globPatterns` PWA atual (`**/*.{js,css,html,ico,png,svg,woff2}`) e `maximumFileSizeToCacheInBytes: 3MB` para garantir compatibilidade com os limites do precache-guard.
- Ativar com PR dedicado + medição antes/depois de bundle size.

## 5. `prepare-ios-native.ps1` e `build-windows-offline-installer.ps1`
- Standalone, requerem ambiente Windows + Capacitor CLI (iOS prep) / NSIS ou similar (offline installer).
- Sem npm script. Rodar manualmente no host adequado.

## Firmware FXK32Q
Em `firmware/fxk32q-esp32s3/src/main.ino` há `#include "fxk32q_artnet.h"` — arquivos `fxk32q_artnet.{h,cpp}` **não foram enviados** ainda. Build PlatformIO falhará até chegarem.

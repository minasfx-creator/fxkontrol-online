

## Plano: Eliminar Redundância de UI + Reduzir Brilho dos Fogos

### 1. MobileHUD — Remover controles duplicados
**Arquivo**: `src/components/editor/MobileHUD.tsx`

Remover do HUD:
- Botão **Menu** (linhas 147-152) — duplicado com MobileTabBar
- Botão **MoreHorizontal** (linhas 139-144) e toda a **secondary row expandível** (linhas 157-193) — GPS, Night Mode e LIVE mode migram para painel Settings/TabBar
- Remover imports não utilizados (`Menu`, `MoreHorizontal`, `MapPin`, `Moon`, `Sun`, `ShieldAlert`, `useState` para `showExtra`, `useDisplayStore`, `useShowSettings`, `gpsOrigin`, `nightMode`)

HUD final terá apenas: **Timecode pill** | **Play/Pause + Stop** | **PANIC** (
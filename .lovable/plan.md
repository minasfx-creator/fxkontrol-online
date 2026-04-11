

# Ciclo #79 — Mobile UX: Menus, Welcome Screen e Geolocalização

## Problemas Identificados

1. **Sem tela de boas-vindas no mobile** — O app entra direto no editor 3D genérico. O usuário não tem opção de escolher localização ao abrir. O `appPhase` começa em `'editor'` e pula cinematic/splash.

2. **MobileHUD conflita com MobileQuickActions** — O HUD (fixed top, z-50) e o DraggableFloatingPanel dos quick actions (initialY ~40% da tela) se sobrepõem em telas pequenas (375-414px de largura). Ambos são `pointer-events-auto` e competem pelo toque.

3. **MobileTabBar muito alto em portrait** — O FAB central com `-translate-y-3` (w-14 h-14) + nav bar + category dots = ~90px de espaço inferior, comendo muito do viewport 3D em portrait (688px).

4. **GeoLocationSetup não acessível no mobile** — O componente usa `absolute top-16 left-1/2 w-[380px]` e não aparece no fluxo mobile. Não existe botão no MobileHUD ou MobileTabBar para abrí-lo.

5. **Sem "Usar minha localização"** — O GeoLocationSetup lista cidades preset e busca Google Places, mas não oferece opção de geolocalização do dispositivo via `navigator.geolocation`.

## Plano de Implementação

### 1. Criar `MobileWelcomeScreen.tsx` — Tela inicial mobile
- Exibida quando `appPhase === 'editor'` e `isMobile` e `!hasInitialLocation` (novo flag no store ou localStorage)
- Três opções:
  - **"Mundo Genérico"** — Inicia no grid isométrico padrão
  - **"Minha Localização"** — Usa `navigator.geolocation.getCurrentPosition()` para obter lat/lng do device
  - **"Escolher Local"** — Abre o GeoLocationSetup adaptado para mobile
- Design: fullscreen overlay com glassmorphism, ícones grandes (Globe, Navigation, MapPin), targets 48px+
- Salva escolha em `localStorage('fxk-mobile-location-set')` para não reaparecer

### 2. Adaptar `GeoLocationSetup.tsx` para mobile
- Quando `isMobile`: usar `fixed inset-0 z-50` fullscreen bottom sheet em vez de `absolute top-16 w-[380px]`
- Adicionar botão **"📍 Usar Minha Localização"** no topo da lista, antes das cidades preset
- Implementar `navigator.geolocation.getCurrentPosition` com fallback e loading state

### 3. Fix MobileHUD vs MobileQuickActions conflito
- Mover MobileQuickActions para a **direita inferior** (acima do MobileTabBar) em vez de `initialY: 40%` esquerda
- Reduzir para layout horizontal compacto quando perto do HUD
- Adicionar `paddingTop` dinâmico que considera a altura do MobileHUD

### 4. Compactar MobileTabBar em portrait
- Reduzir FAB de `w-14 h-14` para `w-11 h-11` e `-translate-y-1.5`
- Esconder category dots por padrão (mostrar apenas com swipe hint)
- Reduzir `min-h-[48px]` dos tabs para `min-h-[42px]`
- Total: economia de ~20px verticais

### 5. Adicionar botão de localização no MobileHUD
- Ícone `MapPin` no grupo direito do HUD
- Ao tocar: abre `GeoLocationSetup` (mobile-adapted)

## Arquivos

| Ação | Arquivo |
|--------|------|
| Create | `src/components/editor/MobileWelcomeScreen.tsx` |
| Edit | `src/components/editor/GeoLocationSetup.tsx` |
| Edit | `src/components/editor/MobileHUD.tsx` |
| Edit | `src/components/editor/MobileQuickActions.tsx` |
| Edit | `src/components/editor/MobileTabBar.tsx` |
| Edit | `src/pages/Index.tsx` |

## Ordem de Execução
1. Criar MobileWelcomeScreen com 3 opções de localização
2. Adaptar GeoLocationSetup para mobile fullscreen + botão "Minha Localização"
3. Integrar welcome screen no Index.tsx (mobile flow)
4. Fix conflitos de menu (QuickActions posição + TabBar compactação + HUD botão geo)
5. Build verification


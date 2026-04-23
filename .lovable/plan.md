
Objetivo: adicionar suporte robusto a bridge local seguro para iPhone/PWA, com diagnóstico de secure context, mDNS/pairing e alertas explícitos de mixed content antes da conexão falhar silenciosamente.

1. Consolidar a camada de diagnóstico do bridge local
- Expandir `src/lib/bridgeGateway.ts` para expor um diagnóstico completo do ambiente, além do `getBridgeCapabilityHints()` já existente.
- Incluir sinais como:
  - `isSecureContext`
  - `pageProtocol`
  - `bridgeProtocol`
  - `mixedContentBlocked`
  - `iosWebKit`
  - `standalonePwa`
  - `mdnsHost`
  - `usesSelfSignedLocalTls`
  - `recommendedAction`
- Adicionar helpers para:
  - validar se uma URL do relay é segura no contexto atual
  - identificar hosts `.local`
  - distinguir fallback inseguro (`ws://localhost`, `ws://192.168.x.x`) de endpoint compatível com iPhone/PWA (`wss://*.local` ou host customizado seguro)

2. Formalizar a estratégia HTTPS local + self-signed
- Manter o padrão já sugerido no código:
  - host default seguro: `fxk-relay.local`
  - porta segura: `9443`
  - fallback inseguro apenas em desktop/local dev
- Ajustar os builders para privilegiar `wss://fxk-relay.local:9443` em:
  - páginas HTTPS
  - contexto installable/PWA
  - iPhone/iPad WebKit
- Persistir configuração do gateway com `saveBridgeGatewayConfig()` quando o usuário informar host/porta/canal local.
- Preparar a UI para orientar o usuário a instalar/confiar no certificado self-signed do bridge local quando necessário, sem fingir que o navegador aceitará isso automaticamente.

3. Adicionar verificação ativa de secure context e mixed content
- Criar um util/hook compartilhado, por exemplo:
  - `src/hooks/useBridgeSecurityDiagnostics.ts`
  ou
  - `src/lib/bridgeSecurityDiagnostics.ts`
- Esse diagnóstico deve:
  - ler `window.isSecureContext`
  - calcular o endpoint efetivo do relay
  - detectar se o browser bloqueará `ws://` em página `https://`
  - classificar severidade: `info | warning | error`
- Quando houver risco real, retornar mensagens prontas para UI, por exemplo:
  - “Página segura detectada, mas o relay local está em ws://. O navegador bloqueará mixed content.”
  - “No iPhone/PWA, o bridge local precisa responder em WSS com certificado confiável.”
  - “Host .local detectado, mas o contexto ainda não é seguro.”

4. Exibir alertas visuais nas superfícies onde o bridge é usado
- Integrar o diagnóstico em telas/painéis já existentes que hoje apenas tentam abrir WebSocket:
  - `src/pages/DevicePairing.tsx`
  - `src/components/editor/MobileLinkPanel.tsx`
  - `src/components/editor/LiveFiringPanel.tsx`
  - `src/components/editor/dmx/DMXPanel.tsx`
  - `src/components/editor/live-firing/SettingsPanel.tsx`
- Adicionar banners/alerts usando o sistema atual (`Alert`/`sonner`) para:
  - mixed content bloqueado
  - contexto inseguro
  - bridge em fallback incompatível com iPhone/PWA
  - mDNS/host local detectado, mas sem TLS
- Preferir banner persistente para problemas estruturais e toast apenas para feedback pontual de conexão.

5. Melhorar a experiência de pairing para iPhone
- Evoluir `DevicePairing` para mostrar um fluxo claro de “pareamento local”:
  - endpoint atual do bridge
  - status do secure context
  - compatibilidade iPhone/PWA
  - status do certificado local
- Acrescentar orientação funcional no UI:
  - abrir o bridge via `https://fxk-relay.local:9443`
  - confiar no certificado self-signed
  - voltar ao app e testar o canal local
- Se NFC/Web NFC não estiver disponível no iPhone, manter o fluxo honesto e apresentar o bridge local seguro como alternativa principal.

6. Tornar a autodiscovery mDNS explícita e auditável
- Aproveitar os hosts `.local` já usados em `fireoneModuleHardwareBridge.ts` e `fireoneWifiDirectTransport.ts`.
- Exibir na UI:
  - host descoberto (`fxk-relay.local`, `fxk-esp32.local`, etc.)
  - modo de transporte (`ws` vs `wss`)
  - se o host é adequado para PWA/iPhone
- Quando o app cair para IP fixo (`192.168.x.x`), marcar isso como fallback degradado em vez de comportamento “normal”.

7. Endurecer os pontos de conexão WebSocket
- Antes de abrir `new WebSocket(...)`, aplicar uma checagem comum:
  - se mixed content for inevitável, abortar antes
  - emitir erro legível
  - evitar tentativas cegas que só acabam em `onerror`
- Isso deve ser aplicado em:
  - `MobileLinkPanel`
  - `LiveFiringPanel`
  - `DMXPanel`
  - transports que usam `buildBridgeWebSocketUrl()` como `WiFiTransport` e `WiFiDirectTransport`
- Resultado esperado: falha previsível, com diagnóstico útil, em vez de falha silenciosa.

8. Expandir Platform Status para saúde de bridge local
- Estender `src/pages/PlatformStatus.tsx` com uma seção nova de “Local bridge security”.
- Exibir:
  - secure context: OK/BLOCKED
  - endpoint atual do relay
  - mixed content risk
  - compatibilidade PWA/iPhone
  - mDNS/local discovery readiness
- Isso transforma o status page em painel operacional para validar o ambiente antes de uso em campo.

9. Cobrir com testes unitários
- Expandir `src/lib/__tests__/bridgeGateway.test.ts` para validar:
  - HTTPS + iPhone => `wss://fxk-relay.local:9443`
  - HTTPS + relay inseguro => mixed content detectado
  - desktop `http://localhost` => fallback permitido
  - host `.local` classificado como bridge local
  - bridge key segue fora da URL
- Adicionar testes para o novo diagnóstico/hook com cenários:
  - secure context válido
  - contexto inseguro
  - iPhone standalone
  - mixed content bloqueado
  - fallback IP-only degradado

10. Resultado funcional esperado
- Desktop dev continua funcionando com fallback local inseguro quando apropriado.
- iPhone/PWA passa a receber rota segura preferencial (`wss://fxk-relay.local:9443`).
- O usuário vê alertas claros quando algum recurso local seria carregado como mixed content.
- O app deixa de “tentar e falhar” sem contexto e passa a explicar exatamente o que falta: secure context, certificado local, host mDNS ou endpoint compatível.

Detalhes técnicos
- Arquivos mais prováveis:
  - `src/lib/bridgeGateway.ts`
  - `src/lib/__tests__/bridgeGateway.test.ts`
  - novo hook/util de diagnóstico de segurança
  - `src/pages/DevicePairing.tsx`
  - `src/components/editor/MobileLinkPanel.tsx`
  - `src/components/editor/LiveFiringPanel.tsx`
  - `src/components/editor/dmx/DMXPanel.tsx`
  - `src/components/editor/live-firing/SettingsPanel.tsx`
  - `src/pages/PlatformStatus.tsx`
- Abordagem de UX:
  - alert persistente para bloqueios estruturais
  - toast apenas para sucesso/falha transitória
- Restrições reais do navegador:
  - página HTTPS + `ws://` = mixed content bloqueado
  - iPhone/PWA exige secure context para fluxo confiável
  - certificado self-signed precisa ser confiado no dispositivo; o app só consegue detectar e orientar, não instalar confiança sozinho

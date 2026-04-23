# FX KONTROL — Go-Live Checklist (Hardware Real + iPhone)

> Objetivo: reduzir risco operacional antes do lançamento, validando conectividade real, fallback, observabilidade e rollback.

## 1) Gate de Release (obrigatório)

- [ ] Ambiente de produção com HTTPS ativo e certificado válido.
- [ ] Build de produção gerada e validada sem erros críticos.
- [ ] Versão/tag registrada (app web + bridge firmware + edge functions).
- [ ] Plano de rollback aprovado (quem executa, quando, como validar reversão).
- [ ] Janela de lançamento definida com responsáveis on-call.

## 2) Matriz de Compatibilidade (bloqueador)

Validar cada cenário com evidência (print/log):

- [ ] **Desktop Chrome (Windows/macOS)**: BLE, USB/WebSerial, WebSocket, Wi-Fi Direct (quando aplicável).
- [ ] **Android Chrome**: BLE + WebSocket + (USB OTG se suportado).
- [ ] **iPhone Safari (web)**: validar somente transportes suportados no Safari; confirmar mensagens de indisponibilidade corretas.
- [ ] **iOS app nativo (Capacitor)**: validar fluxo equivalente ao Safari com plugins nativos habilitados.

## 3) Conectividade Real com Hardware (bloqueador)

Para cada transporte utilizado no lançamento:

- [ ] Conectar e desconectar 10x consecutivas sem travamento de UI.
- [ ] Confirmar leitura de telemetria (`BAT`, `RSSI`, `FW`) após conexão.
- [ ] Enviar comando de `HEARTBEAT` por 5 minutos sem timeout indevido.
- [ ] Executar `FIRE` em ambiente de bancada segura (dummy load), confirmar ACK.
- [ ] Testar `ESTOP` e garantir resposta imediata + lockout visual.
- [ ] Simular queda de link para validar reconexão automática.

## 4) iPhone Readiness (crítico)

- [ ] Em Safari, botões de transportes não suportados ficam desabilitados.
- [ ] Mensagens orientativas para iOS aparecem corretamente.
- [ ] Em HTTPS, endpoints WebSocket usam `wss://` quando necessário.
- [ ] Último erro de conexão (`lastError`) é exibido quando conexão falha.
- [ ] Sem toast duplicado/falso de "desconectado" durante tentativas sem sessão ativa.

## 5) Fallback e Degradação Controlada

- [ ] Definir transporte primário e secundário por cenário de campo.
- [ ] Validar troca manual de transporte sem recarregar a página.
- [ ] Confirmar funcionamento mínimo em modo simulação quando hardware indisponível.
- [ ] Verificar mensagens de fallback claras para operação (sem termos ambíguos).

## 6) Observabilidade e Diagnóstico

- [ ] Capturar logs de conexão (evento, transporte, timestamp, erro).
- [ ] Capturar métricas mínimas: taxa de sucesso de conexão, latência média de ACK, timeout de heartbeat.
- [ ] Garantir que erros críticos tenham contexto suficiente para suporte (URL/transport/reason).
- [ ] Definir dashboard/consulta rápida para incidents durante o lançamento.

## 7) Segurança Operacional

- [ ] Confirmar que comandos críticos só executam com estado armado e pré-condições válidas.
- [ ] Revisar permissões de rede/local bridge e CORS para produção.
- [ ] Validar que chaves/tokens não estão expostas no cliente.
- [ ] Rodar drill de "abort mission": operação completa de parada segura.

## 8) Smoke Test de Campo (pré-show)

Executar 30–60 min antes da operação real:

- [ ] Abrir projeto oficial do evento e carregar timeline completa.
- [ ] Conectar hardware real no transporte planejado primário.
- [ ] Confirmar status em tempo real por 10 min (sem perda de heartbeat).
- [ ] Disparar sequência curta de teste (com segurança física adequada).
- [ ] Simular perda do link e recuperar via fallback.
- [ ] Registrar ata rápida: aprovado/reprovado + pendências.

## 9) Critério de Go / No-Go

### GO
- Todos os itens bloqueadores concluídos.
- Nenhum bug crítico aberto em conectividade/comando.
- Operação e engenharia de acordo com evidências registradas.

### NO-GO
- Falha em `ESTOP`, heartbeat instável, ou conectividade sem fallback confiável.
- Comportamento inconsistente no iPhone para cenário alvo de lançamento.
- Ausência de rollback testado.

## 10) Runbook de Rollback (resumo)

- [ ] Passo 1: congelar novos comandos operacionais.
- [ ] Passo 2: reverter para versão estável anterior (web + bridge + edge).
- [ ] Passo 3: validar conectividade mínima e `ESTOP`.
- [ ] Passo 4: comunicar status oficial para operação.

---

### Evidências recomendadas

- Screenshot de cada cenário de compatibilidade.
- Logs de conexão/reconexão com timestamp.
- Vídeo curto do teste de fallback.
- Checklist assinado por Engenharia + Operação.

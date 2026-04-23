
Objetivo: estabilizar a plataforma para publicação corrigindo o build quebrado, os erros de tipagem nas funções de backend, os alertas de segurança no banco e adicionando uma página de status operacional.

1. Corrigir o build do frontend
- Adicionar a dependência ausente `postprocessing`, que já é importada em `src/components/editor/PostProcessing.tsx` e em `src/render_ultra/postprocessing/*.ts`, mas não existe em `package.json`.
- Revalidar os imports e tipos usados pelos efeitos customizados (`Effect`, `Uniform`, `ToneMappingMode`, `BlendFunction`, `KernelSize`) em:
  - `src/components/editor/PostProcessing.tsx`
  - `src/render_ultra/postprocessing/acesHuePreserve.ts`
  - `src/render_ultra/postprocessing/atmosphericDepth.ts`
  - `src/render_ultra/postprocessing/halation.ts`
  - `src/render_ultra/postprocessing/highlightDesaturation.ts`
  - `src/render_ultra/postprocessing/luminanceFilmGrain.ts`
- Ajustar qualquer incompatibilidade residual entre a API real da lib e os wrappers customizados, mantendo o pipeline atual do Studio Mode.

2. Resolver a tipagem compartilhada das edge functions
- Corrigir `supabase/functions/_shared/auth.ts`, onde `ReturnType<typeof createClient>` está inferindo um tipo incompatível.
- Como `requireAuth()` não tem consumidores atuais, aplicar a menor correção segura:
  - ou tipar explicitamente o cliente com um tipo compatível do SDK;
  - ou simplificar o contrato retornado para remover o `client` se ele não for necessário.
- Revisar os exports em `supabase/functions/_shared/mod.ts` para manter consistência do helper compartilhado.
- Rodar checagem das funções afetadas pelo erro em cascata para garantir que o problema central foi removido:
  - `artnet-bridge`
  - `fxk-ai-chat`
  - `generate-formation`
  - `get-maps-key`
  - `google-geo-intelligence`
  - `google-places-search`
  - `mavlink-bridge`
  - `parse-test-report`
  - `satellite-tile`
  - `timecode-bridge`
  - `validate-accreditation`
  - `video-choreo-ai`
  - `warehouse-download`

3. Fechar os alertas de segurança do banco
- Criar uma migration para tratar a tabela `bridge_pair_attempts`, que está com RLS habilitado e sem políticas.
- Como essa tabela não possui uso no frontend hoje, aplicar política restritiva em vez de abrir acesso amplo:
  - permitir apenas acesso controlado pelo backend/service role, ou
  - bloquear explicitamente acesso de usuários autenticados se a tabela for apenas operacional.
- Investigar o alerta da extensão instalada no schema `public` e corrigir via migration:
  - mover para schema dedicado de extensões, se suportado;
  - ou recriar/remover a extensão de forma segura no local correto.
- Reexecutar o linter do backend até zerar esses alertas.

4. Adicionar uma página de status da plataforma
- Criar uma nova página protegida, por exemplo `src/pages/PlatformStatus.tsx`.
- Expor status objetivo em blocos claros:
  - Backend/authentication
  - Build readiness
  - Edge functions
  - Database security
  - Operational telemetry
- Reaproveitar a base já existente:
  - `src/hooks/useHealthHistory.ts`
  - `src/core/cluster/HealthPersistenceService.ts`
  - `src/components/editor/cluster/ClusterHealthTab.tsx`
  - `src/components/editor/ExecutiveReportConsole.tsx`
- Mostrar métricas reais já persistidas quando disponíveis:
  - últimos `health_snapshots`
  - incidentes em `health_incidents`
  - relatórios em `executive_reports`
  - eventualmente contagens por projeto/usuário para diagnóstico
- Marcar claramente estados como:
  - Healthy
  - Degraded
  - Blocked for publish
- Se o build não puder ser conhecido em runtime, expor “build readiness” como diagnóstico de ambiente/configuração com base no estado conhecido do app, e deixar o texto preparado para futura integração com checks automatizados.

5. Integrar a nova página na navegação
- Adicionar a rota em `src/App.tsx`.
- Incluir entrada de navegação no layout/sidebar seguindo o padrão visual existente.
- Garantir responsividade mobile, já que o viewport atual é compacto.

6. Validação final
- Confirmar que o projeto compila sem os erros atuais.
- Confirmar que as edge functions passam na checagem de tipos.
- Confirmar que o linter de segurança não aponta mais:
  - tabela com RLS sem políticas
  - extensão no schema `public`
- Confirmar que a nova página de status carrega com usuário autenticado e mostra dados reais ou estados vazios explícitos.

Detalhes técnicos
- A falha principal do frontend hoje vem da ausência da dependência `postprocessing`; isso tende a resolver tanto o “Cannot find module” quanto a maior parte dos erros de `uniforms`.
- O erro central das edge functions está concentrado em `supabase/functions/_shared/auth.ts`; corrigindo esse contrato compartilhado, a cascata de arquivos marcados deve desaparecer.
- A tabela com problema de RLS identificada no schema atual é `bridge_pair_attempts`.
- A nova página de status deve reutilizar a telemetria já existente, não duplicar lógica paralela.
- Não vou alterar `src/integrations/supabase/client.ts`, porque esse arquivo é gerado automaticamente.

Resultado esperado
- Build restaurado
- Funções de backend tipadas corretamente
- Alertas de segurança resolvidos
- Página de status disponível no app com diagnóstico operacional claro

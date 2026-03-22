

# Sistema de Clonagem de Módulos com Redundância

## Contexto
A persistência já está implementada (tabela `artnet_modules` + hook `useArtNetModulePersistence`). O foco é o **sistema de clonagem para redundância de disparos** — quando um módulo primário falha, o clone assume automaticamente.

## Conceito
Cada módulo pode ter um ou mais "clones" (backups). Ao disparar um canal, o sistema envia o comando ao primário e monitora resposta. Se o primário falhar (timeout/error), o clone dispara automaticamente. Opcionalmente, pode operar em modo "simultâneo" onde primário + clone disparam juntos para garantia total.

## Implementação

### 1. Schema — adicionar campo `clone_of` na tabela `artnet_modules`
```sql
ALTER TABLE public.artnet_modules 
  ADD COLUMN clone_of uuid REFERENCES public.artnet_modules(id) ON DELETE SET NULL,
  ADD COLUMN redundancy_mode text NOT NULL DEFAULT 'failover'; 
  -- 'failover' = clone só dispara se primário falhar
  -- 'simultaneous' = ambos disparam juntos
  -- 'manual' = operador escolhe qual usar
```

### 2. Serviço — `artnetModuleService.ts`
- Adicionar campo `cloneOf?: string` e `redundancyMode` ao `ArtNetModuleConfig`
- Novo método `cloneModule(moduleId)`: duplica config com novo ID, IP editável, seta `cloneOf`
- Modificar `fireChannel()`: se módulo tem clones em modo `simultaneous`, dispara em todos; se `failover`, tenta primário e faz fallback ao clone se falhar
- Novo método `getClones(moduleId)`: retorna módulos clone de um primário
- Novo método `getPrimary(moduleId)`: retorna o primário de um clone

### 3. Persistence hook — atualizar mapeamento
- Adicionar `clone_of` e `redundancy_mode` ao `configToDb`/`dbToConfig`

### 4. UI — `ArtNetModulePanel.tsx`
- Botão "CLONE" no `ModuleCard` (ícone Copy) que duplica o módulo com formulário para editar IP do clone
- Badge visual "PRIMARY" / "BACKUP" nos cards
- Indicador de redundância: linha conectando primário ↔ clone(s)
- Select de modo de redundância (Failover / Simultaneous / Manual)
- Clones indentados visualmente abaixo do primário na lista

### Arquivos
1. **Migration**: `ALTER TABLE artnet_modules ADD COLUMN clone_of, redundancy_mode`
2. **Editar**: `src/services/artnetModuleService.ts` — `cloneModule()`, `fireChannel()` com fallback
3. **Editar**: `src/hooks/useArtNetModulePersistence.ts` — mapear novos campos
4. **Editar**: `src/components/editor/live-firing/ArtNetModulePanel.tsx` — UI de clonagem + badges


## Plano — Refresh dos 9 ícones FWsim

O wiring já existe (`src/components/icons/EffectCategoryIcon.tsx` mapeia `cake`/`comet`/`flame` × `large/medium/small` → `Cake_0{1,2,3}.svg` / `Comet_0{1,2,3}.svg` / `FeuerProjektor_0{1,2,3}.svg`, todos em `src/assets/fwsim-effect-icons/`). Os 9 arquivos com esses nomes já existem no projeto — o upload é uma **atualização in-place** dos vetores.

### Passos

1. **Sobrescrever 9 SVGs** (overwrite=true) em `src/assets/fwsim-effect-icons/`:
   - `Cake_01.svg`, `Cake_02.svg`, `Cake_03.svg`
   - `Comet_01.svg`, `Comet_02.svg`, `Comet_03.svg`
   - `FeuerProjektor_01.svg`, `FeuerProjektor_02.svg`, `FeuerProjektor_03.svg`

2. **Não alterar** `EffectCategoryIcon.tsx`, mapping `familyFromEffect`, nem `EffectLibrary.tsx` — o contrato `tier: 'large'(_01) | 'medium'(_02) | 'small'(_03)` já casa com "detalhado / médio / outline".

3. **Sanity check** rápido: rodar a suite (esperado 1003/1003 verde — SVGs são assets, não tocam código).

### Fora de escopo
- Mine / Rocket / RomanCandle / Other / Shell / ShellOfShells (não foram re-uploadados, ficam como estão).
- Mudanças no LOD selector ou nos surfaces (cards/timeline/rows continuam usando o tier que já passam).
- Geração de novos componentes wrapper.

### Risco
Baixíssimo — só troca de bytes em 9 assets versionados. Se algum SVG novo tiver `viewBox` ou tamanho diferente do atual, ajuste de CSS pode ser necessário; verifico visualmente após overwrite.

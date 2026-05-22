## Plano — Refresh dos 8 ícones FWsim (Mine/Other/Rocket)

Mesma operação da rodada anterior. Os 8 nomes-alvo já existem em `src/assets/fwsim-effect-icons/` e estão wirados em `EffectCategoryIcon` (tier `large=_01` / `medium=_02` / `small=_03`).

### Passos

1. **Sobrescrever 8 SVGs** (overwrite=true) em `src/assets/fwsim-effect-icons/`:
   - `Mine_01.svg`, `Mine_02.svg`, `Mine_03.svg`
   - `Other_01.svg`, `Other_02.svg`, `Other_03.svg`
   - `Rocket_01.svg`, `Rocket_02.svg`
   - `Rocket_03.svg` **não foi uploadado** → fica como está.

2. **Não tocar** em `EffectCategoryIcon.tsx`, mapping de família, nem renderer (`mineSilhouettes.ts`/`MineEffect` continuam usando a geometria 5/7/9 jatos — SVG é só ícone de UI, não fonte de silhueta 3D).

### Fora de escopo
- Cake/Comet/FeuerProjektor (atualizados na rodada anterior).
- Shell/ShellOfShells/RomanCandle (não uploadados).
- Qualquer wiring novo, mudança de tier ou refator de componente.

### Risco
Baixíssimo — troca de bytes em 8 assets versionados; consumidores acessam pelos mesmos imports.

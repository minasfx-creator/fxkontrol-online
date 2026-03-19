

# Plano: Atualizar Logo MinasFX — Preto → Branco

## Situação Atual
- O projeto já tem `src/assets/minasfx-logo-white.png` disponível mas não utilizado
- Todos os 4 arquivos que usam a logo (`Auth.tsx`, `MainLayout.tsx`, `AppSidebar.tsx`, `Messenger.tsx`) importam `minasfx-logo.png` e aplicam filtros CSS (`brightness-0 invert`) para forçar branco
- O logo uploaded pelo usuário é a versão original com texto preto e detalhe vermelho

## Plano
1. **Copiar a imagem uploaded** como nova versão da logo (ou usar a `minasfx-logo-white.png` já existente)
2. **Atualizar os 4 arquivos** para importar a versão branca e remover os filtros CSS `brightness-0 invert`:
   - `src/pages/Auth.tsx`
   - `src/layouts/MainLayout.tsx`
   - `src/components/AppSidebar.tsx`
   - `src/components/Messenger.tsx`

## Detalhe Técnico
- Trocar `import minasfxLogo from '@/assets/minasfx-logo.png'` → `'@/assets/minasfx-logo-white.png'`
- Remover classes `brightness-0 invert` de todas as `<img>` tags da logo
- Manter `opacity-60` e outros estilos onde aplicável


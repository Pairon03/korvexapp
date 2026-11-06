# FitCore Korvex

SaaS de treinos para personal trainers com agente de IA e ciclos de 45 dias. Monorepo npm:
`packages/core` (regras de negócio, testes Vitest) e `apps/web` (React 18 + Vite 6 + Tailwind 4, HashRouter),
publicado na Vercel. Backend no Supabase (ver `docs/SUPABASE.md`).

Antes de abrir um PR: `npm run typecheck`, `npm test`, `npm run build` e `npm run build:artifact -w @korvex/web`.

## Skills do projeto
Usar: mobile-native (área do aluno no celular), break-ui (testar telas com dados extremos), security-review (fotos, RLS, LGPD), code-review (antes de cada merge)
Depois: animate-expo (app Expo), claude-api (troca do Gemini pelo Claude no lançamento), engineering:deploy-checklist (antes de usuários reais), marketing:email-sequence (etapa de e-mails)
Não usar: geradores de visual (frontend-design, design-taste-frontend, refero-design, 21st-ui), imagem/vídeo por IA, Hugging Face, Cloudinary
Regra: o visual segue o site da Korvex; dados e fotos ficam só no Supabase; nenhuma chave secreta no navegador; só alunos fictícios na fase de teste.

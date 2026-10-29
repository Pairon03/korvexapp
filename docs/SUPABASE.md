# Supabase do FitCore — etapa 1

O que esta etapa faz:

- Login do personal (criar conta, entrar, esqueci a senha) pelo Supabase Auth.
- Os dados de cada conta (alunos, treinos, ciclos, registros, avaliações) ficam salvos no Supabase,
  na tabela `fitcore_workspaces`, e só a própria conta acessa (RLS).
- A função `/api/ia` passa a exigir login, para a cota do Gemini não ficar aberta.
- Sem as variáveis do Supabase, o app continua funcionando só no navegador, como antes.

## Configuração (uma vez)

1. Em supabase.com, crie um projeto novo só para o FitCore (`fitcore-korvex`, região São Paulo).
   Não use o projeto do briefing da Korvex.
2. No **SQL Editor**, cole o conteúdo de `supabase/fitcore.sql` e clique em **Run**.
3. Em **Authentication → URL Configuration**:
   - Site URL: `https://fitcore-korvex.vercel.app`
   - Redirect URLs: `https://fitcore-korvex.vercel.app/**` e `https://*-cauas-projects-ad98b759.vercel.app/**`
4. Em **Project Settings → API** (ou **Data API**), copie a **Project URL** e a chave **anon / publishable**.
5. Na Vercel, projeto `fitcore-korvex` → **Settings → Environment Variables**, crie para todos os ambientes:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = chave anon / publishable
6. Faça um novo deploy (Deployments → ⋯ → Redeploy) para o site pegar as variáveis.

A chave anon é pública por definição. Nunca coloque a chave `service_role` / secret no site.

## Limites desta etapa

- O "Ver como aluno" ainda é uma simulação dentro da conta do personal; o aluno não tem login próprio.
- O agendador ainda roda quando o personal abre o app ou clica em "Executar agendador".
- Plano grátis do Supabase: até 500 MB de banco e pausa após 1 semana sem uso.

## Próximas etapas

2. Tabelas por entidade (alunos, planos, registros...) com login do aluno e RLS por personal.
3. Agendador no servidor (Vercel Cron) rodando os ciclos sem o app aberto.
4. Mercado Pago e e-mails.

# Korvex

Plataforma de treinamento personalizado com IA para personal trainers (modelo B2B2C).
O personal configura um **agente de IA** com a própria metodologia; a cada **ciclo de 45 dias** o
sistema reúne os registros do aluno e a reavaliação, pede uma proposta à IA, **valida com regras
determinísticas** e só publica a nova versão do treino quando todas as condições são atendidas.

> **Estado atual: protótipo navegável.** Toda a lógica de negócio é real e testada, mas roda no
> navegador com dados fictícios. Não há backend, autenticação, pagamento, e-mail ou IA externa
> conectados ainda. Veja [docs/ARQUITETURA.md](docs/ARQUITETURA.md) e o roteiro abaixo.

## O que dá para ver no protótipo

| Área | O que funciona |
|---|---|
| **Site** | Landing, como funciona, planos, FAQ, termos e privacidade (rascunhos), login de demonstração |
| **Personal** | Painel com indicadores calculados, alunos (busca, filtros, paginação, cadastro com validação, convite), ficha do aluno (treino, versões com comparação e restauração, avaliações com comparação e gráfico, execução, ciclo, dados/exportação/arquivamento), construtor de treino com validação ao vivo e volume por grupo muscular, agentes com versionamento, biblioteca de exercícios, assinatura e avisos |
| **Aluno** (mobile) | Treino do dia, execução com registro de carga/reps/RPE, timer de descanso, pular exercício, relato de desconforto, interromper e retomar, histórico, avaliação, consentimento de fotos, exportação e pedido de exclusão |
| **Admin** | Indicadores agregados, execuções de IA (tokens, tentativas, custo estimado), edição de planos, auditoria, simulação de falhas da IA |
| **Barra de demonstração** | Relógio do "servidor" (+1d, +7d, +45d), **Executar agendador**, simular IA inválida/indisponível, reiniciar dados |

### Roteiro sugerido (5 minutos)

1. Abra **Personal** e clique em **Executar agendador**. Cinco alunos fictícios chegam ao fim do ciclo:
   - **Ana** → publicado automaticamente (progressões de carga, variação de exercício);
   - **Bruno** → aguardando avaliação (sem reavaliação recente);
   - **Carla** → suspenso (relatou desconforto 6/10 no joelho);
   - **Diego** → dados incompletos (adesão de 16%);
   - **Elisa** → aguardando aprovação (aluna sem autorização de atualização automática).
2. Abra a **Elisa → Ciclo → Aprovar e publicar**, depois **Versões** para ver a comparação.
3. No perfil **Aluno**, entre como **Bruno**, registre uma avaliação e rode o agendador de novo:
   o ciclo prossegue **sem fotos**.
4. Em **IA: Simular indisponível**, avance +45d e rode o agendador: o treino vigente é mantido,
   com novas tentativas e encaminhamento após 3 falhas.
5. Entre como **Felipe** (convite pendente) no painel e gere o primeiro treino com IA.

## Rodando localmente

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # testes do motor (packages/core)
npm run typecheck
npm run build        # build estático em apps/web/dist
npm run build:artifact  # HTML único autocontido (apps/web/dist-artifact/korvex.html)
```

Requer Node 20+.

## Estrutura

```
packages/core   Domínio compartilhado (web, futuro app Expo e backend)
  src/types.ts          Modelo de dados
  src/cycles.ts         Motor de ciclos (agendador, idempotência, retries, bloqueios)
  src/validation.ts     Regras determinísticas de publicação
  src/ai/               Abstração do provedor, contexto mínimo, contrato (Zod), provedor local
  src/assessment.ts     Comparação de avaliações e protocolo JP3 + Siri
  src/seed.ts           Dados fictícios de demonstração
  test/                 Vitest
apps/web        Protótipo React + Vite + Tailwind (painel, app do aluno, site, admin)
docs/           Arquitetura, decisões e roteiro para produção
```

## Próximas etapas

Ver [docs/ARQUITETURA.md](docs/ARQUITETURA.md#roteiro-para-produção). Resumo: backend (Supabase +
API), autenticação real e RLS, agendador no servidor, IA real, Mercado Pago, e então o app nativo
com Expo reutilizando `packages/core`.

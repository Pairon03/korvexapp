# Arquitetura e decisões

## Princípios aplicados desde o protótipo

- **IA separada das regras.** O modelo só produz uma proposta JSON (`ProposalSchema`, Zod, `.strict()`).
  Quem valida, persiste e publica são funções determinísticas (`validatePlan`, `publishVersion`).
- **Nada é sobrescrito.** Versões de treino e de agente são imutáveis; restaurar cria uma nova versão.
- **Falha mantém o treino vigente.** Toda saída do motor de ciclos, exceto a publicação autorizada,
  deixa o treino atual intacto e registra o motivo.
- **Idempotência.** Um ciclo `em_processamento` ou com versão gerada não é reprocessado; rodar o
  agendador várias vezes no mesmo dia não cria versões duplicadas (coberto por teste).
- **Fotos nunca são obrigatórias** e não entram no contexto da IA.
- **Contexto mínimo.** `buildAgentContext` envia regras do agente, perfil sem nome/e-mail, estatísticas
  do ciclo, relatos de desconforto e resumo das avaliações. Texto livre vai delimitado como dado.
- **Datas.** Timestamps em UTC (ISO); datas de calendário calculadas no fuso da conta.
- **Dinheiro em centavos** com moeda explícita; planos e limites em dados, não no código.

## Motor de ciclos (`packages/core/src/cycles.ts`)

```
agendado → em_acompanhamento ──(vencimento)──► processCycle
   1. assinatura ativa/teste e limite mensal de IA      → senão: suspenso
   2. avaliação nos últimos 10 dias (se exigida)          → senão: aguardando_avaliacao (+ aviso ao aluno)
   3. ≥ 3 sessões e adesão ≥ mínimo do agente             → senão: dados_incompletos
   4. consistência de peso e relatos de dor ≥ limite       → senão: suspenso
   5. IA com retry (backoff + jitter) e 1 correção        → falha: falhou (3 tentativas → monitoramento)
   6. validação determinística                            → bloqueio: suspenso (proposta guardada)
   7. agente.autoPublish && aluno.autoUpdate && !revisão  → publicado + próximo ciclo
                                                          → senão: aguardando_validacao
```

Ações do personal: aprovar, revisar e gerar proposta (nunca publica sozinha), verificar de novo,
estender prazo (com motivo registrado), pausar/retomar, cancelar atualização.

## Validações (`validatePlan`)

Exercícios na biblioteca e ativos · equipamentos do aluno · conflito com limitações (regiões de
cuidado) · séries 1–8, reps 1–30, descanso na faixa do agente, RPE 5–10, 2–10 exercícios por dia ·
dias ≤ disponibilidade · volume semanal por grupo ≤ máximo (bloqueio) e ≥ mínimo (aviso) · variação
do volume total ≤ limite do agente · cardio dentro dos limites.

## Decisões do protótipo

| Decisão | Motivo |
|---|---|
| Vite + React SPA em vez de Next.js | Permite um HTML único compartilhável para validar o fluxo antes do backend. A lógica fica em `packages/core`, portável para Next.js/API. |
| Estado no `localStorage` | Sem servidor nesta fase. Cada ação roda sobre uma cópia e só é confirmada sem erro (equivalente a uma transação). |
| Provedor de IA local por regras (`DemoRulesProvider`) | Demonstra o contrato e as validações sem chave de API. O adaptador HTTP (`http-provider.ts`) existe, mas só pode rodar no servidor e não foi testado com credenciais. |
| Relógio simulado | Permite ver 45 dias em segundos. Em produção o relógio é o do servidor. |

## Roteiro para produção

1. **Backend**: Next.js (App Router) ou API dedicada + Supabase (Postgres, Auth, Storage privado).
   Migrações para as entidades de `types.ts` (users, tenants, tenant_members, students,
   student_consents, ai_agents/_versions, exercises, workout_plans/_versions, workout_days,
   workout_exercises, workout_logs/_sets, assessments, progress_photos, training_cycles, ai_runs,
   validation_results, notifications, payment_events, audit_logs, deletion_requests, feature_flags).
   RLS por tenant com testes de acesso cruzado.
2. **Agendador**: rota protegida chamada por cron (Supabase cron / Vercel Cron) executando
   `runScheduler` com lock por ciclo (`SELECT … FOR UPDATE SKIP LOCKED`).
3. **IA real**: `HttpModelProvider` no servidor, limites de tokens/custo por tenant, métricas.
4. **Pagamentos**: Mercado Pago assinaturas, webhook assinado e idempotente (`payment_events`),
   reconciliação diária.
5. **E-mail e notificações**: fila com retries; templates sem dados sensíveis.
6. **App nativo**: Expo + React Native reutilizando `@korvex/core` (tipos, labels, validação no cliente).
7. **Operação**: Sentry, logs estruturados com correlation id, backups e procedimento de rollback.

## Limitações conhecidas

- Sem autenticação, multi-tenant real, RLS, e-mail, pagamento ou upload de fotos.
- Dados só no navegador; limpar o armazenamento reinicia a demonstração.
- Biblioteca de exercícios inicial (38 itens) sem mídia; precisa de revisão profissional.
- Regras de segurança e progressão são parâmetros iniciais e devem ser revisadas por profissionais
  qualificados antes do lançamento. Textos legais são rascunhos.

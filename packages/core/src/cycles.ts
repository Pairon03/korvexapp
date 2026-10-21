import { buildAgentContext } from './ai/context';
import { DemoRulesProvider, FaultyProvider } from './ai/demo-provider';
import { estimateCostCents, requestProposal, type AiProvider, type RunOptions } from './ai/provider';
import { latestAssessments } from './assessment';
import { audit, cycleEvent, notify } from './events';
import {
  agentConfigFor,
  draftFromProposal,
  getPublished,
  getStudent,
  publishVersion,
  startCycle,
  validationContext,
} from './plans';
import type { CycleState, PlatformState, TrainingCycle } from './types';
import { addDays, daysBetween, nextId, toLocalDate } from './util';
import { hasBlockingFailure, validatePlan } from './validation';

export const MAX_CYCLE_ATTEMPTS = 3;
const TERMINAL: CycleState[] = ['publicado', 'cancelado'];
const DUE_STATES: CycleState[] = ['agendado', 'em_acompanhamento', 'aguardando_avaliacao', 'dados_incompletos', 'falhou'];

export interface EngineDeps {
  provider?: AiProvider;
  runOptions?: RunOptions;
}

export interface CycleReport {
  cycleId: string;
  studentName: string;
  from: CycleState;
  to: CycleState;
  message: string;
}

export interface ProcessOverrides {
  /** Personal revisou o alerta e autorizou gerar a proposta. Nunca publica automaticamente. */
  reviewedByTrainer?: boolean;
}

function providerFor(state: PlatformState, deps: EngineDeps): AiProvider {
  const base = deps.provider ?? new DemoRulesProvider();
  return state.settings.aiFailureMode === 'nenhuma' ? base : new FaultyProvider(base, state.settings.aiFailureMode);
}

function setState(state: PlatformState, cycle: TrainingCycle, to: CycleState, message: string) {
  cycle.state = to;
  cycleEvent(state, cycle, to, message);
}

function aiRunsThisMonth(state: PlatformState): number {
  const month = state.now.slice(0, 7);
  return state.aiRuns.filter((r) => r.startedAt.slice(0, 7) === month).length;
}

/**
 * Processa um ciclo vencido. Todas as saídas mantêm o treino vigente, exceto a
 * publicação autorizada. Idempotente: um ciclo já processado não gera nova versão.
 */
export async function processCycle(
  state: PlatformState,
  cycle: TrainingCycle,
  deps: EngineDeps = {},
  overrides: ProcessOverrides = {},
): Promise<CycleReport> {
  const student = getStudent(state, cycle.studentId);
  const from = cycle.state;
  const report = (message: string): CycleReport => ({ cycleId: cycle.id, studentName: student.name, from, to: cycle.state, message });

  if (cycle.state === 'em_processamento') return report('Já existe uma execução ativa para este ciclo.');
  if (cycle.generatedPlanVersionId || TERMINAL.includes(cycle.state)) return report('Ciclo já finalizado. Nenhuma nova versão criada.');
  if (cycle.paused) return report('Ciclo pausado.');

  const { version: agentVersion } = agentConfigFor(state, student);
  const cfg = agentVersion.config;
  const today = toLocalDate(state.now, state.trainer.timezone);
  const blockers: string[] = [];

  // 1. Assinatura e limites.
  if (!['ativa', 'teste'].includes(state.subscription.status)) {
    cycle.blockReasons = ['Assinatura sem pagamento confirmado. Atualizações automáticas pausadas.'];
    setState(state, cycle, 'suspenso', cycle.blockReasons[0]);
    return report(cycle.blockReasons[0]);
  }
  const plan = state.subscriptionPlans.find((p) => p.id === state.subscription.planId);
  const limit = Math.min(plan?.aiRunsPerMonth ?? 0, cfg.aiRunsPerMonth);
  if (aiRunsThisMonth(state) >= limit) {
    cycle.blockReasons = [`Limite mensal de ${limit} execuções de IA atingido.`];
    setState(state, cycle, 'suspenso', cycle.blockReasons[0]);
    notify(state, { audience: 'personal', studentId: student.id, kind: 'atualizacao_suspensa', title: 'Limite de IA atingido', body: `A atualização de ${student.name} foi pausada pelo limite do plano.` });
    return report(cycle.blockReasons[0]);
  }

  // 2. Avaliação. Fotos nunca são exigidas.
  const assessments = latestAssessments(state.assessments, student.id);
  const target = assessments.find((a) => a.date >= addDays(cycle.dueDate, -10));
  if (cfg.cycle.requireAssessment && !target) {
    if (cycle.state !== 'aguardando_avaliacao') {
      notify(state, { audience: 'aluno', studentId: student.id, kind: 'avaliacao_pendente', title: 'Hora da reavaliação', body: 'Registre sua avaliação para que seu treino seja atualizado.' });
      notify(state, { audience: 'personal', studentId: student.id, kind: 'avaliacao_pendente', title: 'Avaliação pendente', body: `${student.name} precisa de uma reavaliação para concluir o ciclo.` });
    }
    cycle.blockReasons = ['Nenhuma avaliação registrada nos últimos 10 dias do ciclo.'];
    setState(state, cycle, 'aguardando_avaliacao', 'Aguardando avaliação para prosseguir.');
    return report(cycle.blockReasons[0]);
  }
  cycle.targetAssessmentId = target?.id ?? null;

  // 3. Completude dos dados de execução.
  const ctx = buildAgentContext(state, student, 'atualizacao', { start: cycle.startDate, end: today });
  if (!overrides.reviewedByTrainer) {
    if (ctx.sessionsCompleted < 3) blockers.push(`Apenas ${ctx.sessionsCompleted} sessões registradas no ciclo (mínimo 3).`);
    if (ctx.adherencePct != null && ctx.adherencePct < cfg.cycle.minAdherencePct)
      blockers.push(`Adesão de ${ctx.adherencePct}% abaixo do mínimo de ${cfg.cycle.minAdherencePct}% definido no agente.`);
    if (blockers.length) {
      cycle.blockReasons = blockers;
      setState(state, cycle, 'dados_incompletos', blockers.join(' '));
      notify(state, { audience: 'personal', studentId: student.id, kind: 'atualizacao_suspensa', title: 'Dados insuficientes', body: `O ciclo de ${student.name} precisa de mais registros de treino.` });
      return report(blockers.join(' '));
    }

    // 4. Consistência e segurança.
    const prevA = ctx.assessments.previous;
    const curA = ctx.assessments.current;
    if (prevA?.weightKg && curA?.weightKg) {
      const pct = Math.abs((curA.weightKg - prevA.weightKg) / prevA.weightKg) * 100;
      if (pct > cfg.safety.maxWeightChangePct)
        blockers.push(`Peso variou ${pct.toFixed(1)}% entre avaliações (limite ${cfg.safety.maxWeightChangePct}%). Confirme a medida.`);
    }
    const pain = ctx.discomfortReports.filter((d) => d.level >= cfg.safety.blockDiscomfortLevel);
    if (pain.length) {
      const names = [...new Set(pain.map((p) => state.exercises.find((e) => e.id === p.exerciseId)?.name ?? p.exerciseId))];
      blockers.push(`Desconforto nível ${Math.max(...pain.map((p) => p.level))} relatado em: ${names.join(', ')}. Requer avaliação do personal.`);
    }
    if (blockers.length) {
      cycle.blockReasons = blockers;
      setState(state, cycle, 'suspenso', blockers.join(' '));
      notify(state, { audience: 'personal', studentId: student.id, kind: 'atualizacao_suspensa', title: 'Atualização suspensa', body: `A atualização de ${student.name} exige sua revisão.` });
      return report(blockers.join(' '));
    }
  }

  // 5. IA.
  setState(state, cycle, 'em_processamento', 'Solicitando proposta ao agente.');
  cycle.attempts += 1;
  const provider = providerFor(state, deps);
  const outcome = await requestProposal(provider, ctx, { sleep: async () => {}, ...deps.runOptions });
  const runId = nextId(state, 'run');
  state.aiRuns.unshift({
    id: runId,
    studentId: student.id,
    cycleId: cycle.id,
    agentId: ctx.agentId,
    agentVersion: ctx.agentVersion,
    provider: provider.name,
    model: provider.model,
    startedAt: state.now,
    finishedAt: state.now,
    status: outcome.status,
    attempts: outcome.attempts,
    tokensIn: outcome.tokensIn,
    tokensOut: outcome.tokensOut,
    costCents: estimateCostCents(outcome.tokensIn, outcome.tokensOut),
    errors: outcome.errors,
  });
  cycle.aiRunId = runId;

  if (!outcome.proposal) {
    cycle.errors.push(...outcome.errors);
    const exhausted = cycle.attempts >= MAX_CYCLE_ATTEMPTS;
    cycle.blockReasons = [
      outcome.status === 'resposta_invalida' ? 'A IA retornou uma resposta fora do contrato mesmo após correção.' : 'Provedor de IA indisponível.',
      exhausted ? 'Tentativas esgotadas. Encaminhado para monitoramento.' : `Nova tentativa automática na próxima execução (${cycle.attempts}/${MAX_CYCLE_ATTEMPTS}).`,
    ];
    setState(state, cycle, 'falhou', `${cycle.blockReasons.join(' ')} Treino vigente mantido.`);
    notify(state, { audience: 'personal', studentId: student.id, kind: 'falha_processamento', title: 'Falha ao gerar atualização', body: `O treino atual de ${student.name} foi mantido.` });
    return report(cycle.blockReasons.join(' '));
  }

  // 6. Validação determinística.
  const draft = draftFromProposal(state, student, outcome.proposal, runId, `Atualização do ciclo iniciado em ${cycle.startDate}.`);
  cycle.proposalPlanVersionId = draft.id;
  const results = validatePlan(draft, validationContext(state, student));
  cycle.validations = results;
  if (hasBlockingFailure(results)) {
    cycle.blockReasons = results.filter((r) => !r.ok && r.severity === 'bloqueio').map((r) => r.message);
    setState(state, cycle, 'suspenso', 'Proposta reprovada nas validações. Treino vigente mantido.');
    notify(state, { audience: 'personal', studentId: student.id, kind: 'atualizacao_suspensa', title: 'Proposta reprovada', body: `A proposta para ${student.name} violou regras obrigatórias.` });
    return report(cycle.blockReasons.join(' '));
  }

  // 7. Publicação automática somente com todas as condições atendidas.
  const autoAllowed = cfg.autoPublish && student.autoUpdate && !overrides.reviewedByTrainer && !outcome.proposal.requiresReview;
  if (!autoAllowed) {
    const why = !cfg.autoPublish
      ? 'Publicação automática desativada no agente.'
      : !student.autoUpdate
        ? 'Aluno sem autorização de atualização automática.'
        : overrides.reviewedByTrainer
          ? 'Proposta gerada após revisão do personal exige aprovação manual.'
          : 'A proposta pediu revisão humana.';
    cycle.blockReasons = [why];
    setState(state, cycle, 'aguardando_validacao', `${why} Aguardando aprovação do personal.`);
    notify(state, { audience: 'personal', studentId: student.id, kind: 'aguardando_aprovacao', title: 'Proposta pronta para revisão', body: `Nova versão do treino de ${student.name} aguarda sua aprovação.` });
    return report(why);
  }

  finalizePublication(state, cycle, draft.id, 'Agendador (automático)');
  return report('Nova versão validada e publicada automaticamente.');
}

function finalizePublication(state: PlatformState, cycle: TrainingCycle, versionId: string, actor: string) {
  const student = getStudent(state, cycle.studentId);
  const pv = publishVersion(state, student.id, versionId, actor);
  cycle.generatedPlanVersionId = pv.id;
  cycle.publishedAt = state.now;
  cycle.processedAt = state.now;
  cycle.blockReasons = [];
  setState(state, cycle, 'publicado', `Versão ${pv.version} publicada por ${actor}.`);
  notify(state, { audience: 'personal', studentId: student.id, kind: 'atualizacao_publicada', title: 'Treino atualizado', body: `Versão ${pv.version} publicada para ${student.name}.` });
  const next = startCycle(state, student, pv.id);
  cycleEvent(state, next, 'encadeado', `Ciclo iniciado após a publicação da versão ${pv.version}.`);
}

/**
 * Executa o agendador: equivalente à tarefa persistente do servidor.
 * Seguro para rodar várias vezes no mesmo dia.
 */
export async function runScheduler(state: PlatformState, deps: EngineDeps = {}): Promise<CycleReport[]> {
  const reports: CycleReport[] = [];
  const today = toLocalDate(state.now, state.trainer.timezone);
  // Snapshot da lista: ciclos criados durante a execução ficam para a próxima rodada.
  for (const cycle of [...state.cycles]) {
    if (TERMINAL.includes(cycle.state) || cycle.paused) continue;
    const student = state.students.find((s) => s.id === cycle.studentId);
    if (!student || student.status !== 'ativo') continue;

    if (cycle.state === 'agendado' && today >= cycle.startDate) {
      setState(state, cycle, 'em_acompanhamento', 'Acompanhamento iniciado.');
      notify(state, { audience: 'aluno', studentId: student.id, kind: 'ciclo_iniciado', title: 'Novo ciclo de treino', body: 'Seu novo ciclo começou. Registre seus treinos para acompanhar a evolução.' });
    }
    const daysLeft = daysBetween(today, cycle.dueDate);
    if (daysLeft > 0 && daysLeft <= 7 && !cycle.notifiedUpcoming) {
      cycle.notifiedUpcoming = true;
      cycleEvent(state, cycle, 'lembrete', `Reavaliação em ${daysLeft} dias.`);
      notify(state, { audience: 'aluno', studentId: student.id, kind: 'avaliacao_proxima', title: 'Reavaliação se aproximando', body: `Sua reavaliação está prevista para daqui a ${daysLeft} dias.` });
    }
    if (daysLeft <= 0 && DUE_STATES.includes(cycle.state)) {
      if (cycle.state === 'falhou' && cycle.attempts >= MAX_CYCLE_ATTEMPTS) continue;
      reports.push(await processCycle(state, cycle, deps));
    }
  }
  audit(state, 'sistema', 'agendador_executado', 'ciclos', `${reports.length} ciclo(s) processado(s).`);
  return reports;
}

// ---------- Ações do personal ----------

export function approveProposal(state: PlatformState, cycleId: string, actor: string): void {
  const cycle = state.cycles.find((c) => c.id === cycleId);
  if (!cycle?.proposalPlanVersionId) throw new Error('Não há proposta para aprovar.');
  if (cycle.state !== 'aguardando_validacao' && cycle.state !== 'suspenso') throw new Error('Este ciclo não está aguardando aprovação.');
  finalizePublication(state, cycle, cycle.proposalPlanVersionId, actor);
  audit(state, actor, 'aprovou_proposta', `ciclo:${cycle.id}`, 'Proposta aprovada e publicada.');
}

export function cancelUpdate(state: PlatformState, cycleId: string, actor: string): void {
  const cycle = state.cycles.find((c) => c.id === cycleId);
  if (!cycle || TERMINAL.includes(cycle.state)) throw new Error('Ciclo não pode ser cancelado.');
  const student = getStudent(state, cycle.studentId);
  if (cycle.proposalPlanVersionId) {
    const pv = state.plans.find((p) => p.studentId === student.id)?.versions.find((v) => v.id === cycle.proposalPlanVersionId);
    if (pv && pv.status === 'rascunho') pv.status = 'descartado';
  }
  setState(state, cycle, 'cancelado', `Atualização cancelada por ${actor}. Treino vigente mantido.`);
  audit(state, actor, 'cancelou_atualizacao', `ciclo:${cycle.id}`, 'Atualização cancelada antes da publicação.');
  const current = getPublished(state, student.id);
  if (current) startCycle(state, student, current.id);
}

export function setPaused(state: PlatformState, cycleId: string, paused: boolean, actor: string): void {
  const cycle = state.cycles.find((c) => c.id === cycleId);
  if (!cycle) throw new Error('Ciclo não encontrado.');
  cycle.paused = paused;
  cycleEvent(state, cycle, paused ? 'pausado' : 'retomado', paused ? `Pausado por ${actor}.` : `Retomado por ${actor}.`);
  audit(state, actor, paused ? 'pausou_ciclo' : 'retomou_ciclo', `ciclo:${cycle.id}`, '');
}

/** Estende o prazo de forma explícita e registrada. Nunca silenciosamente. */
export function extendCycle(state: PlatformState, cycleId: string, days: number, actor: string, reason: string): void {
  const cycle = state.cycles.find((c) => c.id === cycleId);
  if (!cycle) throw new Error('Ciclo não encontrado.');
  const before = cycle.dueDate;
  cycle.dueDate = addDays(cycle.dueDate, days);
  cycle.notifiedUpcoming = false;
  cycle.blockReasons = [];
  setState(state, cycle, 'em_acompanhamento', `Prazo estendido de ${before} para ${cycle.dueDate} por ${actor}. Motivo: ${reason}`);
  audit(state, actor, 'estendeu_ciclo', `ciclo:${cycle.id}`, `${before} → ${cycle.dueDate}`);
}

export async function retryCycle(state: PlatformState, cycleId: string, actor: string, deps: EngineDeps = {}, reviewed = false): Promise<CycleReport> {
  const cycle = state.cycles.find((c) => c.id === cycleId);
  if (!cycle) throw new Error('Ciclo não encontrado.');
  if (cycle.state === 'falhou') cycle.attempts = 0;
  audit(state, actor, reviewed ? 'revisou_e_reprocessou' : 'reprocessou_ciclo', `ciclo:${cycle.id}`, '');
  return processCycle(state, cycle, deps, { reviewedByTrainer: reviewed });
}

export { startCycle };

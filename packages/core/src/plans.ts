import type { Proposal } from './schemas';
import { audit, notify } from './events';
import type { PlanVersion, PlatformState, Student, TrainingCycle, WorkoutDay, WorkoutPlan } from './types';
import { addDays, clone, nextId, toLocalDate } from './util';
import { validatePlan, type ValidationContext } from './validation';

export function getPlan(state: PlatformState, studentId: string): WorkoutPlan | undefined {
  return state.plans.find((p) => p.studentId === studentId);
}

export function getPublished(state: PlatformState, studentId: string): PlanVersion | null {
  return getPlan(state, studentId)?.versions.find((v) => v.status === 'publicado') ?? null;
}

export function getStudent(state: PlatformState, id: string): Student {
  const s = state.students.find((x) => x.id === id);
  if (!s) throw new Error('Aluno não encontrado.');
  return s;
}

export function agentConfigFor(state: PlatformState, student: Student) {
  const agent = state.agents.find((a) => a.id === student.agentId);
  if (!agent) throw new Error('Agente não encontrado.');
  const version = agent.versions.find((v) => v.version === agent.currentVersion)!;
  return { agent, version };
}

export function validationContext(state: PlatformState, student: Student): ValidationContext {
  const { version } = agentConfigFor(state, student);
  return {
    student,
    agent: version.config,
    exercises: state.exercises,
    previous: getPublished(state, student.id),
  };
}

function ensurePlan(state: PlatformState, student: Student): WorkoutPlan {
  let plan = getPlan(state, student.id);
  if (!plan) {
    plan = { id: nextId(state, 'pln'), studentId: student.id, name: `Programa de ${student.name.split(' ')[0]}`, versions: [] };
    state.plans.push(plan);
  }
  return plan;
}

/** Cria uma versão em rascunho a partir de uma proposta (IA) ou edição manual. */
export function createDraft(
  state: PlatformState,
  student: Student,
  input: {
    days: Omit<WorkoutDay, 'id'>[] | WorkoutDay[];
    weeklyFrequency: number;
    cardio: PlanVersion['cardio'];
    source: PlanVersion['source'];
    author: string;
    changeReason: string;
    changes?: PlanVersion['changes'];
    alerts?: string[];
    aiRunId?: string | null;
    notes?: string;
  },
): PlanVersion {
  const plan = ensurePlan(state, student);
  const { agent, version } = agentConfigFor(state, student);
  // Rascunhos antigos não publicados são descartados para não acumular propostas paralelas.
  for (const v of plan.versions) if (v.status === 'rascunho') v.status = 'descartado';
  const pv: PlanVersion = {
    id: nextId(state, 'pv'),
    version: plan.versions.length + 1,
    status: 'rascunho',
    createdAt: state.now,
    publishedAt: null,
    author: input.author,
    source: input.source,
    agentId: agent.id,
    agentVersion: version.version,
    goal: student.goal,
    weeklyFrequency: input.weeklyFrequency,
    days: input.days.map((d) => ({
      id: 'id' in d && d.id ? d.id : nextId(state, 'day'),
      label: d.label,
      focus: d.focus,
      exercises: d.exercises.map((e) => ({ ...e, id: 'id' in e && e.id ? e.id : nextId(state, 'we') })),
    })),
    cardio: input.cardio,
    notes: input.notes ?? '',
    changeReason: input.changeReason,
    changes: input.changes ?? [],
    aiRunId: input.aiRunId ?? null,
    alerts: input.alerts ?? [],
  };
  plan.versions.push(pv);
  return pv;
}

export function draftFromProposal(state: PlatformState, student: Student, proposal: Proposal, aiRunId: string, reason: string): PlanVersion {
  return createDraft(state, student, {
    days: proposal.days.map((d) => ({ label: d.label, focus: d.focus, exercises: d.exercises.map((e) => ({ ...e, id: '' })) })),
    weeklyFrequency: proposal.weeklyFrequency,
    cardio: proposal.cardio,
    source: 'ia',
    author: 'Agente de IA',
    changeReason: `${reason} ${proposal.summary}`.trim(),
    changes: proposal.changes,
    alerts: [...proposal.alerts, ...proposal.missingData.map((m) => `Dado ausente: ${m}`)],
    aiRunId,
  });
}

export class PublishBlockedError extends Error {}

/**
 * Publica uma versão. As validações determinísticas são sempre executadas aqui,
 * independente de quem originou o treino. A versão anterior nunca é apagada.
 */
export function publishVersion(state: PlatformState, studentId: string, versionId: string, actor: string): PlanVersion {
  const student = getStudent(state, studentId);
  const plan = getPlan(state, studentId);
  const pv = plan?.versions.find((v) => v.id === versionId);
  if (!plan || !pv) throw new Error('Versão não encontrada.');
  if (pv.status !== 'rascunho') throw new Error('Somente rascunhos podem ser publicados.');
  const results = validatePlan(pv, validationContext(state, student));
  const blocking = results.filter((r) => !r.ok && r.severity === 'bloqueio');
  if (blocking.length) throw new PublishBlockedError(blocking.map((b) => b.message).join(' '));
  for (const v of plan.versions) if (v.status === 'publicado') v.status = 'substituido';
  pv.status = 'publicado';
  pv.publishedAt = state.now;
  audit(state, actor, 'publicou_treino', `treino:${pv.id}`, `Versão ${pv.version} publicada para ${student.name}.`);
  notify(state, {
    audience: 'aluno',
    studentId,
    kind: 'nova_versao',
    title: 'Seu treino foi atualizado',
    body: `A versão ${pv.version} do seu programa já está disponível.`,
  });
  return pv;
}

/** Restaura uma versão anterior criando uma NOVA versão baseada nela. */
export function restoreVersion(state: PlatformState, studentId: string, versionId: string, actor: string): PlanVersion {
  const student = getStudent(state, studentId);
  const src = getPlan(state, studentId)?.versions.find((v) => v.id === versionId);
  if (!src) throw new Error('Versão não encontrada.');
  const copy = clone(src);
  const pv = createDraft(state, student, {
    days: copy.days.map((d) => ({ ...d, id: '', exercises: d.exercises.map((e) => ({ ...e, id: '' })) })),
    weeklyFrequency: copy.weeklyFrequency,
    cardio: copy.cardio,
    source: 'restauracao',
    author: actor,
    changeReason: `Restauração da versão ${src.version}.`,
  });
  audit(state, actor, 'restaurou_versao', `treino:${pv.id}`, `Rascunho criado a partir da versão ${src.version}.`);
  return pv;
}

export function startCycle(state: PlatformState, student: Student, sourcePlanVersionId: string): TrainingCycle {
  const { agent, version } = agentConfigFor(state, student);
  const today = toLocalDate(state.now, state.trainer.timezone);
  const cycle: TrainingCycle = {
    id: nextId(state, 'cyc'),
    studentId: student.id,
    agentId: agent.id,
    agentVersion: version.version,
    sourcePlanVersionId,
    startDate: today,
    dueDate: addDays(today, version.config.cycle.days),
    processedAt: null,
    state: 'agendado',
    paused: false,
    sourceAssessmentId: state.assessments.filter((a) => a.studentId === student.id).sort((a, b) => b.date.localeCompare(a.date))[0]?.id ?? null,
    targetAssessmentId: null,
    aiRunId: null,
    proposalPlanVersionId: null,
    validations: [],
    blockReasons: [],
    generatedPlanVersionId: null,
    publishedAt: null,
    errors: [],
    attempts: 0,
    notifiedUpcoming: false,
    events: [{ at: state.now, type: 'criado', message: `Ciclo de ${version.config.cycle.days} dias iniciado. Reavaliação prevista para ${addDays(today, version.config.cycle.days)}.` }],
  };
  state.cycles.push(cycle);
  return cycle;
}

export function activeCycle(state: PlatformState, studentId: string): TrainingCycle | undefined {
  return state.cycles.find((c) => c.studentId === studentId && !['publicado', 'cancelado'].includes(c.state));
}

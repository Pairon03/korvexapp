import { buildAgentContext } from './ai/context';
import { DemoRulesProvider, FaultyProvider } from './ai/demo-provider';
import { estimateCostCents, requestProposal, type AiProvider } from './ai/provider';
import { calculateBodyFat } from './assessment';
import { audit, notify } from './events';
import { createDraft, draftFromProposal, getPublished, getStudent, startCycle, activeCycle, publishVersion } from './plans';
import { AssessmentFormSchema, StudentFormSchema, type AssessmentForm, type StudentForm } from './schemas';
import type {
  AgentConfig,
  Assessment,
  LogEntry,
  PhotoCategory,
  PlanVersion,
  PlatformState,
  Student,
  WorkoutDay,
  WorkoutLog,
} from './types';
import { addDaysIso, ageAt, nextId, toLocalDate } from './util';

export class LimitError extends Error {}

export function activeStudentCount(state: PlatformState): number {
  return state.students.filter((s) => s.status === 'ativo' || s.status === 'convidado').length;
}

export function currentPlanLimits(state: PlatformState) {
  const plan = state.subscriptionPlans.find((p) => p.id === state.subscription.planId)!;
  const month = state.now.slice(0, 7);
  return {
    plan,
    students: activeStudentCount(state),
    aiRuns: state.aiRuns.filter((r) => r.startedAt.slice(0, 7) === month).length,
  };
}

// ---------- Alunos ----------

export function createStudent(state: PlatformState, input: StudentForm, actor: string): Student {
  const data = StudentFormSchema.parse(input);
  const { plan, students } = currentPlanLimits(state);
  if (students >= plan.maxActiveStudents) {
    throw new LimitError(`Seu plano ${plan.name} permite ${plan.maxActiveStudents} alunos ativos. Arquive um aluno ou altere o plano.`);
  }
  if (state.students.some((s) => s.email.toLowerCase() === data.email.toLowerCase() && s.status !== 'arquivado')) {
    throw new Error('Já existe um aluno com este e-mail.');
  }
  const student: Student = {
    ...data,
    id: nextId(state, 'alu'),
    tenantId: state.trainer.tenantId,
    trainerId: state.trainer.id,
    startDate: toLocalDate(state.now),
    status: 'convidado',
    photoConsent: false,
    createdAt: state.now,
  };
  state.students.push(student);
  audit(state, actor, 'cadastrou_aluno', `aluno:${student.id}`, `Convite enviado para ${student.email}.`);
  notify(state, { audience: 'personal', studentId: student.id, kind: 'convite', title: 'Convite enviado', body: `${student.name} recebeu o convite por e-mail.` });
  return student;
}

export function acceptInvite(state: PlatformState, studentId: string): void {
  const s = getStudent(state, studentId);
  if (s.status !== 'convidado') return;
  s.status = 'ativo';
  audit(state, s.name, 'aceitou_convite', `aluno:${s.id}`, '');
}

export function updateStudent(state: PlatformState, studentId: string, patch: Partial<Student>, actor: string): void {
  const s = getStudent(state, studentId);
  const changed = Object.keys(patch).filter((k) => JSON.stringify((s as never)[k]) !== JSON.stringify((patch as never)[k]));
  Object.assign(s, patch);
  if (changed.length) audit(state, actor, 'editou_aluno', `aluno:${s.id}`, `Campos: ${changed.join(', ')}.`);
}

export function setStudentStatus(state: PlatformState, studentId: string, status: Student['status'], actor: string): void {
  const s = getStudent(state, studentId);
  if (status === 'ativo' && s.status === 'arquivado') {
    const { plan, students } = currentPlanLimits(state);
    if (students >= plan.maxActiveStudents) throw new LimitError(`Limite de ${plan.maxActiveStudents} alunos ativos atingido.`);
  }
  s.status = status;
  audit(state, actor, 'alterou_status_aluno', `aluno:${s.id}`, status);
}

// ---------- Treinos ----------

function providerFor(state: PlatformState, provider?: AiProvider): AiProvider {
  const base = provider ?? new DemoRulesProvider();
  return state.settings.aiFailureMode === 'nenhuma' ? base : new FaultyProvider(base, state.settings.aiFailureMode);
}

/** Gera uma proposta inicial com IA. Sempre fica em rascunho para revisão do personal. */
export async function generateInitialDraft(state: PlatformState, studentId: string, actor: string, provider?: AiProvider) {
  const student = getStudent(state, studentId);
  const ctx = buildAgentContext(state, student, 'inicial', null);
  const p = providerFor(state, provider);
  const outcome = await requestProposal(p, ctx, { sleep: async () => {} });
  const runId = nextId(state, 'run');
  state.aiRuns.unshift({
    id: runId,
    studentId,
    cycleId: null,
    agentId: ctx.agentId,
    agentVersion: ctx.agentVersion,
    provider: p.name,
    model: p.model,
    startedAt: state.now,
    finishedAt: state.now,
    status: outcome.status,
    attempts: outcome.attempts,
    tokensIn: outcome.tokensIn,
    tokensOut: outcome.tokensOut,
    costCents: estimateCostCents(outcome.tokensIn, outcome.tokensOut),
    errors: outcome.errors,
  });
  if (!outcome.proposal) {
    audit(state, actor, 'falha_geracao_ia', `aluno:${studentId}`, outcome.errors.join(' '));
    return { draft: null, outcome };
  }
  const draft = draftFromProposal(state, student, outcome.proposal, runId, 'Programa inicial gerado pelo agente.');
  audit(state, actor, 'gerou_proposta_ia', `treino:${draft.id}`, `Execução ${runId}.`);
  return { draft, outcome };
}

export function saveDraft(
  state: PlatformState,
  studentId: string,
  input: { days: WorkoutDay[]; cardio: PlanVersion['cardio']; changeReason: string; notes?: string },
  actor: string,
): PlanVersion {
  const student = getStudent(state, studentId);
  const pv = createDraft(state, student, {
    days: input.days,
    weeklyFrequency: input.days.length,
    cardio: input.cardio,
    source: 'manual',
    author: actor,
    changeReason: input.changeReason || 'Edição manual do personal.',
    notes: input.notes,
  });
  audit(state, actor, 'salvou_rascunho', `treino:${pv.id}`, `Versão ${pv.version}.`);
  return pv;
}

/** Publica manualmente e garante que exista um ciclo acompanhando a nova versão. */
export function publishAndTrack(state: PlatformState, studentId: string, versionId: string, actor: string): PlanVersion {
  const pv = publishVersion(state, studentId, versionId, actor);
  const student = getStudent(state, studentId);
  const cycle = activeCycle(state, studentId);
  if (cycle) {
    cycle.state = 'cancelado';
    cycle.events.push({ at: state.now, type: 'cancelado', message: `Substituído por publicação manual da versão ${pv.version}.` });
  }
  startCycle(state, student, pv.id);
  return pv;
}

// ---------- Execução ----------

export function startWorkout(state: PlatformState, studentId: string, dayId: string): WorkoutLog {
  const pv = getPublished(state, studentId);
  if (!pv) throw new Error('Nenhum treino publicado.');
  const day = pv.days.find((d) => d.id === dayId);
  if (!day) throw new Error('Dia de treino não encontrado.');
  const existing = state.logs.find((l) => l.studentId === studentId && l.status === 'em_andamento');
  if (existing) return existing;
  const log: WorkoutLog = {
    id: nextId(state, 'log'),
    studentId,
    planVersionId: pv.id,
    dayId,
    date: state.now,
    status: 'em_andamento',
    entries: day.exercises.map((we) => ({
      workoutExerciseId: we.id,
      exerciseId: we.exerciseId,
      skipped: false,
      sets: [],
      discomfort: null,
    })),
    notes: '',
  };
  state.logs.push(log);
  return log;
}

export function updateLogEntry(state: PlatformState, logId: string, workoutExerciseId: string, patch: Partial<LogEntry>): void {
  const log = state.logs.find((l) => l.id === logId);
  if (!log || log.status !== 'em_andamento') throw new Error('Sessão não está em andamento.');
  const entry = log.entries.find((e) => e.workoutExerciseId === workoutExerciseId);
  if (!entry) throw new Error('Exercício não encontrado na sessão.');
  Object.assign(entry, patch);
}

export function finishWorkout(state: PlatformState, logId: string, status: 'concluido' | 'interrompido', notes: string): WorkoutLog {
  const log = state.logs.find((l) => l.id === logId);
  if (!log) throw new Error('Sessão não encontrada.');
  log.status = status;
  log.notes = notes;
  const student = getStudent(state, log.studentId);
  const discomfort = log.entries.filter((e) => (e.discomfort?.level ?? 0) >= 5);
  if (discomfort.length) {
    notify(state, {
      audience: 'personal',
      studentId: student.id,
      kind: 'atualizacao_suspensa',
      title: 'Desconforto relatado',
      body: `${student.name} relatou desconforto durante o treino. Revise antes da próxima atualização.`,
    });
  }
  audit(state, student.name, status === 'concluido' ? 'concluiu_treino' : 'interrompeu_treino', `sessao:${log.id}`, '');
  return log;
}

export function resumeWorkout(state: PlatformState, logId: string): void {
  const log = state.logs.find((l) => l.id === logId);
  if (!log || log.status !== 'interrompido') throw new Error('Somente sessões interrompidas podem ser retomadas.');
  if (state.logs.some((l) => l.studentId === log.studentId && l.status === 'em_andamento')) {
    throw new Error('Finalize a sessão em andamento antes de retomar outra.');
  }
  log.status = 'em_andamento';
}

// ---------- Avaliações ----------

export function addAssessment(
  state: PlatformState,
  studentId: string,
  form: AssessmentForm,
  meta: { collectedBy: string; source: Assessment['source'] },
): Assessment {
  const data = AssessmentFormSchema.parse(form);
  const student = getStudent(state, studentId);
  const bodyFat = data.skinfolds
    ? calculateBodyFat(data.skinfolds.protocol, data.skinfolds.sitesMm, student.sex, ageAt(student.birthDate, data.date), state.now)
    : null;
  const a: Assessment = {
    id: nextId(state, 'ava'),
    studentId,
    date: data.date,
    collectedBy: meta.collectedBy,
    source: meta.source,
    weightKg: data.weightKg,
    heightCm: data.heightCm,
    circumferences: data.circumferences,
    skinfolds: data.skinfolds,
    bodyFat,
    photos: [],
    notes: data.notes,
  };
  state.assessments.push(a);
  audit(state, meta.collectedBy, 'registrou_avaliacao', `avaliacao:${a.id}`, `Avaliação de ${data.date}.`);
  return a;
}

/** Revoga ou concede o consentimento. Na revogação devolve as chaves dos arquivos, que o app apaga do armazenamento. */
export function setPhotoConsent(state: PlatformState, studentId: string, consent: boolean): string[] {
  const s = getStudent(state, studentId);
  s.photoConsent = consent;
  const removed: string[] = [];
  if (!consent) {
    for (const a of state.assessments.filter((x) => x.studentId === studentId)) {
      removed.push(...a.photos.map((p) => p.storageKey));
      a.photos = [];
    }
  }
  audit(state, s.name, consent ? 'concedeu_consentimento_fotos' : 'revogou_consentimento_fotos', `aluno:${s.id}`, removed.length ? `${removed.length} foto(s) apagada(s).` : '');
  return removed;
}

/** Avaliação que recebe as fotos enviadas agora: a mais recente do aluno. */
export function photoTargetAssessment(state: PlatformState, studentId: string): Assessment | null {
  const list = state.assessments.filter((a) => a.studentId === studentId);
  return list.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))[0] ?? null;
}

/** Registra uma foto já enviada. Substitui a da mesma categoria e devolve a chave antiga, para apagar o arquivo. */
export function addAssessmentPhoto(state: PlatformState, assessmentId: string, category: PhotoCategory, storageKey: string, actor: string): string | null {
  const a = state.assessments.find((x) => x.id === assessmentId);
  if (!a) throw new Error('Avaliação não encontrada.');
  const s = getStudent(state, a.studentId);
  if (!s.photoConsent) throw new Error('O aluno não autorizou o envio de fotos.');
  const previous = a.photos.find((p) => p.category === category)?.storageKey ?? null;
  a.photos = [...a.photos.filter((p) => p.category !== category), { category, storageKey, uploadedAt: state.now }];
  audit(state, actor, 'enviou_foto', `avaliacao:${a.id}`, `Foto ${category}.`);
  return previous;
}

export function removeAssessmentPhoto(state: PlatformState, assessmentId: string, category: PhotoCategory, actor: string): string | null {
  const a = state.assessments.find((x) => x.id === assessmentId);
  if (!a) throw new Error('Avaliação não encontrada.');
  const previous = a.photos.find((p) => p.category === category)?.storageKey ?? null;
  if (!previous) return null;
  a.photos = a.photos.filter((p) => p.category !== category);
  audit(state, actor, 'removeu_foto', `avaliacao:${a.id}`, `Foto ${category}.`);
  return previous;
}

// ---------- Agentes ----------

export function updateAgent(state: PlatformState, agentId: string, config: AgentConfig, actor: string, note: string): number {
  const agent = state.agents.find((a) => a.id === agentId);
  if (!agent) throw new Error('Agente não encontrado.');
  const current = agent.versions.find((v) => v.version === agent.currentVersion)!;
  const changed = (Object.keys(config) as (keyof AgentConfig)[]).filter(
    (k) => JSON.stringify(config[k]) !== JSON.stringify(current.config[k]),
  );
  if (!changed.length) return agent.currentVersion;
  if (config.effort.targetRpeMin > config.effort.targetRpeMax) throw new Error('RPE mínimo maior que o máximo.');
  if (config.volume.minSetsPerMuscleWeek > config.volume.maxSetsPerMuscleWeek) throw new Error('Volume mínimo maior que o máximo.');
  if (config.rest.minSec > config.rest.maxSec) throw new Error('Descanso mínimo maior que o máximo.');
  const version = agent.currentVersion + 1;
  agent.versions.push({ version, config, createdAt: state.now, author: actor, changedFields: changed, note });
  agent.currentVersion = version;
  // Treinos publicados não mudam. A nova versão vale para as próximas gerações.
  audit(state, actor, 'nova_versao_agente', `agente:${agent.id}`, `v${version}: ${changed.join(', ')}`);
  return version;
}

// ---------- Plataforma (demonstração) ----------

export function advanceClock(state: PlatformState, days: number): void {
  state.now = addDaysIso(state.now, days);
}

export function exportStudentData(state: PlatformState, studentId: string) {
  const student = getStudent(state, studentId);
  return {
    exportadoEm: state.now,
    aluno: student,
    treinos: state.plans.filter((p) => p.studentId === studentId),
    sessoes: state.logs.filter((l) => l.studentId === studentId),
    avaliacoes: state.assessments.filter((a) => a.studentId === studentId),
    ciclos: state.cycles.filter((c) => c.studentId === studentId),
  };
}

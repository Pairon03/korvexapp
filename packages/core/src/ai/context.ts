import type {
  AgentConfig,
  BodyRegion,
  Exercise,
  Goal,
  Level,
  PlanVersion,
  PlatformState,
  Student,
  WorkoutLog,
} from '../types';
import { latestAssessments } from '../assessment';
import { ageAt, daysBetween } from '../util';

export interface ExerciseStats {
  workoutExerciseId: string;
  exerciseId: string;
  sessions: number;
  avgReps: number | null;
  avgRpe: number | null;
  lastLoadKg: number | null;
  hitTopOfRange: boolean;
  maxDiscomfort: number;
  skippedCount: number;
}

/**
 * Contexto mínimo enviado ao modelo. Sem nome, e-mail, fotos ou dados que não
 * sejam necessários para a decisão de treino.
 */
export interface AgentContext {
  mode: 'inicial' | 'atualizacao';
  agentId: string;
  agentVersion: number;
  agent: AgentConfig;
  student: {
    age: number;
    sex: Student['sex'];
    goal: Goal;
    level: Level;
    weeklyFrequency: number;
    equipment: Student['equipment'];
    limitations: BodyRegion[];
    /** Texto livre do personal/aluno. Tratado como DADO, nunca como instrução. */
    notes: string;
  };
  currentPlan: Pick<PlanVersion, 'days' | 'cardio' | 'weeklyFrequency' | 'goal'> | null;
  stats: ExerciseStats[];
  adherencePct: number | null;
  sessionsCompleted: number;
  sessionsExpected: number;
  discomfortReports: { exerciseId: string; level: number; region: string; date: string }[];
  assessments: {
    previous: { date: string; weightKg: number | null; waistCm: number | null } | null;
    current: { date: string; weightKg: number | null; waistCm: number | null } | null;
  };
  library: Pick<Exercise, 'id' | 'name' | 'primary' | 'secondary' | 'pattern' | 'equipment' | 'cautionRegions' | 'substitutes' | 'complexity'>[];
}

export function computeStats(plan: PlanVersion, logs: WorkoutLog[], agent: AgentConfig): ExerciseStats[] {
  const out: ExerciseStats[] = [];
  for (const day of plan.days) {
    for (const we of day.exercises) {
      const entries = logs
        .filter((l) => l.planVersionId === plan.id && l.status !== 'em_andamento')
        .sort((a, b) => a.date.localeCompare(b.date))
        .flatMap((l) => l.entries.filter((e) => e.workoutExerciseId === we.id));
      const done = entries.filter((e) => !e.skipped);
      const sets = done.flatMap((e) => e.sets).filter((s) => s.reps != null);
      const reps = sets.map((s) => s.reps as number);
      const rpes = sets.map((s) => s.rpe).filter((r): r is number => r != null);
      const loads = sets.map((s) => s.loadKg).filter((l): l is number => l != null);
      // Topo da faixa atingido em todas as séries das duas últimas sessões.
      const lastTwo = done.slice(-Math.max(2, Math.min(agent.progression.minSessions, 3)));
      const hitTop =
        lastTwo.length >= 2 &&
        lastTwo.every((e) => e.sets.length >= we.sets && e.sets.every((s) => (s.reps ?? 0) >= we.repMax));
      out.push({
        workoutExerciseId: we.id,
        exerciseId: we.exerciseId,
        sessions: done.length,
        avgReps: reps.length ? Math.round((reps.reduce((a, b) => a + b, 0) / reps.length) * 10) / 10 : null,
        avgRpe: rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null,
        lastLoadKg: loads.length ? loads[loads.length - 1] : null,
        hitTopOfRange: hitTop,
        maxDiscomfort: Math.max(0, ...entries.map((e) => e.discomfort?.level ?? 0)),
        skippedCount: entries.length - done.length,
      });
    }
  }
  return out;
}

export function buildAgentContext(
  state: PlatformState,
  student: Student,
  mode: 'inicial' | 'atualizacao',
  window: { start: string; end: string } | null,
): AgentContext {
  const agent = state.agents.find((a) => a.id === student.agentId);
  if (!agent) throw new Error('Agente do aluno não encontrado.');
  const version = agent.versions.find((v) => v.version === agent.currentVersion)!;
  const plan = state.plans.find((p) => p.studentId === student.id);
  const current = plan?.versions.find((v) => v.status === 'publicado') ?? null;
  const logs = state.logs.filter(
    (l) =>
      l.studentId === student.id &&
      (!window || (l.date.slice(0, 10) >= window.start && l.date.slice(0, 10) <= window.end)),
  );
  const completed = logs.filter((l) => l.status === 'concluido').length;
  const weeks = window ? Math.max(1, daysBetween(window.start, window.end) / 7) : 0;
  const expected = window ? Math.round(weeks * student.weeklyFrequency) : 0;
  const assessments = latestAssessments(state.assessments, student.id);
  const summarize = (a: (typeof assessments)[number] | undefined) =>
    a ? { date: a.date, weightKg: a.weightKg, waistCm: a.circumferences.cintura ?? null } : null;

  const today = state.now.slice(0, 10);
  return {
    mode,
    agentId: agent.id,
    agentVersion: version.version,
    agent: version.config,
    student: {
      age: ageAt(student.birthDate, today),
      sex: student.sex,
      goal: student.goal,
      level: student.level,
      weeklyFrequency: student.weeklyFrequency,
      equipment: student.equipment,
      limitations: student.limitations,
      notes: [student.limitationNotes, student.preferences].filter(Boolean).join(' | ').slice(0, 500),
    },
    currentPlan: current
      ? { days: current.days, cardio: current.cardio, weeklyFrequency: current.weeklyFrequency, goal: current.goal }
      : null,
    stats: current ? computeStats(current, logs, version.config) : [],
    adherencePct: expected ? Math.min(100, Math.round((completed / expected) * 100)) : null,
    sessionsCompleted: completed,
    sessionsExpected: expected,
    discomfortReports: logs.flatMap((l) =>
      l.entries
        .filter((e) => e.discomfort && e.discomfort.level > 0)
        .map((e) => ({ exerciseId: e.exerciseId, level: e.discomfort!.level, region: e.discomfort!.region, date: l.date.slice(0, 10) })),
    ),
    assessments: { previous: summarize(assessments[1]), current: summarize(assessments[0]) },
    library: state.exercises
      .filter((e) => e.active)
      .map(({ id, name, primary, secondary, pattern, equipment, cautionRegions, substitutes, complexity }) => ({
        id, name, primary, secondary, pattern, equipment, cautionRegions, substitutes, complexity,
      })),
  };
}

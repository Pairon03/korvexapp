import { isTimed, rangeLimits } from './exercises';
import { muscleLabel, regionLabel } from './labels';
import type { AgentConfig, Exercise, PlanVersion, Student, ValidationResult, WorkoutDay } from './types';
import { totalWeeklySets, weeklySetsByMuscle } from './volume';

export interface ValidationContext {
  student: Student;
  agent: AgentConfig;
  exercises: Exercise[];
  previous: Pick<PlanVersion, 'days'> | null;
}

type PlanLike = {
  weeklyFrequency: number;
  days: Pick<WorkoutDay, 'label' | 'exercises'>[];
  cardio: { sessionsPerWeek: number; minutes: number } | null;
};

/**
 * Regras determinísticas aplicadas a QUALQUER treino antes da publicação,
 * seja ele escrito pelo personal ou proposto pela IA. Instruções livres do agente
 * não desativam nenhuma destas regras.
 */
export function validatePlan(plan: PlanLike, ctx: ValidationContext): ValidationResult[] {
  const results: ValidationResult[] = [];
  const push = (rule: string, ok: boolean, severity: 'bloqueio' | 'aviso', message: string) =>
    results.push({ rule, ok, severity, message });
  const byId = new Map(ctx.exercises.map((e) => [e.id, e]));
  const { student, agent } = ctx;

  // 1. Exercícios existem, estão ativos e são compatíveis.
  const unknown: string[] = [];
  const inactive: string[] = [];
  const equipmentIssues: string[] = [];
  const cautionIssues: string[] = [];
  for (const day of plan.days) {
    for (const we of day.exercises) {
      const ex = byId.get(we.exerciseId);
      if (!ex) {
        unknown.push(we.exerciseId);
        continue;
      }
      if (!ex.active) inactive.push(ex.name);
      if (!ex.equipment.some((eq) => student.equipment.includes(eq))) equipmentIssues.push(ex.name);
      const conflict = ex.cautionRegions.filter((r) => student.limitations.includes(r));
      if (conflict.length) cautionIssues.push(`${ex.name} (${conflict.map((r) => regionLabel[r]).join(', ')})`);
    }
  }
  push('biblioteca', unknown.length === 0, 'bloqueio',
    unknown.length ? `Exercícios fora da biblioteca autorizada: ${unknown.join(', ')}.` : 'Todos os exercícios existem na biblioteca.');
  push('exercicio_ativo', inactive.length === 0, 'bloqueio',
    inactive.length ? `Exercícios desativados: ${inactive.join(', ')}.` : 'Nenhum exercício desativado.');
  push('equipamentos', equipmentIssues.length === 0, 'bloqueio',
    equipmentIssues.length ? `Exigem equipamento que o aluno não tem: ${equipmentIssues.join(', ')}.` : 'Equipamentos compatíveis com o aluno.');
  push('limitacoes', cautionIssues.length === 0, 'bloqueio',
    cautionIssues.length ? `Conflitam com limitações relatadas: ${cautionIssues.join('; ')}.` : 'Nenhum conflito com limitações relatadas.');

  // 2. Parâmetros numéricos dentro dos limites.
  const paramIssues: string[] = [];
  for (const day of plan.days) {
    if (day.exercises.length < 2 || day.exercises.length > 10) paramIssues.push(`${day.label}: ${day.exercises.length} exercícios (permitido 2 a 10)`);
    for (const we of day.exercises) {
      const name = byId.get(we.exerciseId)?.name ?? we.exerciseId;
      if (we.sets < 1 || we.sets > 8) paramIssues.push(`${name}: ${we.sets} séries`);
      const lim = rangeLimits(byId.get(we.exerciseId)?.measure);
      if (we.repMin < lim.min || we.repMax > lim.max || we.repMin > we.repMax)
        paramIssues.push(`${name}: faixa ${we.repMin}–${we.repMax} ${isTimed(byId.get(we.exerciseId)) ? 'segundos' : 'repetições'}`);
      if (we.restSec < agent.rest.minSec || we.restSec > agent.rest.maxSec)
        paramIssues.push(`${name}: descanso ${we.restSec}s fora de ${agent.rest.minSec}–${agent.rest.maxSec}s`);
      if (we.rpeTarget < 5 || we.rpeTarget > 10) paramIssues.push(`${name}: RPE ${we.rpeTarget}`);
    }
  }
  push('parametros', paramIssues.length === 0, 'bloqueio',
    paramIssues.length ? `Parâmetros fora dos limites: ${paramIssues.join('; ')}.` : 'Séries, repetições, descanso e esforço dentro dos limites.');

  // 3. Frequência coerente com a disponibilidade do aluno.
  push('frequencia', plan.days.length <= student.weeklyFrequency && plan.weeklyFrequency <= student.weeklyFrequency, 'bloqueio',
    plan.days.length <= student.weeklyFrequency
      ? `${plan.days.length} dias de treino para ${student.weeklyFrequency} disponíveis.`
      : `${plan.days.length} dias de treino, mas o aluno tem ${student.weeklyFrequency} dias disponíveis.`);

  // 4. Volume semanal por grupo muscular.
  const volume = weeklySetsByMuscle(plan, ctx.exercises);
  const over = Object.entries(volume).filter(([, v]) => (v ?? 0) > agent.volume.maxSetsPerMuscleWeek);
  push('volume_maximo', over.length === 0, 'bloqueio',
    over.length
      ? `Volume acima do limite do agente (${agent.volume.maxSetsPerMuscleWeek} séries): ${over.map(([m, v]) => `${muscleLabel[m as keyof typeof muscleLabel]} ${v}`).join(', ')}.`
      : `Nenhum grupo acima de ${agent.volume.maxSetsPerMuscleWeek} séries semanais.`);
  const mainMuscles = ['peito', 'costas', 'quadriceps', 'posteriores'] as const;
  const under = mainMuscles.filter((m) => (volume[m] ?? 0) < agent.volume.minSetsPerMuscleWeek);
  push('volume_minimo', under.length === 0, 'aviso',
    under.length
      ? `Abaixo do mínimo sugerido (${agent.volume.minSetsPerMuscleWeek} séries): ${under.map((m) => muscleLabel[m]).join(', ')}.`
      : 'Grupos principais com volume mínimo atendido.');

  // 5. Magnitude da mudança em relação à versão vigente.
  if (ctx.previous) {
    const before = totalWeeklySets(ctx.previous);
    const after = totalWeeklySets(plan);
    const pct = before ? Math.round((Math.abs(after - before) / before) * 100) : 0;
    push('magnitude', pct <= agent.cycle.maxVolumeChangePct, 'bloqueio',
      `Volume total ${before} → ${after} séries (${pct}% de variação; limite ${agent.cycle.maxVolumeChangePct}%).`);
  }

  // 6. Cardio dentro dos limites do agente.
  if (plan.cardio) {
    const ok = plan.cardio.minutes <= 60 && plan.cardio.sessionsPerWeek <= 6;
    push('cardio', ok, 'bloqueio', ok ? 'Cardio dentro dos limites.' : 'Cardio acima dos limites (máx. 60 min, 6 sessões).');
  }

  return results;
}

export function hasBlockingFailure(results: ValidationResult[]): boolean {
  return results.some((r) => !r.ok && r.severity === 'bloqueio');
}

import type { Exercise, MuscleGroup, WorkoutExercise } from './types';

type DaysLike = { days: { exercises: Pick<WorkoutExercise, 'exerciseId' | 'sets'>[] }[] };

/**
 * Séries semanais por grupo muscular. Considera que cada dia do programa é executado
 * uma vez por semana. Músculos secundários contam meia série.
 */
export function weeklySetsByMuscle(
  plan: DaysLike,
  exercises: Exercise[],
): Partial<Record<MuscleGroup, number>> {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const out: Partial<Record<MuscleGroup, number>> = {};
  for (const day of plan.days) {
    for (const we of day.exercises) {
      const ex = byId.get(we.exerciseId);
      if (!ex) continue;
      out[ex.primary] = (out[ex.primary] ?? 0) + we.sets;
      for (const s of ex.secondary) out[s] = (out[s] ?? 0) + we.sets * 0.5;
    }
  }
  return out;
}

export function totalWeeklySets(plan: DaysLike): number {
  return plan.days.reduce((acc, d) => acc + d.exercises.reduce((a, e) => a + e.sets, 0), 0);
}

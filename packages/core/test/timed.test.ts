import { describe, expect, it } from 'vitest';
import {
  createSeedState,
  EXERCISES,
  formatDose,
  getPublished,
  migrateTimedExercises,
  validatePlan,
  validationContext,
  type PlatformState,
} from '../src';

const prancha = EXERCISES.find((e) => e.id === 'ex_prancha')!;

/** Coloca a prancha no primeiro dia do plano publicado do primeiro aluno que tiver um. */
function withPlank(s: PlatformState, repMin: number, repMax: number) {
  const plan = s.plans.find((p) => getPublished(s, p.studentId))!;
  const version = getPublished(s, plan.studentId)!;
  version.days[0].exercises[0] = { ...version.days[0].exercises[0], exerciseId: 'ex_prancha', repMin, repMax };
  return { plan, version };
}

describe('exercícios de tempo', () => {
  it('a prancha é medida em segundos e os demais em repetições', () => {
    expect(prancha.measure).toBe('segundos');
    expect(EXERCISES.filter((e) => e.measure === 'segundos').map((e) => e.id)).toEqual(['ex_prancha']);
  });

  it('mostra a faixa com a unidade certa', () => {
    expect(formatDose({ sets: 3, repMin: 30, repMax: 45 }, prancha)).toBe('3 × 30–45 s');
    expect(formatDose({ sets: 3, repMin: 8, repMax: 12 }, null)).toBe('3 × 8–12');
    expect(formatDose({ sets: 3, repMin: 40, repMax: 40 }, prancha)).toBe('3 × 40 s');
  });

  it('bloqueia prancha "1–1" e aceita 30–45 segundos', () => {
    const s = createSeedState();
    const { plan, version } = withPlank(s, 1, 1);
    const student = s.students.find((x) => x.id === plan.studentId)!;
    const params = () => validatePlan(version, validationContext(s, student)).find((c) => c.rule === 'parametros')!;
    expect(params().ok).toBe(false);
    version.days[0].exercises[0] = { ...version.days[0].exercises[0], repMin: 30, repMax: 45 };
    expect(params().ok).toBe(true);
  });

  it('corrige estados salvos antes da mudança', () => {
    const s = createSeedState();
    s.exercises = s.exercises.map(({ measure: _m, ...e }) => e);
    const { plan } = withPlank(s, 1, 1);
    const level = s.students.find((x) => x.id === plan.studentId)!.level;
    const fixed = migrateTimedExercises(s);
    expect(fixed.exercises.find((e) => e.id === 'ex_prancha')!.measure).toBe('segundos');
    const we = getPublished(fixed, plan.studentId)!.days[0].exercises[0];
    expect(we.repMin).toBeGreaterThanOrEqual(10);
    expect(we.repMax).toBeGreaterThan(we.repMin);
    expect(level).toBeTruthy();
  });
});

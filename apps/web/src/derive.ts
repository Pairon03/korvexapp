import {
  activeCycle,
  addDays,
  daysBetween,
  getPublished,
  toLocalDate,
  type PlatformState,
  type TrainingCycle,
} from '@korvex/core';

export function today(state: PlatformState) {
  return toLocalDate(state.now, state.trainer.timezone);
}

export function cycleProgress(state: PlatformState, c: TrainingCycle) {
  const total = daysBetween(c.startDate, c.dueDate);
  const elapsed = Math.max(0, Math.min(total, daysBetween(c.startDate, today(state))));
  return { total, elapsed, daysLeft: daysBetween(today(state), c.dueDate) };
}

export const NEEDS_ATTENTION = ['aguardando_avaliacao', 'dados_incompletos', 'suspenso', 'falhou', 'aguardando_validacao'] as const;

/** Sessões concluídas / esperadas nas últimas N semanas, para alunos ativos com treino publicado. */
export function adherence(state: PlatformState, weeks: number, studentId?: string) {
  const end = today(state);
  const start = addDays(end, -weeks * 7);
  const students = state.students.filter((s) => s.status === 'ativo' && getPublished(state, s.id) && (!studentId || s.id === studentId));
  let expected = 0;
  let done = 0;
  for (const s of students) {
    // Conta a partir do primeiro treino publicado, se ele for mais recente que o início da janela.
    const firstPublished = state.plans.find((p) => p.studentId === s.id)?.versions.find((v) => v.publishedAt)?.publishedAt?.slice(0, 10) ?? start;
    const effectiveStart = firstPublished > start ? firstPublished : start;
    const days = Math.max(0, daysBetween(effectiveStart, end));
    expected += (days / 7) * s.weeklyFrequency;
    done += state.logs.filter((l) => l.studentId === s.id && l.status === 'concluido' && l.date.slice(0, 10) >= effectiveStart && l.date.slice(0, 10) <= end).length;
  }
  return { expected: Math.round(expected), done, pct: expected ? Math.min(100, Math.round((done / expected) * 100)) : null };
}

export function weeklySessions(state: PlatformState, weeks: number, studentId?: string) {
  const end = today(state);
  return Array.from({ length: weeks }, (_, i) => {
    const wEnd = addDays(end, -(weeks - 1 - i) * 7);
    const wStart = addDays(wEnd, -6);
    const count = state.logs.filter(
      (l) => l.status === 'concluido' && (!studentId || l.studentId === studentId) && l.date.slice(0, 10) >= wStart && l.date.slice(0, 10) <= wEnd,
    ).length;
    return { label: `${wStart.slice(8, 10)}/${wStart.slice(5, 7)}`, sessoes: count };
  });
}

export function studentSummary(state: PlatformState, studentId: string) {
  const cycle = activeCycle(state, studentId);
  const plan = getPublished(state, studentId);
  const lastLog = state.logs
    .filter((l) => l.studentId === studentId && l.status !== 'em_andamento')
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return { cycle, plan, lastLog };
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

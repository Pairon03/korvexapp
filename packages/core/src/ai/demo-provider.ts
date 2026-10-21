import type { Proposal } from '../schemas';
import type { AgentConfig, Goal, MovementPattern, MuscleGroup, SplitType, WorkoutDay } from '../types';
import { round } from '../util';
import { muscleLabel } from '../labels';
import type { AgentContext, ExerciseStats } from './context';
import { AiUnavailableError, type AiProvider } from './provider';

type Slot = { muscle: MuscleGroup; pattern?: MovementPattern };
type DayTemplate = { label: string; focus: string; slots: Slot[] };

const S = (muscle: MuscleGroup, pattern?: MovementPattern): Slot => ({ muscle, pattern });

const TEMPLATES: Record<SplitType, DayTemplate[]> = {
  fullbody: [
    { label: 'Treino A', focus: 'Corpo inteiro', slots: [S('quadriceps', 'agachar'), S('peito', 'empurrar_horizontal'), S('costas', 'puxar_vertical'), S('posteriores', 'dobrar_quadril'), S('ombros', 'isolamento'), S('abdomen')] },
    { label: 'Treino B', focus: 'Corpo inteiro', slots: [S('gluteos'), S('costas', 'puxar_horizontal'), S('ombros', 'empurrar_vertical'), S('quadriceps', 'isolamento'), S('posteriores', 'isolamento'), S('abdomen')] },
    { label: 'Treino C', focus: 'Corpo inteiro', slots: [S('quadriceps', 'afundo'), S('peito', 'empurrar_horizontal'), S('costas', 'puxar_vertical'), S('biceps'), S('triceps'), S('panturrilhas')] },
  ],
  ab: [
    { label: 'Treino A', focus: 'Membros superiores', slots: [S('peito', 'empurrar_horizontal'), S('costas', 'puxar_vertical'), S('ombros', 'empurrar_vertical'), S('costas', 'puxar_horizontal'), S('biceps'), S('triceps')] },
    { label: 'Treino B', focus: 'Membros inferiores e core', slots: [S('quadriceps', 'agachar'), S('posteriores', 'dobrar_quadril'), S('quadriceps', 'isolamento'), S('posteriores', 'isolamento'), S('panturrilhas'), S('abdomen')] },
  ],
  abc: [
    { label: 'Treino A', focus: 'Peito, ombros e tríceps', slots: [S('peito', 'empurrar_horizontal'), S('peito', 'isolamento'), S('ombros', 'empurrar_vertical'), S('ombros', 'isolamento'), S('triceps')] },
    { label: 'Treino B', focus: 'Costas e bíceps', slots: [S('costas', 'puxar_vertical'), S('costas', 'puxar_horizontal'), S('ombros', 'puxar_horizontal'), S('biceps'), S('abdomen')] },
    { label: 'Treino C', focus: 'Pernas', slots: [S('quadriceps', 'agachar'), S('posteriores', 'dobrar_quadril'), S('quadriceps', 'isolamento'), S('gluteos'), S('panturrilhas')] },
  ],
  upper_lower: [
    { label: 'Superior 1', focus: 'Ênfase em empurrar', slots: [S('peito', 'empurrar_horizontal'), S('costas', 'puxar_vertical'), S('ombros', 'empurrar_vertical'), S('triceps'), S('biceps')] },
    { label: 'Inferior 1', focus: 'Ênfase em quadríceps', slots: [S('quadriceps', 'agachar'), S('posteriores', 'isolamento'), S('quadriceps', 'afundo'), S('panturrilhas'), S('abdomen')] },
    { label: 'Superior 2', focus: 'Ênfase em puxar', slots: [S('costas', 'puxar_horizontal'), S('peito', 'empurrar_horizontal'), S('ombros', 'isolamento'), S('biceps'), S('triceps')] },
    { label: 'Inferior 2', focus: 'Ênfase em posteriores', slots: [S('posteriores', 'dobrar_quadril'), S('quadriceps', 'isolamento'), S('gluteos'), S('panturrilhas'), S('abdomen')] },
  ],
  ppl: [
    { label: 'Empurrar', focus: 'Peito, ombros e tríceps', slots: [S('peito', 'empurrar_horizontal'), S('ombros', 'empurrar_vertical'), S('peito', 'isolamento'), S('ombros', 'isolamento'), S('triceps')] },
    { label: 'Puxar', focus: 'Costas e bíceps', slots: [S('costas', 'puxar_vertical'), S('costas', 'puxar_horizontal'), S('ombros', 'puxar_horizontal'), S('biceps'), S('abdomen')] },
    { label: 'Pernas', focus: 'Membros inferiores', slots: [S('quadriceps', 'agachar'), S('posteriores', 'dobrar_quadril'), S('quadriceps', 'isolamento'), S('posteriores', 'isolamento'), S('panturrilhas')] },
  ],
};

const GOAL_PARAMS: Record<Goal, { sets: number; repMin: number; repMax: number; rest: number }> = {
  hipertrofia: { sets: 3, repMin: 8, repMax: 12, rest: 90 },
  forca: { sets: 4, repMin: 4, repMax: 6, rest: 150 },
  emagrecimento: { sets: 3, repMin: 10, repMax: 15, rest: 60 },
  condicionamento: { sets: 3, repMin: 12, repMax: 15, rest: 45 },
  saude: { sets: 2, repMin: 10, repMax: 12, rest: 60 },
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function compatible(ctx: AgentContext, id: string): boolean {
  const ex = ctx.library.find((e) => e.id === id);
  if (!ex) return false;
  return ex.equipment.some((eq) => ctx.student.equipment.includes(eq)) && !ex.cautionRegions.some((r) => ctx.student.limitations.includes(r));
}

function pickExercise(ctx: AgentContext, slot: Slot, used: Set<string>): string | null {
  const maxComplexity = ctx.student.level === 'iniciante' ? 1 : ctx.student.level === 'intermediario' ? 2 : 3;
  const candidates = ctx.library
    .filter((e) => e.primary === slot.muscle && (!slot.pattern || e.pattern === slot.pattern) && compatible(ctx, e.id))
    .sort((a, b) => {
      const pa = a.complexity <= maxComplexity ? 0 : 1;
      const pb = b.complexity <= maxComplexity ? 0 : 1;
      return pa - pb || (ctx.student.level === 'avancado' ? b.complexity - a.complexity : a.complexity - b.complexity);
    });
  return candidates.find((c) => !used.has(c.id))?.id ?? candidates[0]?.id ?? null;
}

export function buildInitialProposal(ctx: AgentContext): Proposal {
  const cfg = ctx.agent;
  const templates = TEMPLATES[cfg.split].slice(0, ctx.student.weeklyFrequency);
  const p = GOAL_PARAMS[ctx.student.goal];
  const rpe = clamp(cfg.effort.targetRpeMax - 1, cfg.effort.targetRpeMin, cfg.effort.targetRpeMax);
  const missing: string[] = [];
  const days: Proposal['days'] = templates.map((t) => {
    const used = new Set<string>();
    const exercises: Proposal['days'][number]['exercises'] = [];
    for (const slot of t.slots) {
      const id = pickExercise(ctx, slot, used);
      if (!id) {
        missing.push(`Nenhum exercício da biblioteca para ${muscleLabel[slot.muscle].toLowerCase()} é compatível com as limitações e equipamentos do aluno (${t.label}). Revise ou cadastre um exercício próprio.`);
        continue;
      }
      used.add(id);
      const isolation = ctx.library.find((e) => e.id === id)?.pattern === 'isolamento';
      exercises.push({
        exerciseId: id,
        sets: ctx.student.level === 'iniciante' ? Math.max(2, p.sets - 1) : p.sets,
        repMin: isolation ? Math.max(p.repMin, 10) : p.repMin,
        repMax: isolation ? Math.max(p.repMax, 15) : p.repMax,
        restSec: clamp(isolation ? Math.min(p.rest, 60) : p.rest, cfg.rest.minSec, cfg.rest.maxSec),
        rpeTarget: rpe,
        suggestedLoadKg: null,
        notes: '',
      });
    }
    return { label: t.label, focus: t.focus, exercises };
  });
  return {
    meta: { agentId: ctx.agentId, agentVersion: ctx.agentVersion, schemaVersion: 1 },
    goal: ctx.student.goal,
    weeklyFrequency: days.length,
    days,
    cardio: cfg.cardio.enabled
      ? { sessionsPerWeek: cfg.cardio.sessionsPerWeek, minutes: cfg.cardio.minutes, intensity: cfg.cardio.intensity, notes: 'Após o treino resistido ou em dias alternados.' }
      : null,
    changes: [],
    alerts: [...new Set(missing)],
    missingData: ['Cargas iniciais: definidas na primeira semana a partir dos registros do aluno.'],
    requiresReview: missing.length > 0,
    summary: `Programa ${days.length}x/semana na divisão do agente, com exercícios compatíveis com os equipamentos e limitações informados.`,
  };
}

export function buildUpdateProposal(ctx: AgentContext): Proposal {
  const cfg: AgentConfig = ctx.agent;
  const plan = ctx.currentPlan!;
  const statsById = new Map<string, ExerciseStats>(ctx.stats.map((s) => [s.workoutExerciseId, s]));
  const nameOf = (id: string) => ctx.library.find((e) => e.id === id)?.name ?? id;
  const changes: Proposal['changes'] = [];
  const missing: string[] = [];
  const alerts: string[] = [];

  const days: Proposal['days'] = plan.days.map((day: WorkoutDay) => {
    let variedThisDay = false;
    const usedIds = new Set(day.exercises.map((e) => e.exerciseId));
    const exercises = day.exercises.map((we) => {
      const st = statsById.get(we.id);
      const next = {
        exerciseId: we.exerciseId,
        sets: we.sets,
        repMin: we.repMin,
        repMax: we.repMax,
        restSec: we.restSec,
        rpeTarget: we.rpeTarget,
        suggestedLoadKg: we.suggestedLoadKg,
        notes: we.notes,
      };
      if (!st || st.sessions === 0) {
        missing.push(`${nameOf(we.exerciseId)} sem registros no ciclo.`);
        return next;
      }
      const dataUsed = `${st.sessions} sessões, média ${st.avgReps ?? '—'} reps, RPE ${st.avgRpe ?? '—'}`;

      // Desconforto leve/moderado: substituir ou reduzir conforme a regra do agente.
      if (st.maxDiscomfort >= 3) {
        const sub = ctx.library.find((e) => e.id === we.exerciseId)?.substitutes.find((id) => compatible(ctx, id) && !usedIds.has(id));
        if (cfg.regression.onDiscomfort === 'substituir' && sub) {
          changes.push({ kind: 'exercicio', dayLabel: day.label, before: nameOf(we.exerciseId), after: nameOf(sub), reason: `Desconforto nível ${st.maxDiscomfort} relatado neste exercício.`, rule: 'regressao.desconforto.substituir', dataUsed });
          usedIds.add(sub);
          return { ...next, exerciseId: sub, suggestedLoadKg: null, notes: 'Substituição por desconforto relatado. Iniciar com carga leve.' };
        }
        const sets = Math.max(2, we.sets - 1);
        changes.push({ kind: 'series', dayLabel: day.label, before: `${we.sets} séries`, after: `${sets} séries`, reason: `Desconforto nível ${st.maxDiscomfort} relatado.`, rule: 'regressao.desconforto.reduzir', dataUsed });
        return { ...next, sets };
      }

      // Esforço acima do limite: reduzir volume.
      if (st.avgRpe != null && st.avgRpe > cfg.regression.rpeAbove) {
        const sets = Math.max(2, we.sets - 1);
        if (sets !== we.sets) {
          changes.push({ kind: 'series', dayLabel: day.label, before: `${we.sets} séries`, after: `${sets} séries`, reason: `RPE médio ${st.avgRpe} acima de ${cfg.regression.rpeAbove}.`, rule: 'regressao.rpe', dataUsed });
        }
        return { ...next, sets };
      }

      // Dados insuficientes: manter.
      if (st.sessions < cfg.progression.minSessions) {
        missing.push(`${nameOf(we.exerciseId)}: ${st.sessions} de ${cfg.progression.minSessions} sessões mínimas para progredir.`);
        return next;
      }

      // Progressão: topo da faixa com esforço controlado.
      if (st.hitTopOfRange && (st.avgRpe == null || st.avgRpe <= cfg.effort.targetRpeMax)) {
        if (st.lastLoadKg != null && st.lastLoadKg > 0) {
          const load = round(st.lastLoadKg * (1 + cfg.progression.loadIncreasePct / 100), 0.5);
          const finalLoad = load > st.lastLoadKg ? load : st.lastLoadKg + 0.5;
          changes.push({ kind: 'carga', dayLabel: day.label, before: `${st.lastLoadKg} kg`, after: `${finalLoad} kg (sugestão)`, reason: `Topo da faixa (${we.repMax} reps) atingido nas últimas sessões com RPE ${st.avgRpe ?? 'não informado'}.`, rule: 'progressao.carga', dataUsed });
          return { ...next, suggestedLoadKg: finalLoad, notes: 'Se não completar a faixa mínima, volte à carga anterior.' };
        }
        const repMax = Math.min(20, we.repMax + 2);
        changes.push({ kind: 'repeticoes', dayLabel: day.label, before: `${we.repMin}–${we.repMax}`, after: `${we.repMin}–${repMax}`, reason: 'Topo da faixa atingido sem carga registrada.', rule: 'progressao.repeticoes', dataUsed });
        return { ...next, repMax };
      }

      // Variação de estímulo: um exercício de isolamento por dia, quando há dados e substituto compatível.
      const lib = ctx.library.find((e) => e.id === we.exerciseId);
      if (!variedThisDay && lib?.pattern === 'isolamento') {
        const sub = lib.substitutes.find((id) => compatible(ctx, id) && !usedIds.has(id));
        if (sub) {
          variedThisDay = true;
          usedIds.add(sub);
          changes.push({ kind: 'exercicio', dayLabel: day.label, before: nameOf(we.exerciseId), after: nameOf(sub), reason: 'Variação de estímulo no novo ciclo, mantendo grupo muscular e volume.', rule: 'ciclo.variacao', dataUsed });
          return { ...next, exerciseId: sub, suggestedLoadKg: null };
        }
      }
      return next;
    });
    return { label: day.label, focus: day.focus, exercises };
  });

  if (ctx.adherencePct != null && ctx.adherencePct < 70) {
    alerts.push(`Adesão de ${ctx.adherencePct}% no ciclo. Progressões foram limitadas.`);
  }
  // Cardio só muda com justificativa nos dados — não apenas porque o prazo venceu.
  const cardio = plan.cardio
    ? { sessionsPerWeek: plan.cardio.sessionsPerWeek, minutes: plan.cardio.minutes, intensity: plan.cardio.intensity, notes: plan.cardio.notes }
    : null;

  return {
    meta: { agentId: ctx.agentId, agentVersion: ctx.agentVersion, schemaVersion: 1 },
    goal: ctx.student.goal,
    weeklyFrequency: plan.weeklyFrequency,
    days,
    cardio,
    changes,
    alerts,
    missingData: missing,
    requiresReview: false,
    summary: changes.length
      ? `${changes.length} ajuste(s) com base nos registros do ciclo. Estrutura e divisão mantidas.`
      : 'Sem dados que justifiquem mudanças. Estrutura mantida.',
  };
}

/**
 * Provedor local e determinístico usado no modo demonstração e nos testes.
 * Produz a mesma estrutura que um modelo de linguagem precisa produzir, e passa
 * pelas mesmas validações.
 */
export class DemoRulesProvider implements AiProvider {
  readonly name = 'demo-regras';
  readonly model = 'korvex-regras-local@1';

  async generate(ctx: AgentContext) {
    const proposal = ctx.mode === 'inicial' || !ctx.currentPlan ? buildInitialProposal(ctx) : buildUpdateProposal(ctx);
    const tokensIn = Math.round(JSON.stringify(ctx).length / 4);
    const tokensOut = Math.round(JSON.stringify(proposal).length / 4);
    return { raw: proposal as unknown, tokensIn, tokensOut };
  }
}

/** Simula falhas para demonstrar os fluxos de erro. */
export class FaultyProvider implements AiProvider {
  readonly name: string;
  readonly model: string;
  constructor(private inner: AiProvider, private mode: 'resposta_invalida' | 'indisponivel') {
    this.name = inner.name;
    this.model = inner.model;
  }
  async generate(ctx: AgentContext, opts: { correction?: string }) {
    if (this.mode === 'indisponivel') throw new AiUnavailableError('Tempo limite excedido ao chamar o provedor (simulado).');
    const res = await this.inner.generate(ctx, opts);
    const raw = structuredClone(res.raw) as Proposal & { extra?: string };
    raw.days[0].exercises[0].exerciseId = 'ex_inventado_pela_ia';
    raw.days[0].exercises[0].sets = -2;
    raw.extra = 'campo inesperado';
    return { ...res, raw };
  }
}

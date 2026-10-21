import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { muscleLabel, weeklySetsByMuscle, type Exercise, type PlanVersion, type ValidationResult, type MuscleGroup } from '@korvex/core';
import { Badge, cx } from './ui';

export function PlanDays({ plan, exercises, compact }: { plan: Pick<PlanVersion, 'days' | 'cardio'>; exercises: Exercise[]; compact?: boolean }) {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  return (
    <div className={cx('grid gap-4', !compact && 'lg:grid-cols-2 2xl:grid-cols-3')}>
      {plan.days.map((d) => (
        <div key={d.id || d.label} className="min-w-0 rounded-xl border border-line bg-surface-2/40">
          <div className="flex items-baseline justify-between gap-2 border-b border-line px-4 py-2.5">
            <h4 className="display-narrow text-lg font-extrabold">{d.label}</h4>
            <span className="truncate text-[12px] text-muted">{d.focus}</span>
          </div>
          <ol className="divide-y divide-line">
            {d.exercises.map((we, i) => {
              const ex = byId.get(we.exerciseId);
              return (
                <li key={we.id || i} className="flex gap-3 px-4 py-2.5">
                  <span className="num mt-0.5 w-4 shrink-0 text-[12px] text-faint">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{ex?.name ?? <span className="text-bad">Exercício desconhecido ({we.exerciseId})</span>}</p>
                    <p className="num text-[12px] text-muted">
                      {we.sets} × {we.repMin}–{we.repMax} · {we.restSec}s · RPE {we.rpeTarget}
                      {we.suggestedLoadKg != null && <span className="text-accent"> · {we.suggestedLoadKg} kg sugeridos</span>}
                    </p>
                    {we.notes && <p className="text-[12px] text-faint">{we.notes}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
      {plan.cardio && (
        <div className="rounded-xl border border-line bg-surface-2/40 px-4 py-3">
          <h4 className="display-narrow text-lg font-extrabold">Cardio</h4>
          <p className="num text-sm">
            {plan.cardio.sessionsPerWeek}x/semana · {plan.cardio.minutes} min · intensidade {plan.cardio.intensity}
          </p>
          {plan.cardio.notes && <p className="text-[12px] text-muted">{plan.cardio.notes}</p>}
        </div>
      )}
    </div>
  );
}

export function VolumeChart({ plan, exercises, max, min }: { plan: Pick<PlanVersion, 'days'>; exercises: Exercise[]; max: number; min: number }) {
  const vol = weeklySetsByMuscle(plan, exercises);
  const data = (Object.keys(muscleLabel) as MuscleGroup[]).map((m) => ({ musculo: muscleLabel[m].replace(' de coxa', ''), series: vol[m] ?? 0 }));
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <XAxis type="number" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, Math.max(max + 2, ...data.map((d) => d.series))]} />
          <YAxis type="category" dataKey="musculo" width={92} interval={0} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: 'var(--surface-2)' }}
            contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--fg)' }}
            formatter={(v) => [`${v} séries/semana`, 'Volume']}
          />
          <ReferenceLine x={max} stroke="var(--bad)" strokeDasharray="4 4" label={{ value: `máx ${max}`, fill: 'var(--bad)', fontSize: 10, position: 'top' }} />
          <ReferenceLine x={min} stroke="var(--faint)" strokeDasharray="2 4" />
          <Bar dataKey="series" fill="var(--accent)" radius={[0, 4, 4, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
      <p className="px-2 text-[11px] text-faint">Músculos secundários contam meia série. Linha tracejada vermelha: limite do agente.</p>
    </div>
  );
}

export function ValidationList({ results }: { results: ValidationResult[] }) {
  if (!results.length) return null;
  return (
    <ul className="flex flex-col gap-1.5">
      {results.map((r) => (
        <li key={r.rule} className="flex items-start gap-2 text-[13px]">
          {r.ok ? (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ok" aria-label="Aprovado" />
          ) : r.severity === 'bloqueio' ? (
            <XCircle size={16} className="mt-0.5 shrink-0 text-bad" aria-label="Bloqueio" />
          ) : (
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warn" aria-label="Aviso" />
          )}
          <span className={cx(r.ok ? 'text-muted' : 'text-fg')}>{r.message}</span>
        </li>
      ))}
    </ul>
  );
}

export function ChangesList({ plan }: { plan: PlanVersion }) {
  if (!plan.changes.length) return <p className="text-[13px] text-muted">Nenhuma mudança registrada nesta versão.</p>;
  const kindLabel = { series: 'Séries', repeticoes: 'Repetições', descanso: 'Descanso', exercicio: 'Exercício', carga: 'Carga', cardio: 'Cardio', frequencia: 'Frequência' };
  return (
    <ul className="flex flex-col gap-2">
      {plan.changes.map((c, i) => (
        <li key={i} className="rounded-lg border border-line bg-surface-2/50 p-3 text-[13px]">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">{kindLabel[c.kind]}</Badge>
            <span className="text-muted">{c.dayLabel}</span>
          </div>
          <p className="mt-1.5">
            <span className="text-muted line-through decoration-faint">{c.before}</span> <span className="text-faint">→</span> <span className="font-semibold">{c.after}</span>
          </p>
          <p className="mt-1 text-muted">{c.reason}</p>
          <p className="num mt-1 text-[11px] text-faint">
            regra: {c.rule} · dados: {c.dataUsed}
          </p>
        </li>
      ))}
    </ul>
  );
}

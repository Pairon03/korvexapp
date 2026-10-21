import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, Check, Circle, Plus, Sparkles, Ruler } from 'lucide-react';
import { formatDate, formatDateTime, getPublished, type CycleState } from '@korvex/core';
import { useStore } from '../../state/store';
import { adherence, cycleProgress, NEEDS_ATTENTION, today, weeklySessions } from '../../derive';
import { Badge, Button, Card, CardHeader, CycleBadge, EmptyState, PageHeader, Select, Stat, LinkButton } from '../../components/ui';

const actionFor: Partial<Record<CycleState, string>> = {
  aguardando_avaliacao: 'Registrar avaliação',
  dados_incompletos: 'Revisar dados',
  suspenso: 'Revisar alerta',
  falhou: 'Ver falha',
  aguardando_validacao: 'Aprovar proposta',
};

export default function Dashboard() {
  const { state } = useStore();
  const [weeks, setWeeks] = useState(8);
  const [agentFilter, setAgentFilter] = useState('todos');
  const t = today(state);

  const students = state.students.filter((s) => agentFilter === 'todos' || s.agentId === agentFilter);
  const ids = new Set(students.map((s) => s.id));
  const cycles = state.cycles.filter((c) => ids.has(c.studentId));
  const openCycles = cycles.filter((c) => !['publicado', 'cancelado'].includes(c.state));
  const active = students.filter((s) => s.status === 'ativo');
  const invited = students.filter((s) => s.status === 'convidado');
  const withPlan = active.filter((s) => getPublished(state, s.id));
  const upcoming = openCycles.filter((c) => {
    const { daysLeft } = cycleProgress(state, c);
    return daysLeft > 0 && daysLeft <= 7;
  });
  const needData = openCycles.filter((c) => c.state === 'aguardando_avaliacao' || c.state === 'dados_incompletos');
  const blocked = openCycles.filter((c) => c.state === 'suspenso' || c.state === 'falhou');
  const published = cycles.filter((c) => c.state === 'publicado');
  const attention = openCycles.filter((c) => (NEEDS_ATTENTION as readonly string[]).includes(c.state));
  const adh = adherence(state, weeks);
  const chart = useMemo(() => weeklySessions(state, weeks), [state, weeks]);
  const nameOf = (id: string) => state.students.find((s) => s.id === id)?.name ?? '—';

  const hasAgent = state.agents.some((a) => a.status === 'ativo');
  const onboarding = [
    { done: true, label: 'Conta criada e e-mail verificado' },
    { done: hasAgent, label: 'Agente configurado com regras mínimas' },
    { done: state.students.length > 0, label: 'Primeiro aluno cadastrado' },
    { done: state.plans.length > 0, label: 'Primeiro treino publicado' },
    { done: state.cycles.length > 0, label: 'Ciclo de reavaliação ativo' },
    { done: state.subscription.status === 'ativa', label: 'Assinatura confirmada pelo provedor de pagamento' },
  ];
  const pending = onboarding.filter((o) => !o.done).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={formatDate(state.now)}
        title={`Olá, ${state.trainer.name.split(' ')[0]}`}
        subtitle="Todos os números abaixo são calculados a partir dos registros desta conta."
        actions={
          <>
            <LinkButton to="/personal/alunos/novo" variant="primary">
                <Plus size={16} /> Novo aluno
              </LinkButton>
            <LinkButton to="/personal/ciclos">Ver ciclos</LinkButton>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="f-agent" className="text-[13px] text-muted">
          Agente
        </label>
        <Select id="f-agent" value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="w-auto">
          <option value="todos">Todos</option>
          {state.agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.versions.find((v) => v.version === a.currentVersion)?.config.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Alunos ativos" value={active.length} hint={`${invited.length} convite(s) pendente(s)`} />
        <Stat label="Treinos publicados" value={withPlan.length} hint={`${active.length - withPlan.length} aluno(s) sem treino`} />
        <Stat label="Reavaliações em 7 dias" value={upcoming.length} hint="Alunos já avisados pelo app" />
        <Stat label="Adesão" value={adh.pct != null ? `${adh.pct}%` : '—'} hint={`${adh.done} de ${adh.expected} sessões em ${weeks} semanas`} tone={adh.pct != null && adh.pct < 60 ? 'warn' : undefined} />
        <Stat label="Ciclos que precisam de dados" value={needData.length} tone={needData.length ? 'warn' : undefined} />
        <Stat label="Atualizações bloqueadas" value={blocked.length} tone={blocked.length ? 'bad' : undefined} hint="Suspensas ou com falha" />
        <Stat label="Aguardando sua aprovação" value={openCycles.filter((c) => c.state === 'aguardando_validacao').length} tone="accent" />
        <Stat label="Atualizações publicadas" value={published.length} tone="ok" hint="Desde o início da conta" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Pendências"
            subtitle="Ciclos que não podem avançar sem você. O treino vigente de cada aluno continua valendo."
          />
          {attention.length === 0 ? (
            <EmptyState title="Nada pendente">Quando um ciclo for bloqueado ou precisar de aprovação, ele aparece aqui.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {attention.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{nameOf(c.studentId)}</span>
                      <CycleBadge state={c.state} />
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{c.blockReasons[0] ?? c.events[c.events.length - 1]?.message}</p>
                  </div>
                  <LinkButton to={`/personal/alunos/${c.studentId}?aba=ciclo`} size="sm">
                      {actionFor[c.state]} <ArrowRight size={14} />
                    </LinkButton>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Configuração da conta" subtitle={pending ? `${pending} item(ns) para liberar todos os recursos automáticos` : 'Tudo configurado'} />
          <ul className="flex flex-col gap-2.5 px-4 py-4 sm:px-5">
            {onboarding.map((o) => (
              <li key={o.label} className="flex items-start gap-2.5 text-sm">
                {o.done ? <Check size={17} className="mt-0.5 shrink-0 text-ok" /> : <Circle size={17} className="mt-0.5 shrink-0 text-faint" />}
                <span className={o.done ? 'text-muted' : 'font-semibold'}>{o.label}</span>
              </li>
            ))}
          </ul>
          {state.subscription.status !== 'ativa' && (
            <p className="border-t border-line px-5 py-3 text-[12px] text-muted">
              Período de teste até {formatDate(state.subscription.currentPeriodEnd)}. A publicação automática segue ativa durante o teste.
            </p>
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Sessões concluídas por semana"
            subtitle="Todas as sessões registradas pelos alunos"
            action={
              <Select aria-label="Período" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="h-8 w-auto text-[13px]">
                <option value={4}>4 semanas</option>
                <option value={8}>8 semanas</option>
                <option value={12}>12 semanas</option>
              </Select>
            }
          />
          <div className="h-64 px-2 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'var(--surface-2)' }}
                  contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--fg)' }}
                  formatter={(v) => [v, 'Sessões']}
                  labelFormatter={(l) => `Semana de ${l}`}
                />
                <Bar dataKey="sessoes" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Atividade recente" />
          {state.audit.length === 0 ? (
            <EmptyState title="Sem atividade ainda">
              Use <strong>Executar agendador</strong> na barra superior para processar os ciclos que vencem hoje.
            </EmptyState>
          ) : (
            <ul className="flex max-h-72 flex-col overflow-y-auto">
              {state.audit.slice(0, 14).map((a) => (
                <li key={a.id} className="border-b border-line px-5 py-2.5 text-[13px] last:border-0">
                  <p>
                    <span className="font-semibold">{a.actor}</span> <span className="text-muted">{a.action.replaceAll('_', ' ')}</span>
                  </p>
                  {a.detail && <p className="text-muted">{a.detail}</p>}
                  <p className="num text-[11px] text-faint">{formatDateTime(a.at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link to="/personal/alunos/novo" className="group rounded-xl border border-line bg-surface p-4 hover:border-accent/50">
          <Plus className="mb-2 text-accent" size={20} />
          <p className="font-semibold">Cadastrar aluno</p>
          <p className="text-[13px] text-muted">Envie o convite e gere o primeiro treino.</p>
        </Link>
        <Link to="/personal/alunos" className="group rounded-xl border border-line bg-surface p-4 hover:border-accent/50">
          <Sparkles className="mb-2 text-accent" size={20} />
          <p className="font-semibold">Gerar treino com IA</p>
          <p className="text-[13px] text-muted">A proposta passa pelas validações antes de publicar.</p>
        </Link>
        <Link to="/personal/alunos" className="group rounded-xl border border-line bg-surface p-4 hover:border-accent/50">
          <Ruler className="mb-2 text-accent" size={20} />
          <p className="font-semibold">Registrar avaliação</p>
          <p className="text-[13px] text-muted">Peso, medidas e dobras. Fotos são opcionais.</p>
        </Link>
      </div>
      <p className="text-[12px] text-faint">
        Data de referência dos indicadores: {formatDate(t)} · <Badge>fuso {state.trainer.timezone}</Badge>
      </p>
    </div>
  );
}

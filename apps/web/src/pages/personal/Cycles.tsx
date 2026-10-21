import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { cycleStateLabel, formatDate, formatDateTime, type CycleState } from '@korvex/core';
import { useStore } from '../../state/store';
import { cycleProgress } from '../../derive';
import { Button, Card, CardHeader, CycleBadge, EmptyState, PageHeader, Progress, Select, cx, cycleTone, LinkButton } from '../../components/ui';

const FLOW: { title: string; detail: string; states: CycleState[] }[] = [
  { title: 'Acompanhamento', detail: 'O aluno treina e registra cargas, repetições, esforço e desconfortos.', states: ['agendado', 'em_acompanhamento'] },
  { title: 'Reavaliação', detail: 'Na data prevista, o sistema pede a avaliação. Fotos nunca são exigidas.', states: ['aguardando_avaliacao'] },
  { title: 'Checagem de dados', detail: 'Adesão mínima, sessões registradas, consistência de medidas e relatos de dor.', states: ['dados_incompletos'] },
  { title: 'Proposta da IA', detail: 'O agente recebe só os dados necessários e devolve JSON no contrato.', states: ['em_processamento'] },
  { title: 'Validação', detail: 'Regras determinísticas: biblioteca, limitações, volume, magnitude da mudança.', states: ['suspenso', 'falhou'] },
  { title: 'Publicação', detail: 'Automática se tudo passou e o personal autorizou; senão, aguarda aprovação.', states: ['aguardando_validacao', 'publicado'] },
];

export default function Cycles() {
  const { state } = useStore();
  const [filter, setFilter] = useState<'abertos' | CycleState | 'todos'>('abertos');
  const nameOf = (id: string) => state.students.find((s) => s.id === id)?.name ?? '—';
  const open = state.cycles.filter((c) => !['publicado', 'cancelado'].includes(c.state));
  const rows = state.cycles
    .filter((c) => (filter === 'todos' ? true : filter === 'abertos' ? !['publicado', 'cancelado'].includes(c.state) : c.state === filter))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ciclos de treinamento"
        subtitle="A cada 45 dias (ou o intervalo do agente), o agendador do servidor revisa cada aluno. Qualquer falha mantém o treino vigente."
      />

      <Card>
        <CardHeader title="Como uma atualização acontece" subtitle="Números mostram quantos ciclos abertos estão em cada etapa agora." />
        <ol className="grid gap-px overflow-hidden bg-line sm:grid-cols-2 xl:grid-cols-6">
          {FLOW.map((step, i) => {
            const count = (step.title === 'Publicação' ? state.cycles : open).filter((c) => step.states.includes(c.state)).length;
            return (
              <li key={step.title} className="flex flex-col gap-1.5 bg-surface p-4">
                <div className="flex items-center justify-between">
                  <span className="num text-[12px] text-faint">etapa {i + 1}</span>
                  <span className="num text-lg font-semibold">{count}</span>
                </div>
                <p className="font-bold">{step.title}</p>
                <p className="text-[12px] text-muted">{step.detail}</p>
                <div className="mt-auto flex flex-wrap gap-1 pt-1">
                  {step.states.map((s) => (
                    <button key={s} onClick={() => setFilter(s)} className="rounded focus-visible:outline-2">
                      <CycleBadge state={s} />
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      <Card>
        <CardHeader
          title="Ciclos"
          action={
            <Select aria-label="Filtrar ciclos" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="h-8 w-auto text-[13px]">
              <option value="abertos">Em aberto</option>
              <option value="todos">Todos</option>
              {(Object.keys(cycleStateLabel) as CycleState[]).map((s) => (
                <option key={s} value={s}>
                  {cycleStateLabel[s]}
                </option>
              ))}
            </Select>
          }
        />
        {rows.length === 0 ? (
          <EmptyState title="Nenhum ciclo neste filtro" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead>
                <tr className="text-left text-[12px] text-muted">
                  <th className="px-5 py-2 font-semibold">Aluno</th>
                  <th className="py-2 font-semibold">Estado</th>
                  <th className="w-48 py-2 font-semibold">Progresso</th>
                  <th className="py-2 font-semibold">Reavaliação</th>
                  <th className="py-2 font-semibold">Último evento</th>
                  <th className="px-5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const p = cycleProgress(state, c);
                  const last = c.events[c.events.length - 1];
                  return (
                    <tr key={c.id} className="border-t border-line align-top">
                      <td className="px-5 py-3 font-semibold">{nameOf(c.studentId)}</td>
                      <td className="py-3">
                        <CycleBadge state={c.state} />
                        {c.paused && <p className="mt-1 text-[11px] text-warn">Pausado</p>}
                      </td>
                      <td className="py-3 pr-4">
                        <Progress value={p.elapsed} max={p.total} tone={cycleTone[c.state] === 'bad' ? 'bad' : p.daysLeft <= 0 ? 'warn' : 'accent'} label="Progresso" />
                        <p className="num mt-1 text-[11px] text-muted">
                          dia {p.elapsed}/{p.total}
                        </p>
                      </td>
                      <td className="num py-3">{formatDate(c.dueDate)}</td>
                      <td className="max-w-xs py-3 text-muted">
                        <p className="line-clamp-2">{last?.message}</p>
                        <p className="num text-[11px] text-faint">{last && formatDateTime(last.at)}</p>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <LinkButton to={`/personal/alunos/${c.studentId}?aba=ciclo`} size="sm">Abrir</LinkButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export function Notifications() {
  const { state, run } = useStore();
  const list = state.notifications.filter((n) => n.audience === 'personal');
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Avisos"
        subtitle="Notificações internas. O e-mail correspondente sai pela fila de envio, sem medidas, fotos ou dados de saúde no texto."
        actions={
          <Button onClick={() => run((d) => d.notifications.forEach((n) => n.audience === 'personal' && (n.read = true)), 'Todos marcados como lidos.')}>
            <CheckCheck size={15} /> Marcar todos como lidos
          </Button>
        }
      />
      <Card>
        {list.length === 0 ? (
          <EmptyState icon={<Bell size={28} />} title="Sem avisos">
            Execute o agendador na barra superior para gerar eventos de ciclo.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((n) => (
              <li key={n.id} className={cx('flex gap-3 px-5 py-3', !n.read && 'bg-accent-soft/40')}>
                <span className={cx('mt-2 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-accent')} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{n.title}</p>
                  <p className="text-[13px] text-muted">{n.body}</p>
                  <p className="num text-[11px] text-faint">{formatDateTime(n.createdAt)}</p>
                </div>
                {n.studentId && (
                  <LinkButton to={`/personal/alunos/${n.studentId}?aba=ciclo`} onClick={() => run((d) => void (d.notifications.find((x) => x.id === n.id)!.read = true))} size="sm" variant="ghost">
                      Ver
                    </LinkButton>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

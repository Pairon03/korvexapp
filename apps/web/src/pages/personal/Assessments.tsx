import { Link } from 'react-router-dom';
import { Ruler } from 'lucide-react';
import { daysBetween, formatDate, latestAssessments } from '@korvex/core';
import { useStore } from '../../state/store';
import { Badge, Card, EmptyState, PageHeader } from '../../components/ui';

/** Visão geral das reavaliações: quem está em dia e quem precisa ser avaliado antes do fim do ciclo. */
export default function Assessments() {
  const { state } = useStore();
  const rows = state.students
    .filter((s) => s.status !== 'arquivado')
    .map((s) => {
      const last = latestAssessments(state.assessments, s.id)[0];
      const days = last ? daysBetween(last.date, state.now) : null;
      const cycle = state.cycles.filter((c) => c.studentId === s.id && !['publicado', 'cancelado'].includes(c.state)).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
      const tone: 'ok' | 'warn' | 'bad' = days === null || days > 45 ? 'bad' : days > 30 ? 'warn' : 'ok';
      return { s, last, days, cycle, tone };
    })
    .sort((a, b) => (b.days ?? 9999) - (a.days ?? 9999));
  const pending = rows.filter((r) => r.tone === 'bad').length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Avaliações"
        subtitle={`Medidas mais recentes de cada aluno. ${pending ? `${pending} precisa(m) de reavaliação antes do próximo ciclo.` : 'Todos estão em dia.'} Fotos nunca são exigidas.`}
      />
      {rows.length === 0 ? (
        <EmptyState icon={<Ruler />} title="Nenhum aluno ativo" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[620px] text-[14px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                <th className="px-4 py-2.5 font-semibold">Aluno</th>
                <th className="py-2.5 font-semibold">Última avaliação</th>
                <th className="py-2.5 font-semibold">Peso</th>
                <th className="py-2.5 font-semibold">Fim do ciclo</th>
                <th className="px-4 py-2.5 font-semibold">Situação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ s, last, days, cycle, tone }) => (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link to={`/personal/alunos/${s.id}?aba=avaliacoes`} className="font-semibold hover:text-accent">
                      {s.name}
                    </Link>
                  </td>
                  <td className="num py-3">{last ? `${formatDate(last.date)} · há ${days} d` : '—'}</td>
                  <td className="num py-3">{last?.weightKg != null ? `${last.weightKg.toLocaleString('pt-BR')} kg` : '—'}</td>
                  <td className="num py-3">{cycle ? formatDate(cycle.dueDate) : '—'}</td>
                  <td className="px-4 py-3">
                    <Badge tone={tone}>{tone === 'ok' ? 'Em dia' : tone === 'warn' ? 'Reavaliar em breve' : last ? 'Vencida' : 'Sem avaliação'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

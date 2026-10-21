import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { audit, formatBRL, formatDateTime, type SubscriptionPlan } from '@korvex/core';
import { useStore } from '../../state/store';
import { Badge, Button, Callout, Card, CardHeader, EmptyState, Input, PageHeader, Select, Stat, Tabs } from '../../components/ui';

type Tab = 'visao' | 'ia' | 'planos' | 'auditoria' | 'config';

export default function Admin() {
  const { state, run } = useStore();
  const [tab, setTab] = useState<Tab>('visao');
  const plan = state.subscriptionPlans.find((p) => p.id === state.subscription.planId)!;
  const runs = state.aiRuns;
  const failures = runs.filter((r) => r.status !== 'sucesso');
  const cost = runs.reduce((a, r) => a + r.costCents, 0);
  const cycles = state.cycles;

  return (
    <div className="gutter mx-auto flex max-w-6xl flex-col gap-5 py-6">
      <Link to="/" className="flex w-fit items-center gap-1 text-[13px] text-muted hover:text-fg">
        <ArrowLeft size={14} /> Site
      </Link>
      <PageHeader
        eyebrow="Equipe Korvex"
        title="Administração da plataforma"
        subtitle="Visão agregada. Conteúdo de treinos, avaliações e fotos dos alunos não aparece aqui por padrão; acesso de suporte exige finalidade e fica registrado."
      />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'visao', label: 'Visão geral' },
          { id: 'ia', label: 'Execuções de IA', count: runs.length },
          { id: 'planos', label: 'Planos' },
          { id: 'auditoria', label: 'Auditoria', count: state.audit.length },
          { id: 'config', label: 'Configurações' },
        ]}
      />

      {tab === 'visao' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Contas (tenants)" value={1} hint="Somente a conta de demonstração" />
            <Stat label="Assinaturas ativas" value={state.subscription.status === 'ativa' ? 1 : 0} hint={`1 em ${state.subscription.status}`} />
            <Stat label="Receita recorrente" value={state.subscription.status === 'ativa' ? formatBRL(plan.priceCents) : formatBRL(0)} hint="Calculada, não confirmada pelo provedor" />
            <Stat label="Custo estimado de IA" value={formatBRL(Math.round(cost))} hint={`${runs.length} execução(ões), preço de referência`} />
            <Stat label="Atualizações publicadas" value={cycles.filter((c) => c.state === 'publicado').length} tone="ok" />
            <Stat label="Atualizações suspensas" value={cycles.filter((c) => c.state === 'suspenso').length} tone="warn" />
            <Stat label="Falhas de IA" value={failures.length} tone={failures.length ? 'bad' : undefined} />
            <Stat label="Ciclos com tentativas esgotadas" value={cycles.filter((c) => c.state === 'falhou' && c.attempts >= 3).length} tone="bad" />
          </div>
          <Callout tone="neutral">Valores financeiros calculados são separados de dados confirmados. Em produção, a receita confirmada vem da reconciliação com o Mercado Pago.</Callout>
        </div>
      )}

      {tab === 'ia' && (
        <Card>
          {runs.length === 0 ? (
            <EmptyState title="Nenhuma execução de IA ainda">Execute o agendador ou gere um treino para ver as execuções aqui.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="num w-full min-w-[760px] text-[12px]">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="px-4 py-2">Execução</th>
                    <th className="py-2">Quando</th>
                    <th className="py-2">Modelo</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 text-right">Tentativas</th>
                    <th className="py-2 text-right">Tokens</th>
                    <th className="px-4 py-2 text-right">Custo est.</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-t border-line align-top">
                      <td className="px-4 py-2">
                        {r.id}
                        {r.errors.length > 0 && <p className="mt-1 max-w-xs font-sans text-bad">{r.errors[r.errors.length - 1]}</p>}
                      </td>
                      <td className="py-2">{formatDateTime(r.startedAt)}</td>
                      <td className="py-2">{r.model}</td>
                      <td className="py-2 font-sans">
                        <Badge tone={r.status === 'sucesso' ? 'ok' : 'bad'}>{r.status.replace('_', ' ')}</Badge>
                      </td>
                      <td className="py-2 text-right">{r.attempts}</td>
                      <td className="py-2 text-right">
                        {r.tokensIn} / {r.tokensOut}
                      </td>
                      <td className="px-4 py-2 text-right">{formatBRL(Math.round(r.costCents))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'planos' && <PlansEditor />}

      {tab === 'auditoria' && (
        <Card>
          {state.audit.length === 0 ? (
            <EmptyState title="Sem eventos" />
          ) : (
            <ul className="divide-y divide-line">
              {state.audit.map((a) => (
                <li key={a.id} className="grid gap-1 px-5 py-2.5 text-[13px] sm:grid-cols-[150px_160px_1fr]">
                  <span className="num text-faint">{formatDateTime(a.at)}</span>
                  <span className="font-semibold">{a.actor}</span>
                  <span className="text-muted">
                    {a.action.replaceAll('_', ' ')} · <span className="num">{a.entity}</span> {a.detail && `· ${a.detail}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'config' && (
        <Card>
          <CardHeader title="Simulação de falhas do provedor de IA" subtitle="Usado para testar os fluxos de erro. Afeta geração inicial e ciclos." />
          <div className="flex flex-col gap-3 p-5">
            <Select
              aria-label="Modo do provedor de IA"
              value={state.settings.aiFailureMode}
              onChange={(e) => run((d) => void (d.settings.aiFailureMode = e.target.value as typeof d.settings.aiFailureMode), 'Configuração aplicada.')}
              className="max-w-sm"
            >
              <option value="nenhuma">Funcionando normalmente</option>
              <option value="resposta_invalida">Responder fora do contrato</option>
              <option value="indisponivel">Indisponível (timeout)</option>
            </Select>
            <p className="text-[13px] text-muted">
              Provedor atual: motor local de regras (demonstração). Em produção: <span className="num">AI_PROVIDER</span>, <span className="num">AI_MODEL</span> e{' '}
              <span className="num">AI_API_KEY</span> no servidor.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

function PlansEditor() {
  const { state, run } = useStore();
  const [drafts, setDrafts] = useState<SubscriptionPlan[]>(() => structuredClone(state.subscriptionPlans));
  const set = (id: string, patch: Partial<SubscriptionPlan>) => setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  return (
    <Card>
      <CardHeader
        title="Planos comerciais"
        subtitle="Preços em centavos de real; limites aplicados no servidor."
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              run((d) => {
                for (const p of drafts) if (p.priceCents < 0 || p.maxActiveStudents < 1) throw new Error(`Valores inválidos no plano ${p.name}.`);
                d.subscriptionPlans = structuredClone(drafts);
                audit(d, 'admin', 'editou_planos', 'planos', drafts.map((p) => `${p.name} ${p.priceCents}`).join(', '));
              }, 'Planos atualizados.')
            }
          >
            Salvar
          </Button>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-[13px]">
          <thead>
            <tr className="text-left text-[12px] text-muted">
              <th className="px-5 py-2">Plano</th>
              <th className="py-2">Preço (centavos)</th>
              <th className="py-2">Alunos ativos</th>
              <th className="px-5 py-2">IA/mês</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="px-5 py-2 font-semibold">{p.name}</td>
                <td className="py-2 pr-3">
                  <Input aria-label={`Preço ${p.name}`} type="number" value={p.priceCents} onChange={(e) => set(p.id, { priceCents: Math.round(Number(e.target.value)) })} className="num h-8" />
                  <span className="num text-[11px] text-faint">{formatBRL(p.priceCents)}</span>
                </td>
                <td className="py-2 pr-3">
                  <Input aria-label={`Alunos ${p.name}`} type="number" value={p.maxActiveStudents} onChange={(e) => set(p.id, { maxActiveStudents: Number(e.target.value) })} className="num h-8" />
                </td>
                <td className="px-5 py-2">
                  <Input aria-label={`IA ${p.name}`} type="number" value={p.aiRunsPerMonth} onChange={(e) => set(p.id, { aiRunsPerMonth: Number(e.target.value) })} className="num h-8" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

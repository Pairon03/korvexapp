import { useMemo, useState } from 'react';
import { Plus, Search, CreditCard, ExternalLink } from 'lucide-react';
import {
  audit,
  currentPlanLimits,
  equipmentLabel,
  formatBRL,
  formatDate,
  muscleLabel,
  nextId,
  patternLabel,
  regionLabel,
  type Equipment,
  type Exercise,
  type MovementPattern,
  type MuscleGroup,
  type Subscription,
} from '@korvex/core';
import { useStore } from '../../state/store';
import { Badge, Button, Callout, Card, CardHeader, EmptyState, Field, Input, Modal, PageHeader, Progress, Select, Textarea, cx } from '../../components/ui';

export default function Library() {
  const { state, run } = useStore();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | ''>('');
  const [equip, setEquip] = useState<Equipment | ''>('');
  const [pattern, setPattern] = useState<MovementPattern | ''>('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const byId = new Map(state.exercises.map((e) => [e.id, e]));

  const list = useMemo(
    () =>
      state.exercises.filter(
        (e) =>
          (!q || e.name.toLowerCase().includes(q.toLowerCase())) &&
          (!muscle || e.primary === muscle || e.secondary.includes(muscle)) &&
          (!equip || e.equipment.includes(equip)) &&
          (!pattern || e.pattern === pattern),
      ),
    [state.exercises, q, muscle, equip, pattern],
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Biblioteca de exercícios"
        subtitle="A IA só pode escolher exercícios desta biblioteca. Textos próprios; mídia só com licença registrada."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> Exercício próprio
          </Button>
        }
      />
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
          <Input aria-label="Buscar exercício" placeholder="Buscar por nome" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select aria-label="Grupo muscular" value={muscle} onChange={(e) => setMuscle(e.target.value as MuscleGroup | '')} className="w-auto">
          <option value="">Todos os grupos</option>
          {Object.entries(muscleLabel).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select aria-label="Equipamento" value={equip} onChange={(e) => setEquip(e.target.value as Equipment | '')} className="w-auto">
          <option value="">Todos os equipamentos</option>
          {Object.entries(equipmentLabel).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select aria-label="Padrão de movimento" value={pattern} onChange={(e) => setPattern(e.target.value as MovementPattern | '')} className="w-auto">
          <option value="">Todos os padrões</option>
          {Object.entries(patternLabel).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </div>
      <p className="text-[13px] text-muted">{list.length} exercício(s)</p>
      {list.length === 0 ? (
        <Card>
          <EmptyState title="Nenhum exercício com esses filtros" />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((e) => (
            <Card key={e.id} as="article" className={cx('flex flex-col', !e.active && 'opacity-60')}>
              <button onClick={() => setOpenId(openId === e.id ? null : e.id)} className="flex flex-col gap-2 p-4 text-left" aria-expanded={openId === e.id}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold">{e.name}</p>
                  <span className="num shrink-0 text-[11px] text-faint" title="Complexidade">
                    {'●'.repeat(e.complexity)}
                    {'○'.repeat(3 - e.complexity)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge tone="accent">{muscleLabel[e.primary]}</Badge>
                  <Badge>{patternLabel[e.pattern]}</Badge>
                  {e.custom && <Badge tone="info">Próprio</Badge>}
                  {!e.active && <Badge>Desativado</Badge>}
                  {e.cautionRegions.map((r) => (
                    <Badge key={r} tone="warn">
                      Cuidado: {regionLabel[r]}
                    </Badge>
                  ))}
                </div>
                <p className="text-[12px] text-muted">{e.equipment.map((x) => equipmentLabel[x]).join(' · ')}</p>
              </button>
              {openId === e.id && (
                <div className="flex flex-col gap-2 border-t border-line p-4 text-[13px]">
                  <p>{e.instructions}</p>
                  {e.commonErrors.length > 0 && (
                    <p className="text-muted">
                      <strong className="text-fg">Erros comuns:</strong> {e.commonErrors.join('; ')}.
                    </p>
                  )}
                  {e.substitutes.length > 0 && (
                    <p className="text-muted">
                      <strong className="text-fg">Substituições:</strong> {e.substitutes.map((s) => byId.get(s)?.name).filter(Boolean).join(', ')}
                    </p>
                  )}
                  <p className="text-[12px] text-faint">Mídia: nenhuma vinculada · status {e.validated ? 'validado' : 'em revisão'}</p>
                  <div>
                    <Button
                      size="sm"
                      variant={e.active ? 'danger' : 'secondary'}
                      onClick={() =>
                        run((d) => {
                          const x = d.exercises.find((y) => y.id === e.id)!;
                          x.active = !x.active;
                          audit(d, d.trainer.name, x.active ? 'reativou_exercicio' : 'desativou_exercicio', `exercicio:${x.id}`, x.name);
                        }, e.active ? 'Exercício desativado. Novos treinos não poderão usá-lo.' : 'Exercício reativado.')
                      }
                    >
                      {e.active ? 'Desativar' : 'Reativar'}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      <NewExercise open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function NewExercise({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { run } = useStore();
  const [name, setName] = useState('');
  const [primary, setPrimary] = useState<MuscleGroup>('peito');
  const [pattern, setPattern] = useState<MovementPattern>('isolamento');
  const [equipment, setEquipment] = useState<Equipment>('halteres');
  const [instructions, setInstructions] = useState('');
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 3) return setError('Informe o nome do exercício.');
    if (instructions.trim().length < 10) return setError('Descreva a execução em pelo menos uma frase.');
    const ok = await run((d) => {
      if (d.exercises.some((x) => x.name.toLowerCase() === name.trim().toLowerCase())) throw new Error('Já existe um exercício com esse nome.');
      const ex: Exercise = {
        id: nextId(d, 'ex_custom'),
        name: name.trim(),
        altNames: [],
        primary,
        secondary: [],
        pattern,
        equipment: [equipment],
        complexity: 1,
        instructions: instructions.trim(),
        commonErrors: [],
        cautionRegions: [],
        substitutes: [],
        custom: true,
        active: true,
        validated: false,
      };
      d.exercises.push(ex);
      audit(d, d.trainer.name, 'criou_exercicio', `exercicio:${ex.id}`, ex.name);
      return ex;
    }, 'Exercício criado. Ele já pode ser usado nos treinos.');
    if (ok) {
      setName('');
      setInstructions('');
      setError('');
      onClose();
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Novo exercício próprio">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Nome" htmlFor="ne-name">
          <Input id="ne-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Grupo principal" htmlFor="ne-m">
            <Select id="ne-m" value={primary} onChange={(e) => setPrimary(e.target.value as MuscleGroup)}>
              {Object.entries(muscleLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Padrão" htmlFor="ne-p">
            <Select id="ne-p" value={pattern} onChange={(e) => setPattern(e.target.value as MovementPattern)}>
              {Object.entries(patternLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Equipamento" htmlFor="ne-e">
          <Select id="ne-e" value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
            {Object.entries(equipmentLabel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Instruções de execução" htmlFor="ne-i">
          <Textarea id="ne-i" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </Field>
        {error && (
          <p role="alert" className="text-[13px] text-bad">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary">
            Criar exercício
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const subLabel: Record<Subscription['status'], string> = { teste: 'Período de teste', ativa: 'Ativa', inadimplente: 'Pagamento pendente', cancelada: 'Cancelada' };
const subTone = { teste: 'info', ativa: 'ok', inadimplente: 'bad', cancelada: 'neutral' } as const;

export function SubscriptionPage() {
  const { state, run } = useStore();
  const { plan, students, aiRuns } = currentPlanLimits(state);
  const [checkout, setCheckout] = useState<string | null>(null);
  const target = state.subscriptionPlans.find((p) => p.id === checkout);
  const simulate = (status: Subscription['status']) =>
    run((d) => {
      d.subscription.status = status;
      audit(d, 'webhook (simulado)', 'assinatura_atualizada', 'assinatura', status);
    }, `Evento simulado: assinatura ${subLabel[status].toLowerCase()}.`);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Assinatura" subtitle="O estado da assinatura só muda por evento assinado do provedor de pagamento ou consulta autenticada, nunca pelo retorno do navegador." />
      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader title={`Plano ${plan.name}`} action={<Badge tone={subTone[state.subscription.status]}>{subLabel[state.subscription.status]}</Badge>} />
          <div className="flex flex-col gap-4 p-5">
            <p className="num text-2xl font-semibold">
              {formatBRL(plan.priceCents)}
              <span className="font-sans text-sm font-normal text-muted">/mês</span>
            </p>
            <p className="text-[13px] text-muted">Período atual até {formatDate(state.subscription.currentPeriodEnd)} · provedor: Mercado Pago</p>
            <div>
              <div className="mb-1 flex justify-between text-[13px]">
                <span>Alunos ativos</span>
                <span className="num">
                  {students}/{plan.maxActiveStudents}
                </span>
              </div>
              <Progress value={students} max={plan.maxActiveStudents} tone={students / plan.maxActiveStudents > 0.9 ? 'warn' : 'accent'} label="Alunos ativos" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[13px]">
                <span>Execuções de IA neste mês</span>
                <span className="num">
                  {aiRuns}/{plan.aiRunsPerMonth}
                </span>
              </div>
              <Progress value={aiRuns} max={plan.aiRunsPerMonth} tone="info" label="Execuções de IA" />
            </div>
            {state.subscription.status === 'inadimplente' && (
              <Callout tone="bad" title="Pagamento pendente">
                As atualizações automáticas ficam suspensas até a confirmação. Nenhum dado é apagado.
              </Callout>
            )}
          </div>
        </Card>
        <div className="grid gap-3 sm:grid-cols-3">
          {state.subscriptionPlans.map((p) => (
            <div key={p.id} className={cx('flex flex-col gap-3 rounded-xl border p-4', p.id === plan.id ? 'border-accent/60 bg-accent-soft/40' : 'border-line bg-surface')}>
              <p className="display-narrow text-xl font-extrabold">{p.name}</p>
              <p className="num text-lg font-semibold">{formatBRL(p.priceCents)}</p>
              <ul className="flex flex-1 flex-col gap-1 text-[13px] text-muted">
                {p.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
              <Button size="sm" variant={p.id === plan.id ? 'ghost' : 'secondary'} disabled={p.id === plan.id} onClick={() => setCheckout(p.id)}>
                {p.id === plan.id ? 'Plano atual' : 'Mudar para este'}
              </Button>
            </div>
          ))}
        </div>
      </div>
      <Card>
        <CardHeader title="Simulação de eventos do provedor" subtitle="Somente nesta demonstração. Em produção, estes estados chegam por webhook assinado e idempotente." />
        <div className="flex flex-wrap gap-2 p-5">
          <Button size="sm" onClick={() => simulate('ativa')}>
            Pagamento aprovado
          </Button>
          <Button size="sm" onClick={() => simulate('inadimplente')}>
            Falha na cobrança
          </Button>
          <Button size="sm" onClick={() => simulate('cancelada')}>
            Cancelamento
          </Button>
          <Button size="sm" variant="ghost" onClick={() => simulate('teste')}>
            Voltar ao teste
          </Button>
        </div>
      </Card>
      <Modal open={!!target} onClose={() => setCheckout(null)} title={`Mudar para ${target?.name ?? ''}`}>
        <div className="flex flex-col gap-4 text-sm">
          <p className="text-muted">
            O checkout hospedado do Mercado Pago ainda não está configurado neste ambiente. Quando estiver, este botão abre o pagamento em uma página segura do provedor e o plano só muda
            depois que o webhook confirmar.
          </p>
          <Callout tone="warn" icon={<CreditCard size={18} className="text-warn" />}>
            Credenciais necessárias: <span className="num">MP_ACCESS_TOKEN</span>, <span className="num">MP_WEBHOOK_SECRET</span> e os IDs dos planos no Mercado Pago.
          </Callout>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCheckout(null)}>
              Fechar
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                run((d) => {
                  d.subscription.planId = target!.id;
                  audit(d, 'webhook (simulado)', 'plano_alterado', 'assinatura', target!.name);
                }, `Plano alterado para ${target!.name} (simulação).`).then(() => setCheckout(null))
              }
            >
              <ExternalLink size={14} /> Simular confirmação
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

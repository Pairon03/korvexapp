import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Users } from 'lucide-react';
import {
  createStudent,
  equipmentLabel,
  goalLabel,
  levelLabel,
  regionLabel,
  StudentFormSchema,
  formatDate,
  type BodyRegion,
  type Equipment,
  type StudentForm,
} from '@korvex/core';
import { useStore } from '../../state/store';
import { cycleProgress, initials, studentSummary } from '../../derive';
import { Badge, Button, Card, Callout, CycleBadge, EmptyState, Field, Input, PageHeader, Progress, Select, Textarea, Toggle, cx, LinkButton } from '../../components/ui';

const statusTone = { ativo: 'ok', convidado: 'info', inativo: 'neutral', arquivado: 'neutral' } as const;
const statusLabel = { ativo: 'Ativo', convidado: 'Convite pendente', inativo: 'Inativo', arquivado: 'Arquivado' } as const;
const PAGE = 8;

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span className="display-wide flex shrink-0 items-center justify-center rounded-full bg-surface-3 text-[12px] font-bold text-muted" style={{ width: size, height: size }} aria-hidden>
      {initials(name)}
    </span>
  );
}

export default function Students() {
  const { state } = useStore();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ativos');
  const [agent, setAgent] = useState('todos');
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return state.students
      .filter((s) => (status === 'ativos' ? s.status !== 'arquivado' : status === 'todos' ? true : s.status === status))
      .filter((s) => agent === 'todos' || s.agentId === agent)
      .filter((s) => !term || s.name.toLowerCase().includes(term) || s.email.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.students, q, status, agent]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const visible = rows.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Alunos"
        subtitle="Cada aluno acessa apenas os próprios dados, por convite vinculado à sua conta."
        actions={
          <LinkButton to="/personal/alunos/novo" variant="primary">
              <Plus size={16} /> Novo aluno
            </LinkButton>
        }
      />
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-0 flex-1 basis-60">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
          <Input
            aria-label="Buscar aluno"
            placeholder="Buscar por nome ou e-mail"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>
        <Select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} className="w-auto">
          <option value="ativos">Não arquivados</option>
          <option value="ativo">Ativos</option>
          <option value="convidado">Convite pendente</option>
          <option value="arquivado">Arquivados</option>
          <option value="todos">Todos</option>
        </Select>
        <Select aria-label="Agente" value={agent} onChange={(e) => { setAgent(e.target.value); setPage(0); }} className="w-auto">
          <option value="todos">Todos os agentes</option>
          {state.agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.versions.find((v) => v.version === a.currentVersion)?.config.name}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        {visible.length === 0 ? (
          <EmptyState icon={<Users size={28} />} title="Nenhum aluno encontrado" action={<LinkButton to="/personal/alunos/novo" variant="primary">Cadastrar aluno</LinkButton>}>
            Ajuste os filtros ou cadastre um novo aluno.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((s) => {
              const { cycle, plan, lastLog } = studentSummary(state, s.id);
              const prog = cycle ? cycleProgress(state, cycle) : null;
              return (
                <li key={s.id}>
                  <Link to={`/personal/alunos/${s.id}`} className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 px-4 py-3 hover:bg-surface-2 sm:grid-cols-[auto_1.4fr_1fr_1.2fr] sm:px-5">
                    <Avatar name={s.name} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{s.name}</p>
                      <p className="truncate text-[13px] text-muted">
                        {goalLabel[s.goal]} · {levelLabel[s.level]} · {s.weeklyFrequency}x/semana
                      </p>
                    </div>
                    <div className="col-start-2 flex flex-wrap items-center gap-1.5 sm:col-start-auto">
                      <Badge tone={statusTone[s.status]}>{statusLabel[s.status]}</Badge>
                      {plan ? <Badge>v{plan.version}</Badge> : <Badge tone="warn">Sem treino</Badge>}
                    </div>
                    <div className="col-start-2 min-w-0 sm:col-start-auto">
                      {cycle && prog ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-2">
                            <CycleBadge state={cycle.state} />
                            <span className="num text-[12px] text-muted">
                              {prog.daysLeft > 0 ? `${prog.daysLeft}d para reavaliar` : 'Vencido'}
                            </span>
                          </div>
                          <Progress value={prog.elapsed} max={prog.total} tone={prog.daysLeft <= 0 ? 'warn' : 'accent'} label="Progresso do ciclo" />
                        </div>
                      ) : (
                        <span className="text-[13px] text-faint">Sem ciclo ativo</span>
                      )}
                      {lastLog && <p className="mt-1 text-[12px] text-faint">Último treino em {formatDate(lastLog.date)}</p>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-5 py-2.5 text-[13px] text-muted">
            <span>
              {rows.length} aluno(s) · página {page + 1} de {pages}
            </span>
            <div className="flex gap-2">
              <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

const EQUIPMENT = Object.keys(equipmentLabel) as Equipment[];
const REGIONS = Object.keys(regionLabel) as BodyRegion[];

export function NewStudent() {
  const { state, run } = useStore();
  const navigate = useNavigate();
  const [form, setForm] = useState<StudentForm>({
    name: '',
    email: '',
    sex: 'feminino',
    birthDate: '',
    goal: 'hipertrofia',
    level: 'iniciante',
    weeklyFrequency: 3,
    equipment: ['halteres', 'maquinas'],
    limitations: [],
    limitationNotes: '',
    preferences: '',
    agentId: state.agents[0]?.id ?? '',
    autoUpdate: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof StudentForm>(k: K, v: StudentForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = StudentFormSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    setSaving(true);
    const s = await run((d) => createStudent(d, parsed.data, d.trainer.name), (s) => `Convite enviado para ${s.email}.`);
    setSaving(false);
    if (s) navigate(`/personal/alunos/${s.id}`);
  };

  return (
    <form onSubmit={submit} noValidate className="flex max-w-3xl flex-col gap-5">
      <PageHeader title="Novo aluno" subtitle="Colete só o necessário para prescrever. Dados de saúde ficam restritos a você e ao aluno." />
      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Nome completo" htmlFor="n-name" error={errors.name}>
          <Input id="n-name" value={form.name} onChange={(e) => set('name', e.target.value)} aria-invalid={!!errors.name} autoComplete="off" />
        </Field>
        <Field label="E-mail para o convite" htmlFor="n-email" error={errors.email}>
          <Input id="n-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} aria-invalid={!!errors.email} autoComplete="off" />
        </Field>
        <Field label="Data de nascimento" htmlFor="n-birth" error={errors.birthDate} hint="Usada nos protocolos de avaliação.">
          <Input id="n-birth" type="date" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} aria-invalid={!!errors.birthDate} />
        </Field>
        <Field label="Sexo (para protocolos de dobras)" htmlFor="n-sex">
          <Select id="n-sex" value={form.sex} onChange={(e) => set('sex', e.target.value as StudentForm['sex'])}>
            <option value="feminino">Feminino</option>
            <option value="masculino">Masculino</option>
          </Select>
        </Field>
      </Card>

      <Card className="grid gap-4 p-5 sm:grid-cols-3">
        <Field label="Objetivo principal" htmlFor="n-goal">
          <Select id="n-goal" value={form.goal} onChange={(e) => set('goal', e.target.value as StudentForm['goal'])}>
            {Object.entries(goalLabel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Experiência" htmlFor="n-level">
          <Select id="n-level" value={form.level} onChange={(e) => set('level', e.target.value as StudentForm['level'])}>
            {Object.entries(levelLabel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Dias por semana" htmlFor="n-freq" error={errors.weeklyFrequency}>
          <Input id="n-freq" type="number" min={1} max={6} value={form.weeklyFrequency} onChange={(e) => set('weeklyFrequency', Number(e.target.value))} />
        </Field>
        <fieldset className="sm:col-span-3">
          <legend className="mb-2 text-[13px] font-semibold">Equipamentos disponíveis</legend>
          <div className="flex flex-wrap gap-2">
            {EQUIPMENT.map((eq) => (
              <Chip key={eq} on={form.equipment.includes(eq)} onClick={() => set('equipment', toggleIn(form.equipment, eq))}>
                {equipmentLabel[eq]}
              </Chip>
            ))}
          </div>
          {errors.equipment && <p className="mt-1 text-[12px] text-bad">{errors.equipment}</p>}
        </fieldset>
        <fieldset className="sm:col-span-3">
          <legend className="mb-1 text-[13px] font-semibold">Limitações relatadas</legend>
          <p className="mb-2 text-[12px] text-faint">Exercícios com cuidado nessas regiões ficam bloqueados para este aluno.</p>
          <div className="flex flex-wrap gap-2">
            {REGIONS.map((r) => (
              <Chip key={r} tone="warn" on={form.limitations.includes(r)} onClick={() => set('limitations', toggleIn(form.limitations, r))}>
                {regionLabel[r]}
              </Chip>
            ))}
          </div>
        </fieldset>
        <div className="sm:col-span-3">
          <Field label="Observações sobre limitações (opcional)" htmlFor="n-lim">
            <Textarea id="n-lim" value={form.limitationNotes} onChange={(e) => set('limitationNotes', e.target.value)} />
          </Field>
        </div>
        <div className="sm:col-span-3">
          <Field label="Preferências de exercícios (opcional)" htmlFor="n-pref">
            <Textarea id="n-pref" value={form.preferences} onChange={(e) => set('preferences', e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <Field label="Agente responsável" htmlFor="n-agent" error={errors.agentId}>
          <Select id="n-agent" value={form.agentId} onChange={(e) => set('agentId', e.target.value)}>
            {state.agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.versions.find((v) => v.version === a.currentVersion)?.config.name} (v{a.currentVersion})
              </option>
            ))}
          </Select>
        </Field>
        <Toggle
          checked={form.autoUpdate}
          onChange={(v) => set('autoUpdate', v)}
          label="Permitir atualização automática"
          description="Ao fim de cada ciclo, a nova versão é publicada sem sua aprovação se todas as validações passarem. Alertas sempre bloqueiam."
        />
      </Card>

      <Callout tone="neutral">
        O aluno recebe um convite por e-mail e só vê os próprios dados. Fotos corporais não são pedidas no cadastro.
      </Callout>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => navigate('/personal/alunos')}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          Cadastrar e enviar convite
        </Button>
      </div>
    </form>
  );
}

export function Chip({ on, onClick, children, tone = 'accent' }: { on: boolean; onClick: () => void; children: React.ReactNode; tone?: 'accent' | 'warn' }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        'rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors',
        on
          ? tone === 'warn'
            ? 'border-warn/50 bg-warn-soft text-warn'
            : 'border-accent/50 bg-accent-soft text-accent'
          : 'border-line bg-surface-2 text-muted hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}

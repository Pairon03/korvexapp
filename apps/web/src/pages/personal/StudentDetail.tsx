import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowLeft, Pencil, Sparkles, Send, Archive, RotateCcw, Pause, Play, CalendarPlus, Check, Trash2, Copy } from 'lucide-react';
import {
  acceptInvite,
  audit,
  activeCycle,
  addAssessment,
  approveProposal,
  cancelUpdate,
  circumferenceLabel,
  compareAssessments,
  equipmentLabel,
  exportStudentData,
  extendCycle,
  formatDate,
  formatDateTime,
  formatNumber,
  generateInitialDraft,
  getPlan,
  getPublished,
  goalLabel,
  latestAssessments,
  levelLabel,
  publishAndTrack,
  PROTOCOL_LABEL,
  PROTOCOL_SITES,
  regionLabel,
  restoreVersion,
  retryCycle,
  setPaused,
  setStudentStatus,
  skinfoldLabel,
  updateStudent,
  validatePlan,
  validationContext,
  agentConfigFor,
  AssessmentFormSchema,
  formatDose,
  isTimed,
  type Assessment,
  type CircumferenceKey,
  type PlanVersion,
  type SkinfoldProtocol,
  type PlatformState,
  type Student,
} from '@korvex/core';
import { aiProvider } from '../../state/ai';
import { useStore } from '../../state/store';
import { photosEnabled } from '../../state/photos';
import { PhotoThumb, PhotoViewer, sortPhotos } from '../../components/Photo';
import { cycleProgress } from '../../derive';
import { Badge, Button, Callout, Card, CardHeader, ConfirmButton, CycleBadge, EmptyState, Field, Input, Modal, Progress, Select, Tabs, Textarea, Toggle, cx, LinkButton } from '../../components/ui';
import { ChangesList, PlanDays, ValidationList, VolumeChart } from '../../components/PlanView';
import { Avatar } from './Students';

type Tab = 'treino' | 'versoes' | 'avaliacoes' | 'execucao' | 'ciclo' | 'dados';

export default function StudentDetail() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { state, run } = useStore();
  const student = state.students.find((s) => s.id === id);
  const tab = (params.get('aba') as Tab) || 'treino';
  const setTab = (t: Tab) => setParams({ aba: t }, { replace: true });

  if (!student) {
    return (
      <EmptyState title="Aluno não encontrado" action={<LinkButton to="/personal/alunos">Voltar para alunos</LinkButton>}>
        Ele pode ter sido removido ou o link está incorreto.
      </EmptyState>
    );
  }
  const plan = getPlan(state, id);
  const published = getPublished(state, id);
  const cycle = activeCycle(state, id);
  const { version: agentVersion } = agentConfigFor(state, student);
  const draft = plan?.versions.find((v) => v.status === 'rascunho') ?? null;

  return (
    <div className="flex flex-col gap-5">
      <Link to="/personal/alunos" className="flex w-fit items-center gap-1 text-[13px] text-muted hover:text-fg">
        <ArrowLeft size={14} /> Alunos
      </Link>
      <div className="flex flex-wrap items-start gap-4">
        <Avatar name={student.name} size={52} />
        <div className="min-w-0 flex-1">
          <h1 className="display-narrow text-[21px] leading-tight sm:text-[24px]">{student.name}</h1>
          <p className="text-sm text-muted">
            {goalLabel[student.goal]} · {levelLabel[student.level]} · {student.weeklyFrequency}x/semana · agente {agentVersion.config.name} v{agentVersion.version}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {student.status === 'convidado' && <Badge tone="info">Convite pendente</Badge>}
            {student.status === 'arquivado' && <Badge>Arquivado</Badge>}
            {student.limitations.map((l) => (
              <Badge key={l} tone="warn">
                Limitação: {regionLabel[l]}
              </Badge>
            ))}
            <Badge tone={student.autoUpdate ? 'accent' : 'neutral'}>{student.autoUpdate ? 'Atualização automática' : 'Aprovação manual'}</Badge>
            {student.photoConsent && <Badge tone="info">Fotos autorizadas</Badge>}
          </div>
        </div>
        {cycle && <CycleMini state={state} cycleId={cycle.id} onOpen={() => setTab('ciclo')} />}
      </div>

      {student.status === 'convidado' && (
        <Callout tone="info" title="Convite enviado">
          O aluno ainda não aceitou o convite. Você já pode preparar o primeiro treino.
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => run((d) => audit(d, d.trainer.name, 'reenviou_convite', `aluno:${id}`, student.email), 'Convite reenviado.')}>
              <Send size={14} /> Reenviar convite
            </Button>
            <Button size="sm" variant="ghost" onClick={() => run((d) => acceptInvite(d, id), 'Convite aceito (simulação).')}>
              Simular aceite pelo aluno
            </Button>
          </div>
        </Callout>
      )}

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'treino', label: 'Treino' },
          { id: 'versoes', label: 'Versões', count: plan?.versions.length },
          { id: 'avaliacoes', label: 'Avaliações', count: state.assessments.filter((a) => a.studentId === id).length },
          { id: 'execucao', label: 'Execução', count: state.logs.filter((l) => l.studentId === id).length },
          { id: 'ciclo', label: 'Ciclo' },
          { id: 'dados', label: 'Dados' },
        ]}
      />

      {tab === 'treino' && <TrainingTab student={student} published={published} draft={draft} />}
      {tab === 'versoes' && <VersionsTab student={student} />}
      {tab === 'avaliacoes' && <AssessmentsTab student={student} />}
      {tab === 'execucao' && <LogsTab student={student} />}
      {tab === 'ciclo' && <CycleTab student={student} />}
      {tab === 'dados' && <DataTab student={student} />}
    </div>
  );
}

function CycleMini({ state, cycleId, onOpen }: { state: PlatformState; cycleId: string; onOpen: () => void }) {
  const c = state.cycles.find((x) => x.id === cycleId)!;
  const p = cycleProgress(state, c);
  return (
    <button onClick={onOpen} className="w-full rounded-xl border border-line bg-surface p-3 text-left hover:border-accent/40 sm:w-64">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">Ciclo atual</span>
        <CycleBadge state={c.state} />
      </div>
      <p className="num mt-2 text-sm">
        Dia {p.elapsed} de {p.total}
      </p>
      <Progress value={p.elapsed} max={p.total} tone={p.daysLeft <= 0 ? 'warn' : 'accent'} label="Progresso do ciclo" />
      <p className="mt-1.5 text-[12px] text-muted">Reavaliação em {formatDate(c.dueDate)}</p>
    </button>
  );
}

// ---------- Treino ----------

function TrainingTab({ student, published, draft }: { student: Student; published: PlanVersion | null; draft: PlanVersion | null }) {
  const { state, run } = useStore();
  const [busy, setBusy] = useState(false);
  const { version } = agentConfigFor(state, student);
  const validations = useMemo(() => (draft ? validatePlan(draft, validationContext(state, student)) : []), [draft, state, student]);
  const blocked = validations.some((v) => !v.ok && v.severity === 'bloqueio');

  const generate = async () => {
    setBusy(true);
    await run(async (d) => {
      const r = await generateInitialDraft(d, student.id, d.trainer.name, aiProvider());
      if (!r.draft) throw new Error(`A IA não gerou uma proposta válida. ${r.outcome.errors[0] ?? ''} Nenhum treino foi alterado.`);
      return r.draft;
    }, 'Proposta gerada. Revise e publique.');
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-5">
      {draft && (
        <Card className="border-accent/40">
          <CardHeader
            title={
              <span className="flex flex-wrap items-center gap-2">
                Rascunho v{draft.version} <Badge tone="accent">{draft.source === 'ia' ? 'Proposta da IA' : draft.source === 'restauracao' ? 'Restauração' : 'Edição manual'}</Badge>
              </span>
            }
            subtitle={draft.changeReason}
            action={
              <div className="flex flex-wrap gap-2">
                <LinkButton to={`/personal/alunos/${student.id}/editar-treino`} size="sm">
                    <Pencil size={14} /> Editar
                  </LinkButton>
                <ConfirmButton
                  label={<><Trash2 size={14} /> Descartar</>}
                  confirmLabel="Descartar rascunho"
                  message="O rascunho fica no histórico como descartado. O treino publicado não muda."
                  onConfirm={() => run((d) => void (getPlan(d, student.id)!.versions.find((v) => v.id === draft.id)!.status = 'descartado'), 'Rascunho descartado.')}
                />
                <Button
                  size="sm"
                  variant="primary"
                  disabled={blocked}
                  title={blocked ? 'Corrija os bloqueios antes de publicar' : undefined}
                  onClick={() => run((d) => publishAndTrack(d, student.id, draft.id, d.trainer.name), (pv) => `Versão ${pv.version} publicada e ciclo de ${version.config.cycle.days} dias iniciado.`)}
                >
                  <Check size={14} /> Publicar
                </Button>
              </div>
            }
          />
          <div className="grid gap-5 p-4 sm:p-5 xl:grid-cols-[1fr_340px]">
            <div className="min-w-0 flex flex-col gap-4">
              {draft.alerts.length > 0 && (
                <Callout tone="warn" title="Observações da proposta">
                  <ul className="list-disc pl-4">
                    {draft.alerts.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </Callout>
              )}
              <PlanDays plan={draft} exercises={state.exercises} />
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <p className="eyebrow mb-2">Validações do servidor</p>
                <ValidationList results={validations} />
              </div>
              <VolumeChart plan={draft} exercises={state.exercises} max={version.config.volume.maxSetsPerMuscleWeek} min={version.config.volume.minSetsPerMuscleWeek} />
            </div>
          </div>
        </Card>
      )}

      {published ? (
        <Card>
          <CardHeader
            title={
              <span className="flex flex-wrap items-center gap-2">
                Treino vigente · v{published.version} <Badge tone="ok">Publicado</Badge>
              </span>
            }
            subtitle={`Publicado em ${formatDateTime(published.publishedAt!)} por ${published.author}. ${published.changeReason}`}
            action={
              <LinkButton to={`/personal/alunos/${student.id}/editar-treino`} size="sm">
                  <Pencil size={14} /> Editar como nova versão
                </LinkButton>
            }
          />
          <div className="grid gap-5 p-4 sm:p-5 xl:grid-cols-[1fr_340px]">
            <PlanDays plan={published} exercises={state.exercises} />
            <VolumeChart plan={published} exercises={state.exercises} max={version.config.volume.maxSetsPerMuscleWeek} min={version.config.volume.minSetsPerMuscleWeek} />
          </div>
        </Card>
      ) : (
        !draft && (
          <Card>
            <EmptyState
              icon={<Sparkles size={28} />}
              title="Este aluno ainda não tem treino"
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="primary" onClick={generate} loading={busy}>
                    <Sparkles size={15} /> Gerar proposta com IA
                  </Button>
                  <LinkButton to={`/personal/alunos/${student.id}/editar-treino`}>Montar manualmente</LinkButton>
                </div>
              }
            >
              O agente {version.config.name} monta uma proposta com exercícios da sua biblioteca, compatível com equipamentos e limitações. Nada é publicado sem passar pelas
              validações.
            </EmptyState>
          </Card>
        )
      )}
    </div>
  );
}

// ---------- Versões ----------

function diffPlans(a: PlanVersion, b: PlanVersion, names: Map<string, string>, timed: Set<string>) {
  const rows: { day: string; kind: 'adicionado' | 'removido' | 'alterado' | 'igual'; text: string }[] = [];
  const labels = [...new Set([...a.days.map((d) => d.label), ...b.days.map((d) => d.label)])];
  for (const label of labels) {
    const da = a.days.find((d) => d.label === label);
    const db = b.days.find((d) => d.label === label);
    const ea = da?.exercises ?? [];
    const eb = db?.exercises ?? [];
    for (const e of eb) {
      const prev = ea.find((x) => x.exerciseId === e.exerciseId);
      const n = names.get(e.exerciseId) ?? e.exerciseId;
      if (!prev) rows.push({ day: label, kind: 'adicionado', text: `${n} · ${formatDose(e, timed.has(e.exerciseId) ? { measure: 'segundos' } : null)}` });
      else {
        const parts: string[] = [];
        if (prev.sets !== e.sets) parts.push(`séries ${prev.sets}→${e.sets}`);
        if (prev.repMin !== e.repMin || prev.repMax !== e.repMax) parts.push(`${timed.has(e.exerciseId) ? 'segundos' : 'reps'} ${prev.repMin}–${prev.repMax}→${e.repMin}–${e.repMax}`);
        if (prev.restSec !== e.restSec) parts.push(`descanso ${prev.restSec}s→${e.restSec}s`);
        if (prev.suggestedLoadKg !== e.suggestedLoadKg) parts.push(`carga sugerida ${prev.suggestedLoadKg ?? '—'}→${e.suggestedLoadKg ?? '—'} kg`);
        rows.push({ day: label, kind: parts.length ? 'alterado' : 'igual', text: parts.length ? `${n}: ${parts.join(', ')}` : n });
      }
    }
    for (const e of ea) if (!eb.find((x) => x.exerciseId === e.exerciseId)) rows.push({ day: label, kind: 'removido', text: names.get(e.exerciseId) ?? e.exerciseId });
  }
  if (JSON.stringify(a.cardio) !== JSON.stringify(b.cardio)) rows.push({ day: 'Cardio', kind: 'alterado', text: `${a.cardio ? `${a.cardio.sessionsPerWeek}x ${a.cardio.minutes}min` : 'sem cardio'} → ${b.cardio ? `${b.cardio.sessionsPerWeek}x ${b.cardio.minutes}min` : 'sem cardio'}` });
  if (a.weeklyFrequency !== b.weeklyFrequency) rows.push({ day: 'Frequência', kind: 'alterado', text: `${a.weeklyFrequency} → ${b.weeklyFrequency} dias/semana` });
  return rows;
}

const versionTone = { publicado: 'ok', rascunho: 'accent', substituido: 'neutral', descartado: 'neutral' } as const;
const versionLabel = { publicado: 'Publicado', rascunho: 'Rascunho', substituido: 'Substituído', descartado: 'Descartado' } as const;

function VersionsTab({ student }: { student: Student }) {
  const { state, run } = useStore();
  const versions = [...(getPlan(state, student.id)?.versions ?? [])].reverse();
  const [selected, setSelected] = useState<string | null>(versions[0]?.id ?? null);
  const [compareA, setCompareA] = useState<string>(versions[1]?.id ?? '');
  const [compareB, setCompareB] = useState<string>(versions[0]?.id ?? '');
  const names = new Map(state.exercises.map((e) => [e.id, e.name]));
  const timed = new Set(state.exercises.filter(isTimed).map((e) => e.id));
  const sel = versions.find((v) => v.id === selected);
  const va = versions.find((v) => v.id === compareA);
  const vb = versions.find((v) => v.id === compareB);
  if (!versions.length) return <Card><EmptyState title="Nenhuma versão ainda">A primeira versão aparece aqui quando você gerar ou montar o treino.</EmptyState></Card>;

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader title="Histórico" subtitle="Versões nunca são apagadas ou sobrescritas." />
        <ul className="divide-y divide-line">
          {versions.map((v) => (
            <li key={v.id}>
              <button onClick={() => setSelected(v.id)} className={cx('w-full px-4 py-3 text-left hover:bg-surface-2', selected === v.id && 'bg-surface-2')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">Versão {v.version}</span>
                  <Badge tone={versionTone[v.status]}>{versionLabel[v.status]}</Badge>
                </div>
                <p className="text-[12px] text-muted">
                  {v.source === 'ia' ? 'Agente de IA' : v.author} · agente v{v.agentVersion} · {formatDate(v.publishedAt ?? v.createdAt)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <div className="flex min-w-0 flex-col gap-5">
        {sel && (
          <Card>
            <CardHeader
              title={`Versão ${sel.version}`}
              subtitle={sel.changeReason}
              action={
                sel.status !== 'rascunho' && (
                  <Button size="sm" onClick={() => run((d) => restoreVersion(d, student.id, sel.id, d.trainer.name), (pv) => `Rascunho v${pv.version} criado a partir da versão ${sel.version}.`)}>
                    <RotateCcw size={14} /> Restaurar como nova versão
                  </Button>
                )
              }
            />
            <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-2">
              <div className="min-w-0">
                <p className="eyebrow mb-2">Mudanças e justificativas</p>
                <ChangesList plan={sel} />
                {sel.aiRunId && <p className="num mt-2 text-[11px] text-faint">execução de IA: {sel.aiRunId}</p>}
              </div>
              <div className="min-w-0">
                <p className="eyebrow mb-2">Treino</p>
                <PlanDays plan={sel} exercises={state.exercises} compact />
              </div>
            </div>
          </Card>
        )}
        {versions.length > 1 && (
          <Card>
            <CardHeader title="Comparar versões" />
            <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
              <Select aria-label="Versão base" value={compareA} onChange={(e) => setCompareA(e.target.value)} className="w-auto">
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version} ({versionLabel[v.status]})
                  </option>
                ))}
              </Select>
              <span className="text-muted">→</span>
              <Select aria-label="Versão comparada" value={compareB} onChange={(e) => setCompareB(e.target.value)} className="w-auto">
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version} ({versionLabel[v.status]})
                  </option>
                ))}
              </Select>
            </div>
            <div className="p-5">
              {va && vb && (
                <ul className="flex flex-col gap-1 text-[13px]">
                  {diffPlans(va, vb, names, timed)
                    .filter((r) => r.kind !== 'igual')
                    .map((r, i) => (
                      <li key={i} className="flex gap-2">
                        <span className={cx('num w-5 shrink-0 text-center font-bold', r.kind === 'adicionado' && 'text-ok', r.kind === 'removido' && 'text-bad', r.kind === 'alterado' && 'text-warn')}>
                          {r.kind === 'adicionado' ? '+' : r.kind === 'removido' ? '−' : '~'}
                        </span>
                        <span className="w-24 shrink-0 text-muted">{r.day}</span>
                        <span className="min-w-0">{r.text}</span>
                      </li>
                    ))}
                  {diffPlans(va, vb, names, timed).every((r) => r.kind === 'igual') && <li className="text-muted">As duas versões têm o mesmo conteúdo.</li>}
                </ul>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ---------- Avaliações ----------

const CIRC_KEYS = Object.keys(circumferenceLabel) as CircumferenceKey[];

function AssessmentsTab({ student }: { student: Student }) {
  const { state, run, cloud } = useStore();
  const list = latestAssessments(state.assessments, student.id);
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<{ assessment: Assessment; index: number; watermark: string } | null>(null);
  // Cada abertura fica no registro de auditoria, que o aluno pode pedir junto com os dados dele.
  const openPhotos = (x: Assessment, index: number) => {
    setViewing({ assessment: x, index, watermark: `${cloud.email ?? state.trainer.name} · ${student.name} · ${new Date().toLocaleString('pt-BR')}` });
    void run((d) => audit(d, state.trainer.name, 'visualizou_fotos', `avaliacao:${x.id}`, `Fotos de ${student.name} (${x.photos.length}).`));
  };
  const [aId, setAId] = useState(list[1]?.id ?? '');
  const [bId, setBId] = useState(list[0]?.id ?? '');
  const a = list.find((x) => x.id === aId);
  const b = list.find((x) => x.id === bId);
  const cmp = a && b && a.id !== b.id ? compareAssessments(a, b) : null;
  const chart = [...list].reverse().map((x) => ({ data: formatDate(x.date).slice(0, 5), peso: x.weightKg, cintura: x.circumferences.cintura ?? null }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Fotos são opcionais e nunca bloqueiam o ciclo. Valores ausentes ficam em branco, nunca como zero.</p>
        <Button variant="primary" onClick={() => setOpen(true)}>
          Nova avaliação
        </Button>
      </div>
      {list.length === 0 ? (
        <Card>
          <EmptyState title="Nenhuma avaliação registrada">Registre a primeira avaliação para acompanhar a evolução e liberar os ciclos.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader title="Comparação" subtitle={cmp ? `${cmp.daysApart} dias entre as avaliações` : 'Escolha duas avaliações diferentes'} />
            <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
              <Select aria-label="Avaliação anterior" value={aId} onChange={(e) => setAId(e.target.value)} className="w-auto">
                {list.map((x) => (
                  <option key={x.id} value={x.id}>
                    {formatDate(x.date)}
                  </option>
                ))}
              </Select>
              <span className="text-muted">→</span>
              <Select aria-label="Avaliação atual" value={bId} onChange={(e) => setBId(e.target.value)} className="w-auto">
                {list.map((x) => (
                  <option key={x.id} value={x.id}>
                    {formatDate(x.date)}
                  </option>
                ))}
              </Select>
            </div>
            {cmp && (
              <div className="p-5">
                {cmp.alerts.map((al) => (
                  <Callout key={al} tone="warn">
                    {al}
                  </Callout>
                ))}
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-left text-[12px] text-muted">
                        <th className="py-2 font-semibold">Medida</th>
                        <th className="py-2 text-right font-semibold">Anterior</th>
                        <th className="py-2 text-right font-semibold">Atual</th>
                        <th className="py-2 text-right font-semibold">Diferença</th>
                        <th className="py-2 text-right font-semibold">%</th>
                      </tr>
                    </thead>
                    <tbody className="num">
                      {cmp.rows.map((r) => (
                        <tr key={r.key} className="border-t border-line">
                          <td className="py-2 font-sans">{r.label}</td>
                          <td className="py-2 text-right text-muted">{r.previous != null ? `${formatNumber(r.previous)} ${r.unit}` : '—'}</td>
                          <td className="py-2 text-right">{r.current != null ? `${formatNumber(r.current)} ${r.unit}` : '—'}</td>
                          <td className="py-2 text-right">{r.diff != null ? `${r.diff > 0 ? '+' : ''}${formatNumber(r.diff)}` : '—'}</td>
                          <td className="py-2 text-right text-muted">{r.diffPct != null ? `${r.diffPct > 0 ? '+' : ''}${formatNumber(r.diffPct)}%` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-[12px] text-faint">Oscilações isoladas não comprovam ganho ou perda de gordura. Observe a tendência ao longo de vários ciclos.</p>
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title="Evolução" subtitle="Peso (kg) e cintura (cm)" />
            <div className="h-64 px-2 py-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="data" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="p" domain={['dataMin - 2', 'dataMax + 2']} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="c" orientation="right" domain={['dataMin - 3', 'dataMax + 3']} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--fg)' }} />
                  <Line yAxisId="p" type="monotone" dataKey="peso" name="Peso (kg)" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                  <Line yAxisId="c" type="monotone" dataKey="cintura" name="Cintura (cm)" stroke="var(--info)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <ul className="divide-y divide-line border-t border-line">
              {list.map((x) => (
                <li key={x.id} className="px-5 py-2.5 text-[13px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{formatDate(x.date)}</span>
                    <span className="text-muted">
                      {x.source === 'aluno' ? 'Informado pelo aluno' : `Coletado por ${x.collectedBy}`} · {x.photos.length ? `${x.photos.length} foto(s)` : 'sem fotos'}
                    </span>
                  </div>
                  {x.photos.length > 0 && photosEnabled && (
                    <div className="mt-2 flex gap-1.5">
                      {sortPhotos(x.photos).map((p, i) => (
                        <button
                          key={p.storageKey}
                          type="button"
                          onClick={() => openPhotos(x, i)}
                          className="block h-16 w-12 overflow-hidden rounded-md border border-line hover:border-accent/60"
                          aria-label={`Ver foto ${p.category} de ${formatDate(x.date)}`}
                        >
                          <PhotoThumb storageKey={p.storageKey} alt={`Foto ${p.category}`} />
                        </button>
                      ))}
                    </div>
                  )}
                  {x.bodyFat && (
                    <p className="mt-1 text-[12px] text-muted">
                      Gordura estimada <span className="num text-fg">{formatNumber(x.bodyFat.resultPct)}%</span> · {x.bodyFat.formula} ({x.bodyFat.formulaVersion}). {x.bodyFat.limitations}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
      <Modal open={viewing != null} onClose={() => setViewing(null)} title={viewing ? `Fotos de ${formatDate(viewing.assessment.date)}` : 'Fotos'} wide>
        {viewing && (
          <div className="flex flex-col gap-3">
            <PhotoViewer
              photos={sortPhotos(viewing.assessment.photos).map((p) => ({ storageKey: p.storageKey, label: p.category[0].toUpperCase() + p.category.slice(1) }))}
              start={viewing.index}
              watermark={viewing.watermark}
            />
            <p className="text-[12px] text-faint">
              Enviadas pelo aluno com consentimento, só para acompanhamento. Não salve nem compartilhe: cada abertura fica registrada e a marca d'água identifica quem viu. Se o aluno revogar a
              autorização, as fotos são apagadas.
            </p>
          </div>
        )}
      </Modal>
      <AssessmentForm
        open={open}
        onClose={() => setOpen(false)}
        student={student}
        onSubmit={(form) =>
          run((d) => addAssessment(d, student.id, form, { collectedBy: d.trainer.name, source: 'personal' }), 'Avaliação registrada.').then((r) => {
            if (r) setOpen(false);
          })
        }
        trainerMode
      />
    </div>
  );
}

export function AssessmentForm({
  open,
  onClose,
  student,
  onSubmit,
  trainerMode,
}: {
  open: boolean;
  onClose: () => void;
  student: Student;
  onSubmit: (f: Parameters<typeof addAssessment>[2]) => void;
  trainerMode?: boolean;
}) {
  const { state } = useStore();
  const [date, setDate] = useState(state.now.slice(0, 10));
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [circ, setCirc] = useState<Partial<Record<CircumferenceKey, string>>>({});
  const [protocol, setProtocol] = useState<SkinfoldProtocol | ''>('');
  const [sites, setSites] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const num = (v: string | undefined) => (v == null || v.trim() === '' ? null : Number(v.replace(',', '.')));
  const shownCirc: CircumferenceKey[] = trainerMode ? CIRC_KEYS : ['cintura', 'quadril', 'braco_d', 'coxa_d'];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const circumferences: Record<string, number> = {};
    for (const [k, v] of Object.entries(circ)) {
      const n = num(v);
      if (n != null) circumferences[k] = n;
    }
    const sitesMm: Record<string, number> = {};
    if (protocol) for (const s of PROTOCOL_SITES[protocol]) {
      const n = num(sites[s]);
      if (n != null) sitesMm[s] = n;
    }
    const form = {
      date,
      weightKg: num(weight),
      heightCm: num(height),
      circumferences,
      skinfolds: protocol ? { protocol, sitesMm } : null,
      notes,
    };
    const parsed = AssessmentFormSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(' '));
      return;
    }
    if (form.weightKg == null && !Object.keys(circumferences).length) {
      setError('Informe ao menos o peso ou uma circunferência.');
      return;
    }
    setError('');
    onSubmit(parsed.data);
  };

  return (
    <Modal open={open} onClose={onClose} title={trainerMode ? `Nova avaliação · ${student.name}` : 'Registrar avaliação'} wide>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Data da medição" htmlFor="as-date">
            <Input id="as-date" type="date" value={date} max={state.now.slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Peso (kg)" htmlFor="as-w">
            <Input id="as-w" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Ex.: 72,4" />
          </Field>
          <Field label="Altura (cm)" htmlFor="as-h">
            <Input id="as-h" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="Ex.: 170" />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold">Circunferências (cm) — preencha só as medidas coletadas</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {shownCirc.map((k) => (
              <Field key={k} label={circumferenceLabel[k]} htmlFor={`as-${k}`}>
                <Input id={`as-${k}`} inputMode="decimal" value={circ[k] ?? ''} onChange={(e) => setCirc((c) => ({ ...c, [k]: e.target.value }))} />
              </Field>
            ))}
          </div>
        </fieldset>
        {trainerMode && (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-[13px] font-semibold">Dobras cutâneas (mm)</legend>
            <Select aria-label="Protocolo" value={protocol} onChange={(e) => setProtocol(e.target.value as SkinfoldProtocol | '')}>
              <option value="">Não coletadas</option>
              {(Object.keys(PROTOCOL_LABEL) as SkinfoldProtocol[]).map((p) => (
                <option key={p} value={p}>
                  {PROTOCOL_LABEL[p]}
                </option>
              ))}
            </Select>
            {protocol && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  {PROTOCOL_SITES[protocol].map((s) => (
                    <Field key={s} label={skinfoldLabel[s]} htmlFor={`sf-${s}`}>
                      <Input id={`sf-${s}`} inputMode="decimal" value={sites[s] ?? ''} onChange={(e) => setSites((x) => ({ ...x, [s]: e.target.value }))} />
                    </Field>
                  ))}
                </div>
                <p className="text-[12px] text-faint">
                  O percentual de gordura só é calculado com todos os pontos do protocolo e quando o protocolo corresponde ao sexo do aluno. Fórmula, versão e limitações ficam registradas.
                </p>
              </>
            )}
          </fieldset>
        )}
        <Field label="Observações" htmlFor="as-notes">
          <Textarea id="as-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && (
          <p role="alert" className="text-[13px] font-medium text-bad">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary">
            Salvar avaliação
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Execução ----------

function LogsTab({ student }: { student: Student }) {
  const { state } = useStore();
  const logs = state.logs.filter((l) => l.studentId === student.id).sort((a, b) => b.date.localeCompare(a.date));
  const names = new Map(state.exercises.map((e) => [e.id, e.name]));
  const timed = new Set(state.exercises.filter(isTimed).map((e) => e.id));
  const dayLabel = (planVersionId: string, dayId: string) => getPlan(state, student.id)?.versions.find((v) => v.id === planVersionId)?.days.find((d) => d.id === dayId)?.label ?? '—';
  const [openId, setOpenId] = useState<string | null>(null);
  if (!logs.length) return <Card><EmptyState title="Nenhum treino registrado">Os registros do aluno aparecem aqui assim que ele finalizar a primeira sessão.</EmptyState></Card>;
  return (
    <Card>
      <ul className="divide-y divide-line">
        {logs.slice(0, 40).map((l) => {
          const discomfort = l.entries.filter((e) => e.discomfort && e.discomfort.level > 0);
          return (
            <li key={l.id}>
              <button onClick={() => setOpenId(openId === l.id ? null : l.id)} className="flex w-full flex-wrap items-center gap-3 px-5 py-3 text-left hover:bg-surface-2" aria-expanded={openId === l.id}>
                <span className="num w-24 text-[13px] text-muted">{formatDate(l.date)}</span>
                <span className="font-semibold">{dayLabel(l.planVersionId, l.dayId)}</span>
                <Badge tone={l.status === 'concluido' ? 'ok' : l.status === 'interrompido' ? 'warn' : 'info'}>
                  {l.status === 'concluido' ? 'Concluído' : l.status === 'interrompido' ? 'Interrompido' : 'Em andamento'}
                </Badge>
                {discomfort.length > 0 && <Badge tone="bad">Desconforto nível {Math.max(...discomfort.map((d) => d.discomfort!.level))}</Badge>}
              </button>
              {openId === l.id && (
                <div className="overflow-x-auto px-5 pb-4">
                  <table className="w-full text-[13px]">
                    <tbody>
                      {l.entries.map((e) => (
                        <tr key={e.workoutExerciseId} className="border-t border-line align-top">
                          <td className="py-2 pr-3 font-semibold">{names.get(e.exerciseId)}</td>
                          <td className="num py-2 text-muted">
                            {e.skipped ? 'Não realizado' : e.sets.map((s) => `${s.loadKg ?? '—'}kg×${s.reps ?? '—'}${timed.has(e.exerciseId) ? 's' : ''}${s.rpe != null ? ` @${s.rpe}` : ''}`).join('  ')}
                            {e.discomfort && e.discomfort.level > 0 && (
                              <p className="font-sans text-bad">
                                Desconforto {e.discomfort.level}/10 ({e.discomfort.region}). {e.discomfort.note}
                              </p>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ---------- Ciclo ----------

function CycleTab({ student }: { student: Student }) {
  const { state, run } = useStore();
  const cycles = state.cycles.filter((c) => c.studentId === student.id).sort((a, b) => b.id.localeCompare(a.id));
  const current = cycles.find((c) => !['publicado', 'cancelado'].includes(c.state));
  const [busy, setBusy] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendDays, setExtendDays] = useState(14);
  const [extendReason, setExtendReason] = useState('');
  const proposal = current?.proposalPlanVersionId ? getPlan(state, student.id)?.versions.find((v) => v.id === current.proposalPlanVersionId) : null;

  if (!cycles.length)
    return (
      <Card>
        <EmptyState title="Sem ciclo ativo">O ciclo começa quando o primeiro treino é publicado.</EmptyState>
      </Card>
    );

  const retry = async (reviewed: boolean) => {
    setBusy(true);
    await run((d) => retryCycle(d, current!.id, d.trainer.name, { provider: aiProvider() }, reviewed), (r) => r.message);
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-5">
      {current && (
        <Card>
          <CardHeader
            title={
              <span className="flex flex-wrap items-center gap-2">
                Ciclo atual <CycleBadge state={current.state} /> {current.paused && <Badge tone="warn">Pausado</Badge>}
              </span>
            }
            subtitle={`${formatDate(current.startDate)} → ${formatDate(current.dueDate)} · agente v${current.agentVersion} · tentativas ${current.attempts}`}
          />
          <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-4">
              {current.blockReasons.length > 0 && (
                <Callout tone={current.state === 'aguardando_validacao' ? 'info' : current.state === 'suspenso' || current.state === 'falhou' ? 'bad' : 'warn'} title="Por que o ciclo parou">
                  <ul className="list-disc pl-4">
                    {current.blockReasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  <p className="mt-1">O treino vigente continua valendo para o aluno.</p>
                </Callout>
              )}
              <div className="flex flex-wrap gap-2">
                {current.state === 'aguardando_validacao' && (
                  <Button variant="primary" onClick={() => run((d) => approveProposal(d, current.id, d.trainer.name), 'Proposta aprovada e publicada. Novo ciclo iniciado.')}>
                    <Check size={15} /> Aprovar e publicar
                  </Button>
                )}
                {(current.state === 'suspenso' || current.state === 'dados_incompletos') && (
                  <Button variant="primary" loading={busy} onClick={() => retry(true)}>
                    Revisei, gerar proposta para aprovação
                  </Button>
                )}
                {['falhou', 'aguardando_avaliacao', 'suspenso', 'dados_incompletos'].includes(current.state) && (
                  <Button loading={busy} onClick={() => retry(false)}>
                    <RotateCcw size={14} /> Verificar de novo
                  </Button>
                )}
                {proposal && proposal.status === 'rascunho' && (
                  <LinkButton to={`/personal/alunos/${student.id}/editar-treino`}>
                      <Pencil size={14} /> Editar proposta
                    </LinkButton>
                )}
                <Button variant="ghost" onClick={() => setExtendOpen(true)}>
                  <CalendarPlus size={14} /> Estender prazo
                </Button>
                <Button variant="ghost" onClick={() => run((d) => setPaused(d, current.id, !current.paused, d.trainer.name), current.paused ? 'Ciclo retomado.' : 'Ciclo pausado.')}>
                  {current.paused ? <Play size={14} /> : <Pause size={14} />} {current.paused ? 'Retomar' : 'Pausar'}
                </Button>
                <ConfirmButton
                  label="Cancelar atualização"
                  confirmLabel="Cancelar atualização"
                  message="A proposta pendente é descartada, o treino vigente continua e um novo ciclo começa hoje."
                  onConfirm={() => run((d) => cancelUpdate(d, current.id, d.trainer.name), 'Atualização cancelada.')}
                />
              </div>
              {current.validations.length > 0 && (
                <div>
                  <p className="eyebrow mb-2">Validações da última proposta</p>
                  <ValidationList results={current.validations} />
                </div>
              )}
              {proposal && (
                <div>
                  <p className="eyebrow mb-2">Proposta v{proposal.version}</p>
                  <ChangesList plan={proposal} />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="eyebrow mb-2">Linha do tempo</p>
              <ol className="relative flex flex-col gap-3 border-l border-line pl-4">
                {[...current.events].reverse().map((e, i) => (
                  <li key={i} className="relative text-[13px]">
                    <span className={cx('absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-surface', i === 0 ? 'bg-accent' : 'bg-faint')} aria-hidden />
                    <p className="num text-[11px] text-faint">{formatDateTime(e.at)}</p>
                    <p>{e.message}</p>
                  </li>
                ))}
              </ol>
              {current.errors.length > 0 && (
                <div className="mt-4">
                  <p className="eyebrow mb-1">Erros registrados</p>
                  <ul className="num flex flex-col gap-1 text-[11px] text-bad">
                    {current.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
      <Card>
        <CardHeader title="Ciclos anteriores" />
        <ul className="divide-y divide-line">
          {cycles
            .filter((c) => c !== current)
            .map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13px]">
                <span className="num text-muted">
                  {formatDate(c.startDate)} → {formatDate(c.dueDate)}
                </span>
                <CycleBadge state={c.state} />
                <span className="min-w-0 flex-1 text-muted">{c.events[c.events.length - 1]?.message}</span>
              </li>
            ))}
          {cycles.filter((c) => c !== current).length === 0 && <li className="px-5 py-4 text-[13px] text-muted">Nenhum ciclo concluído ainda.</li>}
        </ul>
      </Card>
      <Modal open={extendOpen} onClose={() => setExtendOpen(false)} title="Estender prazo do ciclo">
        <div className="flex flex-col gap-4">
          <Field label="Dias adicionais" htmlFor="ext-days">
            <Input id="ext-days" type="number" min={1} max={60} value={extendDays} onChange={(e) => setExtendDays(Number(e.target.value))} />
          </Field>
          <Field label="Motivo (fica registrado)" htmlFor="ext-reason">
            <Textarea id="ext-reason" value={extendReason} onChange={(e) => setExtendReason(e.target.value)} placeholder="Ex.: aluno viajou duas semanas." />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setExtendOpen(false)}>
              Voltar
            </Button>
            <Button
              variant="primary"
              disabled={!extendReason.trim() || extendDays < 1}
              onClick={() =>
                run((d) => extendCycle(d, current!.id, extendDays, d.trainer.name, extendReason.trim()), 'Prazo estendido.').then(() => {
                  setExtendOpen(false);
                  setExtendReason('');
                })
              }
            >
              Estender
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ---------- Dados ----------

function DataTab({ student }: { student: Student }) {
  const { state, run } = useStore();
  const [exportOpen, setExportOpen] = useState(false);
  const json = exportOpen ? JSON.stringify(exportStudentData(state, student.id), null, 2) : '';
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Prescrição" />
        <div className="flex flex-col gap-4 p-5">
          <Field label="Agente" htmlFor="d-agent" hint="Mudar o agente vale para a próxima geração. O treino publicado não muda.">
            <Select id="d-agent" value={student.agentId} onChange={(e) => run((d) => updateStudent(d, student.id, { agentId: e.target.value }, d.trainer.name), 'Agente alterado.')}>
              {state.agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.versions.find((v) => v.version === a.currentVersion)?.config.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Dias por semana" htmlFor="d-freq">
            <Input id="d-freq" type="number" min={1} max={6} value={student.weeklyFrequency} onChange={(e) => run((d) => updateStudent(d, student.id, { weeklyFrequency: Math.max(1, Math.min(6, Number(e.target.value))) }, d.trainer.name))} />
          </Field>
          <Toggle
            checked={student.autoUpdate}
            onChange={(v) => run((d) => updateStudent(d, student.id, { autoUpdate: v }, d.trainer.name), v ? 'Atualização automática ativada.' : 'Atualizações exigirão sua aprovação.')}
            label="Atualização automática"
            description="Publicar sem aprovação quando todas as condições forem atendidas."
          />
          <div>
            <p className="mb-1 text-[13px] font-semibold">Equipamentos</p>
            <p className="text-[13px] text-muted">{student.equipment.map((e) => equipmentLabel[e]).join(', ')}</p>
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Dados e privacidade" />
        <div className="flex flex-col gap-3 p-5 text-[13px]">
          <p className="text-muted">E-mail: {student.email}</p>
          <p className="text-muted">Cadastro em {formatDate(student.createdAt)} · nascimento {formatDate(student.birthDate)}</p>
          <p className="text-muted">Consentimento de fotos: {student.photoConsent ? 'concedido pelo aluno' : 'não concedido'} (gerenciado só pelo aluno)</p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button size="sm" onClick={() => setExportOpen(true)}>
              Exportar dados
            </Button>
            {student.status === 'arquivado' ? (
              <Button size="sm" onClick={() => run((d) => setStudentStatus(d, student.id, 'ativo', d.trainer.name), 'Aluno reativado.')}>
                Reativar
              </Button>
            ) : (
              <ConfirmButton
                label={<><Archive size={14} /> Arquivar</>}
                confirmLabel="Arquivar aluno"
                message="O aluno perde o acesso, deixa de contar no limite do plano e os ciclos param. O histórico é mantido."
                onConfirm={() => run((d) => setStudentStatus(d, student.id, 'arquivado', d.trainer.name), 'Aluno arquivado.')}
              />
            )}
          </div>
        </div>
      </Card>
      <Modal open={exportOpen} onClose={() => setExportOpen(false)} title="Exportação de dados" wide>
        <p className="mb-2 text-[13px] text-muted">Dados do aluno em JSON. Em produção, o arquivo é gerado no servidor e enviado por link temporário.</p>
        <Textarea readOnly value={json} className="num h-72 text-[11px]" aria-label="Dados exportados" />
        <div className="mt-3 flex justify-end">
          <Button
            onClick={() =>
              navigator.clipboard
                .writeText(json)
                .then(() => run(() => undefined, 'Copiado.'))
                .catch(() => run(() => undefined, 'Selecione o texto e copie manualmente.'))
            }
          >
            <Copy size={14} /> Copiar
          </Button>
        </div>
      </Modal>
    </div>
  );
}

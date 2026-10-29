import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bell, Camera, Check, ChevronRight, Clock, Copy, Lock, Minus, Play, Plus, ShieldCheck, Timer, TriangleAlert, X } from 'lucide-react';
import {
  activeCycle,
  addAssessment,
  audit,
  compareAssessments,
  exportStudentData,
  finishWorkout,
  formatDate,
  formatNumber,
  getPublished,
  latestAssessments,
  notify,
  regionLabel,
  resumeWorkout,
  setPhotoConsent,
  formatDose,
  isTimed,
  startWorkout,
  updateLogEntry,
  type BodyRegion,
  type Exercise,
  type LogEntry,
  type LoggedSet,
} from '@korvex/core';
import { useStore } from '../../state/store';
import { cycleProgress } from '../../derive';
import { Badge, Button, Callout, Card, EmptyState, Field, Input, Modal, Progress, Select, Textarea, Toggle, cx, LinkButton } from '../../components/ui';
import { AssessmentForm } from '../personal/StudentDetail';
import { ExerciseDemo, hasDemo, safeVideoUrl } from '../../components/demo/ExerciseDemo';

function useStudent() {
  const { state, studentViewId } = useStore();
  return state.students.find((s) => s.id === studentViewId) ?? null;
}

export function AlunoHome() {
  const { state, run } = useStore();
  const student = useStudent();
  const navigate = useNavigate();
  if (!student) return <EmptyState title="Selecione um aluno" />;
  if (student.status === 'convidado')
    return (
      <EmptyState title="Convite pendente" action={<Button variant="primary" onClick={() => run((d) => void (d.students.find((s) => s.id === student.id)!.status = 'ativo'), 'Convite aceito.')}>Aceitar convite</Button>}>
        {state.trainer.name} convidou você para acompanhar seus treinos pelo FitCore. Ao aceitar, você vê apenas os seus próprios dados.
      </EmptyState>
    );
  const plan = getPublished(state, student.id);
  const cycle = activeCycle(state, student.id);
  const inProgress = state.logs.find((l) => l.studentId === student.id && l.status === 'em_andamento');
  const notes = state.notifications.filter((n) => n.audience === 'aluno' && n.studentId === student.id && !n.read);
  const lastDone = state.logs.filter((l) => l.studentId === student.id && l.planVersionId === plan?.id && l.status === 'concluido').sort((a, b) => b.date.localeCompare(a.date))[0];
  const nextIdx = plan && lastDone ? (plan.days.findIndex((d) => d.id === lastDone.dayId) + 1) % plan.days.length : 0;

  const start = async (dayId: string) => {
    const log = await run((d) => startWorkout(d, student.id, dayId));
    if (log) navigate(`/aluno/sessao/${log.id}`);
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="eyebrow">{formatDate(state.now)}</p>
        <h1 className="display-narrow text-[22px] leading-tight">Olá, {student.name.split(' ')[0]}</h1>
      </div>

      {notes.map((n) => (
        <div key={n.id} className="rise flex items-start gap-3 rounded-xl border border-accent/40 bg-accent-soft p-3">
          <Bell size={18} className="mt-0.5 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{n.title}</p>
            <p className="text-[13px] text-muted">{n.body}</p>
          </div>
          <button aria-label="Dispensar" className="text-faint hover:text-fg" onClick={() => run((d) => void (d.notifications.find((x) => x.id === n.id)!.read = true))}>
            <X size={16} />
          </button>
        </div>
      ))}

      {inProgress && (
        <Link to={`/aluno/sessao/${inProgress.id}`} className="flex items-center justify-between rounded-xl bg-accent p-4 text-accent-ink">
          <span>
            <span className="block text-[12px] font-semibold opacity-80">Sessão em andamento</span>
            <span className="text-lg font-extrabold">Continuar treino</span>
          </span>
          <ChevronRight />
        </Link>
      )}

      {cycle && (() => {
        const p = cycleProgress(state, cycle);
        return (
          <Card className="p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">Ciclo atual</span>
              <span className="num text-muted">
                dia {p.elapsed} de {p.total}
              </span>
            </div>
            <div className="my-2">
              <Progress value={p.elapsed} max={p.total} label="Progresso do ciclo" />
            </div>
            <p className="text-[13px] text-muted">
              {p.daysLeft > 0 ? `Reavaliação em ${p.daysLeft} dia(s), em ${formatDate(cycle.dueDate)}.` : 'Hora da reavaliação. '}
              {p.daysLeft <= 7 && (
                <Link to="/aluno/avaliacao" className="font-semibold text-accent">
                  Registrar avaliação
                </Link>
              )}
            </p>
          </Card>
        );
      })()}

      {!plan ? (
        <Card>
          <EmptyState title="Seu treino está sendo preparado">Você recebe um aviso aqui assim que {state.trainer.name.split(' ')[0]} publicar o seu programa.</EmptyState>
        </Card>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold">Seu programa</h2>
            <Badge>versão {plan.version}</Badge>
          </div>
          {plan.days.map((d, i) => (
            <div key={d.id} className={cx('rounded-xl border bg-surface p-4', i === nextIdx && !inProgress ? 'border-accent/60' : 'border-line')}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {i === nextIdx && !inProgress && <p className="eyebrow mb-0.5 !text-accent">Próximo</p>}
                  <p className="display-narrow text-xl font-extrabold">{d.label}</p>
                  <p className="text-[13px] text-muted">
                    {d.focus} · {d.exercises.length} exercícios
                  </p>
                </div>
                <Button variant={i === nextIdx ? 'primary' : 'secondary'} disabled={!!inProgress} onClick={() => start(d.id)}>
                  Começar
                </Button>
              </div>
            </div>
          ))}
          {plan.cardio && (
            <p className="rounded-xl border border-line bg-surface p-4 text-[13px] text-muted">
              <strong className="text-fg">Cardio:</strong> {plan.cardio.sessionsPerWeek}x por semana, {plan.cardio.minutes} min, intensidade {plan.cardio.intensity}. {plan.cardio.notes}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function RestTimer({ seconds, onClose }: { seconds: number; onClose: () => void }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface-2"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)' }}
      role="timer"
      aria-live="polite"
    >
      <div className="gutter mx-auto flex max-w-md items-center gap-4 py-3">
        <Timer className={left === 0 ? 'text-ok' : 'text-accent'} />
        <div className="flex-1">
          <p className="text-[12px] text-muted">{left === 0 ? 'Descanso concluído' : 'Descanso'}</p>
          <p className="num text-2xl font-semibold">
            {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
          </p>
        </div>
        <Button size="sm" onClick={() => setLeft((l) => l + 15)}>
          +15s
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Pular
        </Button>
      </div>
    </div>
  );
}

export function Session() {
  const { logId = '' } = useParams();
  const { state, run, saved } = useStore();
  const navigate = useNavigate();
  const log = state.logs.find((l) => l.id === logId);
  const [rest, setRest] = useState<number | null>(null);
  const [discomfortFor, setDiscomfortFor] = useState<string | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const restKey = useRef(0);
  if (!log) return <EmptyState title="Sessão não encontrada" action={<LinkButton to="/aluno">Voltar</LinkButton>} />;
  const pv = state.plans.flatMap((p) => p.versions).find((v) => v.id === log.planVersionId);
  const day = pv?.days.find((d) => d.id === log.dayId);
  const names = new Map(state.exercises.map((e) => [e.id, e]));
  const editable = log.status === 'em_andamento';

  const patch = (weId: string, p: Partial<LogEntry>) => run((d) => updateLogEntry(d, log.id, weId, p));
  const setSet = (entry: LogEntry, i: number, p: Partial<LoggedSet>) => patch(entry.workoutExerciseId, { sets: entry.sets.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const doneSets = log.entries.reduce((a, e) => a + (e.skipped ? 0 : e.sets.filter((s) => s.reps != null).length), 0);
  const totalSets = day?.exercises.reduce((a, e) => a + e.sets, 0) ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="eyebrow">{formatDate(log.date)}</p>
          <h1 className="display-narrow text-[21px] sm:text-[24px]">{day?.label ?? 'Treino'}</h1>
        </div>
        <span className={cx('flex items-center gap-1 text-[12px]', saved ? 'text-ok' : 'text-warn')} aria-live="polite">
          {saved ? <Check size={14} /> : <TriangleAlert size={14} />}
          {saved ? 'Registros salvos' : 'Não foi possível salvar'}
        </span>
      </div>
      <Progress value={doneSets} max={totalSets} label="Séries registradas" />
      <p className="num -mt-2 text-[12px] text-muted">
        {doneSets} de {totalSets} séries
      </p>
      {!editable && (
        <Callout tone={log.status === 'interrompido' ? 'warn' : 'ok'}>
          {log.status === 'interrompido' ? 'Sessão interrompida. ' : 'Sessão concluída. '}
          {log.status === 'interrompido' && (
            <button className="font-semibold text-accent" onClick={() => run((d) => resumeWorkout(d, log.id), 'Sessão retomada.')}>
              Retomar agora
            </button>
          )}
        </Callout>
      )}

      {day?.exercises.map((we) => {
        const entry = log.entries.find((e) => e.workoutExerciseId === we.id)!;
        const ex = names.get(we.exerciseId);
        return (
          <Card key={we.id} className={cx('p-4', entry.skipped && 'opacity-60')}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[17px] font-bold">{ex?.name}</p>
                <p className="num text-[13px] text-muted">
                  {formatDose(we, ex)} · descanso {we.restSec}s · RPE {we.rpeTarget}
                  {we.suggestedLoadKg != null && <span className="text-accent"> · sugestão {we.suggestedLoadKg} kg</span>}
                </p>
              </div>
              {entry.discomfort && entry.discomfort.level > 0 && <Badge tone="bad">Desconforto {entry.discomfort.level}</Badge>}
            </div>
            {ex && <HowTo exercise={ex} />}
            {!entry.skipped && (
              <div className="mt-3 flex flex-col gap-2">
                <div className="grid grid-cols-[28px_1fr_1fr_1fr] gap-2 text-[11px] font-semibold text-muted">
                  <span>#</span>
                  <span>Carga (kg)</span>
                  <span>{isTimed(ex) ? 'Segundos' : 'Reps'}</span>
                  <span>RPE</span>
                </div>
                {entry.sets.map((s, i) => (
                  <div key={i} className="grid grid-cols-[28px_1fr_1fr_1fr] items-center gap-2">
                    <span className="num text-sm text-muted">{i + 1}</span>
                    <Input aria-label={`Carga da série ${i + 1}`} inputMode="decimal" disabled={!editable} value={s.loadKg ?? ''} onChange={(e) => setSet(entry, i, { loadKg: e.target.value === '' ? null : Number(e.target.value.replace(',', '.')) })} className="num h-12 text-base" />
                    <Input aria-label={`${isTimed(ex) ? 'Segundos' : 'Repetições'} da série ${i + 1}`} inputMode="numeric" disabled={!editable} value={s.reps ?? ''} onChange={(e) => setSet(entry, i, { reps: e.target.value === '' ? null : Number(e.target.value) })} className="num h-12 text-base" />
                    <Input aria-label={`Esforço da série ${i + 1}`} inputMode="decimal" disabled={!editable} value={s.rpe ?? ''} onChange={(e) => setSet(entry, i, { rpe: e.target.value === '' ? null : Number(e.target.value.replace(',', '.')) })} className="num h-12 text-base" />
                  </div>
                ))}
                {editable && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="lg"
                      variant={entry.sets.length < we.sets ? 'primary' : 'secondary'}
                      className="flex-1"
                      onClick={() => {
                        const last = entry.sets[entry.sets.length - 1];
                        patch(entry.workoutExerciseId, { sets: [...entry.sets, { loadKg: last?.loadKg ?? we.suggestedLoadKg, reps: null, rpe: null }] });
                        if (entry.sets.length > 0) {
                          restKey.current += 1;
                          setRest(we.restSec);
                        }
                      }}
                    >
                      <Plus size={18} /> Série
                    </Button>
                    {entry.sets.length > 0 && (
                      <Button size="lg" variant="ghost" aria-label="Remover última série" onClick={() => patch(entry.workoutExerciseId, { sets: entry.sets.slice(0, -1) })}>
                        <Minus size={18} />
                      </Button>
                    )}
                    <Button size="lg" variant="ghost" aria-label="Iniciar descanso" onClick={() => { restKey.current += 1; setRest(we.restSec); }}>
                      <Clock size={18} />
                    </Button>
                  </div>
                )}
              </div>
            )}
            {editable && (
              <div className="mt-3 flex flex-wrap gap-3 border-t border-line pt-3 text-[13px]">
                <button className="font-semibold text-muted hover:text-fg" onClick={() => patch(entry.workoutExerciseId, { skipped: !entry.skipped })}>
                  {entry.skipped ? 'Desfazer: vou fazer' : 'Não vou fazer este'}
                </button>
                <button className="font-semibold text-bad" onClick={() => setDiscomfortFor(we.id)}>
                  Relatar desconforto
                </button>
              </div>
            )}
          </Card>
        );
      })}

      {editable && (
        <div className="flex flex-col gap-2 pt-2">
          <Button size="lg" variant="primary" onClick={() => setFinishOpen(true)}>
            Finalizar treino
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              run((d) => finishWorkout(d, log.id, 'interrompido', notes), 'Sessão interrompida. Você pode retomar no histórico.').then(() => navigate('/aluno'))
            }
          >
            Interromper e continuar depois
          </Button>
        </div>
      )}

      {rest != null && <RestTimer key={restKey.current} seconds={rest} onClose={() => setRest(null)} />}

      <DiscomfortModal
        open={discomfortFor != null}
        onClose={() => setDiscomfortFor(null)}
        onSave={(level, region, note) => {
          patch(discomfortFor!, { discomfort: { level, region, note } });
          setDiscomfortFor(null);
        }}
      />
      <Modal open={finishOpen} onClose={() => setFinishOpen(false)} title="Finalizar treino">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            {doneSets} de {totalSets} séries registradas.
          </p>
          <Field label="Como foi? (opcional)" htmlFor="fin-notes">
            <Textarea id="fin-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <Button
            size="lg"
            variant="primary"
            onClick={() =>
              run((d) => finishWorkout(d, log.id, 'concluido', notes), 'Treino concluído e enviado ao seu personal.').then(() => {
                setFinishOpen(false);
                navigate('/aluno/historico');
              })
            }
          >
            Concluir
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function DiscomfortModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (level: number, region: BodyRegion | 'outra', note: string) => void }) {
  const [level, setLevel] = useState(3);
  const [region, setRegion] = useState<BodyRegion | 'outra'>('joelho');
  const [note, setNote] = useState('');
  return (
    <Modal open={open} onClose={onClose} title="Relatar desconforto">
      <div className="flex flex-col gap-4">
        <Callout tone="warn">Se sentir dor, pare o exercício. Este relato vai para o seu personal e pode pausar a próxima atualização do treino até ele revisar.</Callout>
        <Field label={`Intensidade: ${level} de 10`} htmlFor="dc-level">
          <input id="dc-level" type="range" min={1} max={10} value={level} onChange={(e) => setLevel(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
        </Field>
        <Field label="Região" htmlFor="dc-region">
          <Select id="dc-region" value={region} onChange={(e) => setRegion(e.target.value as BodyRegion | 'outra')}>
            {Object.entries(regionLabel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
            <option value="outra">Outra</option>
          </Select>
        </Field>
        <Field label="O que você sentiu?" htmlFor="dc-note">
          <Textarea id="dc-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Button variant="primary" onClick={() => onSave(level, region, note)}>
          Enviar relato
        </Button>
      </div>
    </Modal>
  );
}

export function AlunoHistory() {
  const { state, run } = useStore();
  const student = useStudent();
  if (!student) return null;
  const logs = state.logs.filter((l) => l.studentId === student.id).sort((a, b) => b.date.localeCompare(a.date));
  const label = (pvId: string, dayId: string) => state.plans.flatMap((p) => p.versions).find((v) => v.id === pvId)?.days.find((d) => d.id === dayId)?.label ?? 'Treino';
  return (
    <div className="flex flex-col gap-4">
      <h1 className="display-narrow text-[21px] sm:text-[24px]">Histórico</h1>
      {logs.length === 0 ? (
        <Card>
          <EmptyState title="Nenhum treino ainda">Seus treinos concluídos aparecem aqui.</EmptyState>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{label(l.planVersionId, l.dayId)}</p>
                  <p className="num text-[12px] text-muted">
                    {formatDate(l.date)} · {l.entries.reduce((a, e) => a + e.sets.length, 0)} séries
                  </p>
                </div>
                {l.status === 'interrompido' ? (
                  <Button size="sm" onClick={() => run((d) => resumeWorkout(d, l.id), 'Sessão retomada.')}>
                    Retomar
                  </Button>
                ) : (
                  <Link to={`/aluno/sessao/${l.id}`}>
                    <Badge tone={l.status === 'concluido' ? 'ok' : 'info'}>{l.status === 'concluido' ? 'Concluído' : 'Em andamento'}</Badge>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

export function AlunoAssessment() {
  const { state, run } = useStore();
  const student = useStudent();
  const [open, setOpen] = useState(false);
  if (!student) return null;
  const list = latestAssessments(state.assessments, student.id);
  const cmp = list.length >= 2 ? compareAssessments(list[1], list[0]) : null;
  return (
    <div className="flex flex-col gap-5">
      <h1 className="display-narrow text-[21px] sm:text-[24px]">Avaliação</h1>
      <Button size="lg" variant="primary" onClick={() => setOpen(true)}>
        Registrar minhas medidas
      </Button>
      {cmp && (
        <Card className="p-4">
          <p className="mb-2 font-bold">
            {formatDate(list[1].date)} → {formatDate(list[0].date)}
          </p>
          <ul className="num flex flex-col gap-1 text-sm">
            {cmp.rows
              .filter((r) => r.current != null)
              .map((r) => (
                <li key={r.key} className="flex justify-between gap-2">
                  <span className="font-sans text-muted">{r.label}</span>
                  <span>
                    {formatNumber(r.current!)} {r.unit} {r.diff != null && <span className="text-muted">({r.diff > 0 ? '+' : ''}{formatNumber(r.diff)})</span>}
                  </span>
                </li>
              ))}
          </ul>
          <p className="mt-2 text-[12px] text-faint">Variações pequenas entre duas medidas são normais. Seu personal analisa a tendência.</p>
        </Card>
      )}
      <PhotoSection />
      <AssessmentForm
        open={open}
        onClose={() => setOpen(false)}
        student={student}
        onSubmit={(form) =>
          run((d) => {
            const a = addAssessment(d, student.id, form, { collectedBy: student.name, source: 'aluno' });
            notify(d, { audience: 'personal', studentId: student.id, kind: 'avaliacao_recebida', title: 'Nova avaliação recebida', body: `${student.name} registrou uma avaliação.` });
            return a;
          }, 'Avaliação enviada ao seu personal.').then((r) => r && setOpen(false))
        }
      />
    </div>
  );
}

function PhotoSection() {
  const { run } = useStore();
  const student = useStudent()!;
  const [previews, setPreviews] = useState<Record<string, string>>({});
  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Camera size={18} className="text-muted" />
        <h2 className="font-bold">Fotos de acompanhamento (opcional)</h2>
      </div>
      <p className="text-[13px] text-muted">
        Fotos ajudam seu personal a acompanhar a evolução visual. Elas não são usadas para estimar gordura, não são enviadas à IA e nunca são exigidas: tudo funciona sem elas.
      </p>
      <Toggle
        checked={student.photoConsent}
        onChange={(v) => run((d) => setPhotoConsent(d, student.id, v), v ? 'Consentimento registrado.' : 'Consentimento revogado. Fotos removidas.')}
        label="Autorizo o envio de fotos ao meu personal"
        description="Finalidade: acompanhamento visual. Armazenamento privado, acesso registrado. Você pode revogar a qualquer momento."
      />
      {student.photoConsent && (
        <>
          <ul className="list-disc pl-5 text-[12px] text-muted">
            <li>Mesmo local, luz e distância em todas as fotos.</li>
            <li>Roupa de treino. Não é necessário expor mais do que isso.</li>
            <li>Câmera na altura do peito, corpo inteiro no quadro.</li>
          </ul>
          <div className="grid grid-cols-3 gap-2">
            {(['frente', 'perfil', 'costas'] as const).map((c) => (
              <label key={c} className="flex aspect-[3/4] max-w-full cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border border-dashed border-line bg-surface-2 text-[12px] text-muted">
                {previews[c] ? <img src={previews[c]} alt={`Prévia ${c}`} className="h-full w-full object-cover" /> : <><Camera size={18} /> {c[0].toUpperCase() + c.slice(1)}</>}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 8 * 1024 * 1024) return;
                    setPreviews((p) => ({ ...p, [c]: URL.createObjectURL(f) }));
                  }}
                />
              </label>
            ))}
          </div>
          <Callout tone="neutral" icon={<Lock size={16} />}>
            No protótipo a foto aparece só nesta tela e não é enviada nem salva. O envio real depende do armazenamento privado (Supabase Storage) com links temporários.
          </Callout>
        </>
      )}
    </Card>
  );
}

export function AlunoProfile() {
  const { state, run } = useStore();
  const student = useStudent();
  const [exportOpen, setExportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  if (!student) return null;
  const json = exportOpen ? JSON.stringify(exportStudentData(state, student.id), null, 2) : '';
  return (
    <div className="flex flex-col gap-5">
      <h1 className="display-narrow text-[21px] sm:text-[24px]">Perfil</h1>
      <Card className="flex flex-col gap-1 p-4 text-sm">
        <p className="font-bold">{student.name}</p>
        <p className="text-muted">{student.email}</p>
        <p className="text-muted">Personal: {state.trainer.name}</p>
      </Card>
      <Card className="flex flex-col gap-4 p-4">
        <h2 className="flex items-center gap-2 font-bold">
          <ShieldCheck size={18} className="text-accent" /> Privacidade
        </h2>
        <Toggle
          checked={student.photoConsent}
          onChange={(v) => run((d) => setPhotoConsent(d, student.id, v), v ? 'Consentimento registrado.' : 'Consentimento revogado.')}
          label="Fotos de acompanhamento"
          description="Opcional. Revogar remove as fotos."
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setExportOpen(true)}>Exportar meus dados</Button>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            Solicitar exclusão
          </Button>
        </div>
      </Card>
      <Modal open={exportOpen} onClose={() => setExportOpen(false)} title="Seus dados" wide>
        <Textarea readOnly value={json} className="num h-72 text-[11px]" aria-label="Dados exportados" />
        <div className="mt-3 flex justify-end">
          <Button onClick={() => navigator.clipboard.writeText(json).catch(() => undefined)}>
            <Copy size={14} /> Copiar
          </Button>
        </div>
      </Modal>
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Solicitar exclusão dos dados">
        <p className="text-sm text-muted">
          Seu personal e a equipe da Korvex recebem a solicitação. A exclusão cobre treinos, avaliações, fotos e dados derivados, respeitando obrigações legais de retenção. Você recebe a
          confirmação por e-mail.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
            Voltar
          </Button>
          <Button
            variant="danger"
            onClick={() =>
              run((d) => {
                audit(d, student.name, 'solicitou_exclusao', `aluno:${student.id}`, 'Solicitação de titular (LGPD).');
                notify(d, { audience: 'personal', studentId: student.id, kind: 'solicitacao_exclusao', title: 'Solicitação de exclusão de dados', body: `${student.name} pediu a exclusão dos dados.` });
              }, 'Solicitação registrada.').then(() => setDeleteOpen(false))
            }
          >
            Enviar solicitação
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/** "Como executar": a animação só é montada com o painel aberto, para não animar a lista inteira. */
function HowTo({ exercise }: { exercise: Exercise }) {
  const [open, setOpen] = useState(false);
  const video = safeVideoUrl(exercise.videoUrl);
  return (
    <details className="mt-2 text-[13px] text-muted" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer font-semibold text-fg">Como executar</summary>
      {open && hasDemo(exercise.id) && <ExerciseDemo exerciseId={exercise.id} name={exercise.name} className="mt-2 max-w-sm" />}
      <p className="mt-2">{exercise.instructions}</p>
      {exercise.commonErrors.length ? <p className="mt-1">Evite: {exercise.commonErrors.join('; ').toLowerCase()}.</p> : null}
      {video && (
        <a href={video} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 font-semibold text-accent hover:underline">
          <Play className="h-3.5 w-3.5" /> Ver vídeo do seu personal
        </a>
      )}
    </details>
  );
}

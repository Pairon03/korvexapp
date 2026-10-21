import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2, Copy } from 'lucide-react';
import {
  agentConfigFor,
  getPlan,
  getPublished,
  muscleLabel,
  publishAndTrack,
  saveDraft,
  validatePlan,
  validationContext,
  type CardioPrescription,
  type Exercise,
  type WorkoutDay,
  type WorkoutExercise,
} from '@korvex/core';
import { useStore } from '../../state/store';
import { Badge, Button, Callout, Card, CardHeader, EmptyState, Field, Input, Modal, Select, Textarea, Toggle, cx } from '../../components/ui';
import { ValidationList, VolumeChart } from '../../components/PlanView';

let tmp = 0;
const tid = (p: string) => `tmp_${p}_${++tmp}`;

export default function Builder() {
  const { id = '' } = useParams();
  const { state, run } = useStore();
  const navigate = useNavigate();
  const student = state.students.find((s) => s.id === id);
  const base = getPlan(state, id)?.versions.find((v) => v.status === 'rascunho') ?? getPublished(state, id);
  const [days, setDays] = useState<WorkoutDay[]>(() => (base ? structuredClone(base.days) : [{ id: tid('d'), label: 'Treino A', focus: '', exercises: [] }]));
  const [cardio, setCardio] = useState<CardioPrescription | null>(base?.cardio ?? null);
  const [reason, setReason] = useState('');
  const [picker, setPicker] = useState<string | null>(null);

  if (!student) return <EmptyState title="Aluno não encontrado" />;
  const { version } = agentConfigFor(state, student);
  const cfg = version.config;
  const byId = new Map(state.exercises.map((e) => [e.id, e]));
  const plan = { days, weeklyFrequency: days.length, cardio };
  const validations = validatePlan(plan, validationContext(state, student));
  const blocked = validations.some((v) => !v.ok && v.severity === 'bloqueio');

  const updateDay = (dayId: string, fn: (d: WorkoutDay) => WorkoutDay) => setDays((ds) => ds.map((d) => (d.id === dayId ? fn(d) : d)));
  const updateEx = (dayId: string, exId: string, patch: Partial<WorkoutExercise>) =>
    updateDay(dayId, (d) => ({ ...d, exercises: d.exercises.map((e) => (e.id === exId ? { ...e, ...patch } : e)) }));
  const move = (dayId: string, idx: number, dir: -1 | 1) =>
    updateDay(dayId, (d) => {
      const ex = [...d.exercises];
      const j = idx + dir;
      if (j < 0 || j >= ex.length) return d;
      [ex[idx], ex[j]] = [ex[j], ex[idx]];
      return { ...d, exercises: ex };
    });

  const save = async (publish: boolean) => {
    const res = await run(
      (d) => {
        const pv = saveDraft(d, id, { days, cardio, changeReason: reason.trim() || 'Edição manual do personal.' }, d.trainer.name);
        if (publish) publishAndTrack(d, id, pv.id, d.trainer.name);
        return pv;
      },
      (pv) => (publish ? `Versão ${pv.version} publicada.` : `Rascunho v${pv.version} salvo.`),
    );
    if (res) navigate(`/personal/alunos/${id}`);
  };

  return (
    <div className="flex flex-col gap-5">
      <Link to={`/personal/alunos/${id}`} className="flex w-fit items-center gap-1 text-[13px] text-muted hover:text-fg">
        <ArrowLeft size={14} /> {student.name}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display-narrow text-[28px] font-extrabold">Construtor de treino</h1>
          <p className="text-sm text-muted">
            {base ? `Partindo da versão ${base.version}.` : 'Novo programa.'} Ao salvar, uma nova versão é criada; a anterior fica no histórico.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save(false)}>Salvar rascunho</Button>
          <Button variant="primary" disabled={blocked} onClick={() => save(true)} title={blocked ? 'Corrija os bloqueios para publicar' : undefined}>
            Salvar e publicar
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          {days.map((d, di) => (
            <Card key={d.id}>
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
                <Input aria-label="Nome do dia" value={d.label} onChange={(e) => updateDay(d.id, (x) => ({ ...x, label: e.target.value }))} className="w-36 font-semibold" />
                <Input aria-label="Foco do dia" placeholder="Foco (ex.: pernas)" value={d.focus} onChange={(e) => updateDay(d.id, (x) => ({ ...x, focus: e.target.value }))} className="min-w-0 flex-1" />
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Duplicar dia"
                  onClick={() => setDays((ds) => [...ds.slice(0, di + 1), { ...structuredClone(d), id: tid('d'), label: `${d.label} (cópia)`, exercises: d.exercises.map((e) => ({ ...e, id: tid('e') })) }, ...ds.slice(di + 1)])}
                >
                  <Copy size={14} />
                </Button>
                <Button size="sm" variant="ghost" aria-label="Remover dia" onClick={() => setDays((ds) => ds.filter((x) => x.id !== d.id))}>
                  <Trash2 size={14} />
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] text-muted">
                      <th className="px-4 py-2 font-semibold">Exercício</th>
                      <th className="w-16 py-2 font-semibold">Séries</th>
                      <th className="w-32 py-2 font-semibold">Reps</th>
                      <th className="w-20 py-2 font-semibold">Desc. (s)</th>
                      <th className="w-16 py-2 font-semibold">RPE</th>
                      <th className="w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {d.exercises.map((we, i) => {
                      const ex = byId.get(we.exerciseId);
                      const conflict = ex?.cautionRegions.some((r) => student.limitations.includes(r));
                      return (
                        <tr key={we.id} className="border-t border-line align-middle">
                          <td className="px-4 py-2">
                            <p className={cx('font-semibold', conflict && 'text-bad')}>{ex?.name ?? we.exerciseId}</p>
                            <Input aria-label="Observação" placeholder="Observação" value={we.notes} onChange={(e) => updateEx(d.id, we.id, { notes: e.target.value })} className="mt-1 h-8 text-[12px]" />
                          </td>
                          <td className="py-2 pr-2">
                            <Input aria-label="Séries" type="number" min={1} max={8} value={we.sets} onChange={(e) => updateEx(d.id, we.id, { sets: Number(e.target.value) })} className="num h-8 px-2" />
                          </td>
                          <td className="py-2 pr-2">
                            <div className="flex items-center gap-1">
                              <Input aria-label="Repetições mínimas" type="number" value={we.repMin} onChange={(e) => updateEx(d.id, we.id, { repMin: Number(e.target.value) })} className="num h-8 px-2" />
                              <span className="text-faint">–</span>
                              <Input aria-label="Repetições máximas" type="number" value={we.repMax} onChange={(e) => updateEx(d.id, we.id, { repMax: Number(e.target.value) })} className="num h-8 px-2" />
                            </div>
                          </td>
                          <td className="py-2 pr-2">
                            <Input aria-label="Descanso" type="number" step={15} value={we.restSec} onChange={(e) => updateEx(d.id, we.id, { restSec: Number(e.target.value) })} className="num h-8 px-2" />
                          </td>
                          <td className="py-2 pr-2">
                            <Input aria-label="RPE alvo" type="number" step={0.5} min={5} max={10} value={we.rpeTarget} onChange={(e) => updateEx(d.id, we.id, { rpeTarget: Number(e.target.value) })} className="num h-8 px-2" />
                          </td>
                          <td className="py-2 pr-3">
                            <div className="flex justify-end">
                              <button className="rounded p-1 text-muted hover:text-fg disabled:opacity-30" disabled={i === 0} onClick={() => move(d.id, i, -1)} aria-label="Subir">
                                <ArrowUp size={15} />
                              </button>
                              <button className="rounded p-1 text-muted hover:text-fg disabled:opacity-30" disabled={i === d.exercises.length - 1} onClick={() => move(d.id, i, 1)} aria-label="Descer">
                                <ArrowDown size={15} />
                              </button>
                              <button className="rounded p-1 text-muted hover:text-bad" onClick={() => updateDay(d.id, (x) => ({ ...x, exercises: x.exercises.filter((e) => e.id !== we.id) }))} aria-label="Remover exercício">
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-line px-4 py-2.5">
                <Button size="sm" variant="ghost" onClick={() => setPicker(d.id)}>
                  <Plus size={14} /> Adicionar exercício
                </Button>
              </div>
            </Card>
          ))}
          <Button
            variant="secondary"
            className="self-start"
            disabled={days.length >= 7}
            onClick={() => setDays((ds) => [...ds, { id: tid('d'), label: `Treino ${String.fromCharCode(65 + ds.length)}`, focus: '', exercises: [] }])}
          >
            <Plus size={15} /> Adicionar dia
          </Button>

          <Card className="flex flex-col gap-4 p-5">
            <Toggle
              checked={cardio != null}
              onChange={(v) => setCardio(v ? { sessionsPerWeek: cfg.cardio.sessionsPerWeek || 2, minutes: cfg.cardio.minutes || 20, intensity: cfg.cardio.intensity, notes: '' } : null)}
              label="Incluir cardio"
            />
            {cardio && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Sessões/semana" htmlFor="c-s">
                  <Input id="c-s" type="number" min={0} max={7} value={cardio.sessionsPerWeek} onChange={(e) => setCardio({ ...cardio, sessionsPerWeek: Number(e.target.value) })} />
                </Field>
                <Field label="Minutos" htmlFor="c-m">
                  <Input id="c-m" type="number" min={5} max={120} value={cardio.minutes} onChange={(e) => setCardio({ ...cardio, minutes: Number(e.target.value) })} />
                </Field>
                <Field label="Intensidade" htmlFor="c-i">
                  <Select id="c-i" value={cardio.intensity} onChange={(e) => setCardio({ ...cardio, intensity: e.target.value as CardioPrescription['intensity'] })}>
                    <option value="leve">Leve</option>
                    <option value="moderada">Moderada</option>
                    <option value="intensa">Intensa</option>
                  </Select>
                </Field>
              </div>
            )}
          </Card>
          <Field label="Motivo da mudança (fica no histórico)" htmlFor="b-reason">
            <Textarea id="b-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: troca do agachamento livre por leg press após relato de desconforto." />
          </Field>
        </div>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-16 xl:self-start">
          <Card>
            <CardHeader title="Validações" subtitle={blocked ? 'Há bloqueios. Publicação desabilitada.' : 'Pronto para publicar.'} />
            <div className="p-4">
              <ValidationList results={validations} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Volume semanal por grupo" />
            <div className="p-2">
              <VolumeChart plan={plan} exercises={state.exercises} max={cfg.volume.maxSetsPerMuscleWeek} min={cfg.volume.minSetsPerMuscleWeek} />
            </div>
          </Card>
        </aside>
      </div>

      <ExercisePicker
        open={picker != null}
        onClose={() => setPicker(null)}
        exercises={state.exercises}
        studentEquipment={student.equipment}
        studentLimitations={student.limitations}
        onPick={(ex) => {
          if (!picker) return;
          updateDay(picker, (d) => ({
            ...d,
            exercises: [
              ...d.exercises,
              { id: tid('e'), exerciseId: ex.id, sets: 3, repMin: 8, repMax: 12, restSec: Math.min(Math.max(90, cfg.rest.minSec), cfg.rest.maxSec), rpeTarget: cfg.effort.targetRpeMax - 0.5, suggestedLoadKg: null, notes: '' },
            ],
          }));
          setPicker(null);
        }}
      />
    </div>
  );
}

function ExercisePicker({
  open,
  onClose,
  exercises,
  studentEquipment,
  studentLimitations,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  exercises: Exercise[];
  studentEquipment: string[];
  studentLimitations: string[];
  onPick: (e: Exercise) => void;
}) {
  const [q, setQ] = useState('');
  const [onlyCompatible, setOnlyCompatible] = useState(true);
  const list = exercises
    .filter((e) => e.active)
    .map((e) => ({
      e,
      equipOk: e.equipment.some((x) => studentEquipment.includes(x)),
      cautionOk: !e.cautionRegions.some((r) => studentLimitations.includes(r)),
    }))
    .filter(({ e, equipOk, cautionOk }) => (!onlyCompatible || (equipOk && cautionOk)) && (!q || e.name.toLowerCase().includes(q.toLowerCase()) || muscleLabel[e.primary].toLowerCase().includes(q.toLowerCase())));
  return (
    <Modal open={open} onClose={onClose} title="Adicionar exercício">
      <div className="flex flex-col gap-3">
        <Input autoFocus aria-label="Buscar exercício" placeholder="Buscar por nome ou grupo muscular" value={q} onChange={(e) => setQ(e.target.value)} />
        <Toggle checked={onlyCompatible} onChange={setOnlyCompatible} label="Só compatíveis com o aluno" description="Equipamentos disponíveis e sem conflito com limitações." />
        <ul className="flex max-h-80 flex-col overflow-y-auto">
          {list.map(({ e, equipOk, cautionOk }) => (
            <li key={e.id}>
              <button onClick={() => onPick(e)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-surface-2">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{e.name}</span>
                  <span className="text-[12px] text-muted">{muscleLabel[e.primary]}</span>
                </span>
                <span className="flex shrink-0 gap-1">
                  {!equipOk && <Badge tone="warn">Sem equipamento</Badge>}
                  {!cautionOk && <Badge tone="bad">Limitação</Badge>}
                </span>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="p-4 text-center text-[13px] text-muted">Nenhum exercício encontrado.</li>}
        </ul>
        <Callout tone="neutral">Exercícios fora da biblioteca não podem ser adicionados, nem pela IA.</Callout>
      </div>
    </Modal>
  );
}

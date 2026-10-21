import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Bot, ShieldCheck } from 'lucide-react';
import { formatDateTime, goalLabel, levelLabel, splitLabel, updateAgent, type AgentConfig, type Goal, type Level, type SplitType } from '@korvex/core';
import { useStore } from '../../state/store';
import { Badge, Button, Callout, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select, Textarea, Toggle } from '../../components/ui';
import { Chip } from './Students';

export default function Agents() {
  const { state } = useStore();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Agentes de IA" subtitle="Cada agente aplica a sua metodologia. Regras estruturadas definem os limites; o texto livre só complementa." />
      <div className="grid gap-4 lg:grid-cols-2">
        {state.agents.map((a) => {
          const v = a.versions.find((x) => x.version === a.currentVersion)!;
          const students = state.students.filter((s) => s.agentId === a.id && s.status !== 'arquivado').length;
          return (
            <Link key={a.id} to={`/personal/agentes/${a.id}`} className="rounded-xl border border-line bg-surface p-5 hover:border-accent/40">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    <Bot size={20} />
                  </span>
                  <div>
                    <p className="font-bold">{v.config.name}</p>
                    <p className="text-[12px] text-muted">
                      versão {v.version} · {students} aluno(s)
                    </p>
                  </div>
                </div>
                <Badge tone={v.config.autoPublish ? 'accent' : 'neutral'}>{v.config.autoPublish ? 'Publicação automática' : 'Aprovação manual'}</Badge>
              </div>
              <p className="mt-3 text-[13px] text-muted">{v.config.description}</p>
              <dl className="num mt-4 grid grid-cols-3 gap-2 text-[12px]">
                <div>
                  <dt className="text-faint">Divisão</dt>
                  <dd className="font-sans font-semibold">{splitLabel[v.config.split]}</dd>
                </div>
                <div>
                  <dt className="text-faint">Ciclo</dt>
                  <dd className="font-semibold">{v.config.cycle.days} dias</dd>
                </div>
                <div>
                  <dt className="text-faint">Volume</dt>
                  <dd className="font-semibold">
                    {v.config.volume.minSetsPerMuscleWeek}–{v.config.volume.maxSetsPerMuscleWeek} séries
                  </dd>
                </div>
              </dl>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

const GOALS = Object.keys(goalLabel) as Goal[];
const LEVELS = Object.keys(levelLabel) as Level[];

export function AgentEditor() {
  const { id = '' } = useParams();
  const { state, run } = useStore();
  const agent = state.agents.find((a) => a.id === id);
  const current = agent?.versions.find((v) => v.version === agent.currentVersion);
  const [cfg, setCfg] = useState<AgentConfig | null>(current ? structuredClone(current.config) : null);
  const [note, setNote] = useState('');
  if (!agent || !current || !cfg) return <EmptyState title="Agente não encontrado" />;

  const set = <K extends keyof AgentConfig>(k: K, v: AgentConfig[K]) => setCfg((c) => (c ? { ...c, [k]: v } : c));
  const setIn = <K extends keyof AgentConfig>(k: K, patch: Partial<AgentConfig[K]>) => setCfg((c) => (c ? { ...c, [k]: { ...(c[k] as object), ...patch } } : c));
  const n = (v: string) => Number(v.replace(',', '.'));
  const dirty = JSON.stringify(cfg) !== JSON.stringify(current.config);
  const affected = state.students.filter((s) => s.agentId === agent.id && s.status !== 'arquivado');

  return (
    <div className="flex flex-col gap-5">
      <Link to="/personal/agentes" className="flex w-fit items-center gap-1 text-[13px] text-muted hover:text-fg">
        <ArrowLeft size={14} /> Agentes
      </Link>
      <PageHeader
        title={cfg.name}
        subtitle={`Versão ${current.version} em uso por ${affected.length} aluno(s). Salvar cria a versão ${current.version + 1}.`}
        actions={
          <Button
            variant="primary"
            disabled={!dirty}
            onClick={() => run((d) => updateAgent(d, agent.id, cfg, d.trainer.name, note.trim()), (v) => `Versão ${v} do agente salva. Vale para as próximas gerações.`).then(() => setNote(''))}
          >
            Salvar nova versão
          </Button>
        }
      />
      <Callout tone="info" icon={<ShieldCheck size={18} className="text-info" />} title="Treinos publicados não mudam">
        A nova configuração vale a partir da próxima proposta de cada aluno. As validações de segurança do sistema continuam ativas independentemente do que for configurado aqui.
      </Callout>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="flex flex-col gap-4 p-5">
          <h3 className="font-bold">Identidade e metodologia</h3>
          <Field label="Nome" htmlFor="a-name">
            <Input id="a-name" value={cfg.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Descrição" htmlFor="a-desc">
            <Textarea id="a-desc" value={cfg.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <Field label="Metodologia" htmlFor="a-meth">
            <Textarea id="a-meth" value={cfg.methodology} onChange={(e) => set('methodology', e.target.value)} />
          </Field>
          <Field label="Divisão semanal" htmlFor="a-split">
            <Select id="a-split" value={cfg.split} onChange={(e) => set('split', e.target.value as SplitType)}>
              {(Object.keys(splitLabel) as SplitType[]).map((s) => (
                <option key={s} value={s}>
                  {splitLabel[s]}
                </option>
              ))}
            </Select>
          </Field>
          <fieldset>
            <legend className="mb-2 text-[13px] font-semibold">Objetivos atendidos</legend>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <Chip key={g} on={cfg.goals.includes(g)} onClick={() => set('goals', cfg.goals.includes(g) ? cfg.goals.filter((x) => x !== g) : [...cfg.goals, g])}>
                  {goalLabel[g]}
                </Chip>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-[13px] font-semibold">Níveis de experiência</legend>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((l) => (
                <Chip key={l} on={cfg.levels.includes(l)} onClick={() => set('levels', cfg.levels.includes(l) ? cfg.levels.filter((x) => x !== l) : [...cfg.levels, l])}>
                  {levelLabel[l]}
                </Chip>
              ))}
            </div>
          </fieldset>
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <h3 className="font-bold">Carga de treino</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="RPE alvo mínimo" htmlFor="a-rpe1">
              <Input id="a-rpe1" type="number" step={0.5} min={5} max={10} value={cfg.effort.targetRpeMin} onChange={(e) => setIn('effort', { targetRpeMin: n(e.target.value) })} />
            </Field>
            <Field label="RPE alvo máximo" htmlFor="a-rpe2">
              <Input id="a-rpe2" type="number" step={0.5} min={5} max={10} value={cfg.effort.targetRpeMax} onChange={(e) => setIn('effort', { targetRpeMax: n(e.target.value) })} />
            </Field>
            <Field label="Descanso mínimo (s)" htmlFor="a-r1">
              <Input id="a-r1" type="number" step={15} value={cfg.rest.minSec} onChange={(e) => setIn('rest', { minSec: n(e.target.value) })} />
            </Field>
            <Field label="Descanso máximo (s)" htmlFor="a-r2">
              <Input id="a-r2" type="number" step={15} value={cfg.rest.maxSec} onChange={(e) => setIn('rest', { maxSec: n(e.target.value) })} />
            </Field>
            <Field label="Séries mín. por grupo/semana" htmlFor="a-v1">
              <Input id="a-v1" type="number" value={cfg.volume.minSetsPerMuscleWeek} onChange={(e) => setIn('volume', { minSetsPerMuscleWeek: n(e.target.value) })} />
            </Field>
            <Field label="Séries máx. por grupo/semana" htmlFor="a-v2">
              <Input id="a-v2" type="number" value={cfg.volume.maxSetsPerMuscleWeek} onChange={(e) => setIn('volume', { maxSetsPerMuscleWeek: n(e.target.value) })} />
            </Field>
          </div>
          <h3 className="mt-2 font-bold">Progressão e regressão</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sessões mínimas para progredir" htmlFor="a-p1">
              <Input id="a-p1" type="number" min={1} value={cfg.progression.minSessions} onChange={(e) => setIn('progression', { minSessions: n(e.target.value) })} />
            </Field>
            <Field label="Aumento de carga (%)" htmlFor="a-p2">
              <Input id="a-p2" type="number" min={1} max={15} value={cfg.progression.loadIncreasePct} onChange={(e) => setIn('progression', { loadIncreasePct: n(e.target.value) })} />
            </Field>
            <Field label="Reduzir volume se RPE médio acima de" htmlFor="a-g1">
              <Input id="a-g1" type="number" step={0.5} value={cfg.regression.rpeAbove} onChange={(e) => setIn('regression', { rpeAbove: n(e.target.value) })} />
            </Field>
            <Field label="Diante de desconforto leve" htmlFor="a-g2">
              <Select id="a-g2" value={cfg.regression.onDiscomfort} onChange={(e) => setIn('regression', { onDiscomfort: e.target.value as 'substituir' | 'reduzir' })}>
                <option value="substituir">Substituir o exercício</option>
                <option value="reduzir">Reduzir séries</option>
              </Select>
            </Field>
          </div>
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <h3 className="font-bold">Ciclo e segurança</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Duração do ciclo (dias)" htmlFor="a-c1" hint="Padrão: 45 dias">
              <Input id="a-c1" type="number" min={14} max={120} value={cfg.cycle.days} onChange={(e) => setIn('cycle', { days: n(e.target.value) })} />
            </Field>
            <Field label="Adesão mínima (%)" htmlFor="a-c2">
              <Input id="a-c2" type="number" min={0} max={100} value={cfg.cycle.minAdherencePct} onChange={(e) => setIn('cycle', { minAdherencePct: n(e.target.value) })} />
            </Field>
            <Field label="Variação máx. de volume (%)" htmlFor="a-c3">
              <Input id="a-c3" type="number" min={5} max={100} value={cfg.cycle.maxVolumeChangePct} onChange={(e) => setIn('cycle', { maxVolumeChangePct: n(e.target.value) })} />
            </Field>
            <Field label="Bloquear com desconforto nível ≥" htmlFor="a-s1">
              <Input id="a-s1" type="number" min={1} max={10} value={cfg.safety.blockDiscomfortLevel} onChange={(e) => setIn('safety', { blockDiscomfortLevel: n(e.target.value) })} />
            </Field>
            <Field label="Inconsistência de peso acima de (%)" htmlFor="a-s2">
              <Input id="a-s2" type="number" min={1} max={30} value={cfg.safety.maxWeightChangePct} onChange={(e) => setIn('safety', { maxWeightChangePct: n(e.target.value) })} />
            </Field>
          </div>
          <Toggle checked={cfg.cycle.requireAssessment} onChange={(v) => setIn('cycle', { requireAssessment: v })} label="Exigir avaliação para atualizar" description="Peso ou medidas. Fotos nunca são exigidas." />
          <Toggle checked={cfg.autoPublish} onChange={(v) => set('autoPublish', v)} label="Permitir publicação automática" description="Só para alunos com autorização e quando nenhuma validação ou alerta bloquear." />
          <Field label="Limite de execuções de IA por mês" htmlFor="a-ai">
            <Input id="a-ai" type="number" min={0} value={cfg.aiRunsPerMonth} onChange={(e) => set('aiRunsPerMonth', n(e.target.value))} />
          </Field>
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <h3 className="font-bold">Cardio e instruções livres</h3>
          <Toggle checked={cfg.cardio.enabled} onChange={(v) => setIn('cardio', { enabled: v })} label="Incluir cardio nos programas" />
          {cfg.cardio.enabled && (
            <div className="grid grid-cols-3 gap-3">
              <Field label="Sessões/semana" htmlFor="a-cd1">
                <Input id="a-cd1" type="number" min={0} max={7} value={cfg.cardio.sessionsPerWeek} onChange={(e) => setIn('cardio', { sessionsPerWeek: n(e.target.value) })} />
              </Field>
              <Field label="Minutos" htmlFor="a-cd2">
                <Input id="a-cd2" type="number" min={5} max={60} value={cfg.cardio.minutes} onChange={(e) => setIn('cardio', { minutes: n(e.target.value) })} />
              </Field>
              <Field label="Intensidade" htmlFor="a-cd3">
                <Select id="a-cd3" value={cfg.cardio.intensity} onChange={(e) => setIn('cardio', { intensity: e.target.value as AgentConfig['cardio']['intensity'] })}>
                  <option value="leve">Leve</option>
                  <option value="moderada">Moderada</option>
                  <option value="intensa">Intensa</option>
                </Select>
              </Field>
            </div>
          )}
          <Field label="Instruções livres" htmlFor="a-free" hint="Enviadas ao modelo como preferência. Não desativam validações nem limites.">
            <Textarea id="a-free" value={cfg.freeInstructions} onChange={(e) => set('freeInstructions', e.target.value)} className="min-h-28" />
          </Field>
          <Field label="Nota desta versão" htmlFor="a-note">
            <Input id="a-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: reduzi o volume máximo para iniciantes" />
          </Field>
        </Card>
      </div>

      <Card>
        <CardHeader title="Versões do agente" />
        <ul className="divide-y divide-line">
          {[...agent.versions].reverse().map((v) => (
            <li key={v.version} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13px]">
              <span className="font-semibold">v{v.version}</span>
              {v.version === agent.currentVersion && <Badge tone="ok">Em uso</Badge>}
              <span className="text-muted">
                {v.author} · {formatDateTime(v.createdAt)}
              </span>
              <span className="min-w-0 flex-1 text-muted">
                {v.changedFields.length ? `Alterou: ${v.changedFields.join(', ')}` : ''} {v.note && `— ${v.note}`}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

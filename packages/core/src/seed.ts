// Dados FICTÍCIOS para desenvolvimento e demonstração. Nunca usar em produção.
// Os treinos são gerados pelos mesmos serviços usados pela aplicação.
import { buildAgentContext } from './ai/context';
import { buildInitialProposal } from './ai/demo-provider';
import { calculateBodyFat } from './assessment';
import { EXERCISES } from './exercises';
import { createDraft, draftFromProposal, publishVersion, startCycle } from './plans';
import type {
  AgentConfig,
  Assessment,
  MuscleGroup,
  PlatformState,
  Student,
  WorkoutLog,
} from './types';
import { addDays, ageAt, nextId } from './util';

export const DEMO_NOW = '2026-10-21T13:00:00.000Z';
export const SCHEMA_VERSION = 3;

const hypertrophyAgent: AgentConfig = {
  name: 'Hipertrofia progressiva',
  description: 'Progressão dupla (repetições e depois carga) com volume moderado e controle de esforço por RPE.',
  goals: ['hipertrofia', 'forca'],
  levels: ['iniciante', 'intermediario', 'avancado'],
  methodology: 'Progressão dupla: ao completar o topo da faixa em todas as séries por 2 sessões com RPE até 8, aumentar a carga.',
  split: 'abc',
  effort: { targetRpeMin: 7, targetRpeMax: 8.5 },
  rest: { minSec: 45, maxSec: 180 },
  volume: { minSetsPerMuscleWeek: 6, maxSetsPerMuscleWeek: 20 },
  progression: { minSessions: 3, loadIncreasePct: 5 },
  regression: { rpeAbove: 9, onDiscomfort: 'substituir' },
  cycle: { days: 45, minAdherencePct: 60, requireAssessment: true, maxVolumeChangePct: 30 },
  safety: { blockDiscomfortLevel: 5, maxWeightChangePct: 8 },
  cardio: { enabled: false, sessionsPerWeek: 0, minutes: 0, intensity: 'leve' },
  autoPublish: true,
  aiRunsPerMonth: 150,
  freeInstructions: 'Priorizar exercícios em máquina para iniciantes. Manter a ordem: multiarticulares antes de isolados.',
};

const healthAgent: AgentConfig = {
  name: 'Saúde e condicionamento',
  description: 'Treino de corpo inteiro com volume baixo a moderado e cardio regular.',
  goals: ['saude', 'emagrecimento', 'condicionamento'],
  levels: ['iniciante', 'intermediario'],
  methodology: 'Corpo inteiro, esforço moderado, foco em constância. Progressão por repetições antes de carga.',
  split: 'fullbody',
  effort: { targetRpeMin: 6, targetRpeMax: 8 },
  rest: { minSec: 30, maxSec: 120 },
  volume: { minSetsPerMuscleWeek: 4, maxSetsPerMuscleWeek: 14 },
  progression: { minSessions: 3, loadIncreasePct: 5 },
  regression: { rpeAbove: 8.5, onDiscomfort: 'substituir' },
  cycle: { days: 45, minAdherencePct: 60, requireAssessment: true, maxVolumeChangePct: 25 },
  safety: { blockDiscomfortLevel: 5, maxWeightChangePct: 8 },
  cardio: { enabled: true, sessionsPerWeek: 3, minutes: 25, intensity: 'moderada' },
  autoPublish: true,
  aiRunsPerMonth: 150,
  freeInstructions: '',
};

const BASE_LOAD: Record<MuscleGroup, number | null> = {
  quadriceps: 60, posteriores: 30, gluteos: 40, peito: 30, costas: 40, ombros: 10,
  biceps: 10, triceps: 15, panturrilhas: 40, abdomen: null,
};

/** Gerador pseudoaleatório determinístico (mulberry32). */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Scenario = {
  name: string;
  email: string;
  sex: Student['sex'];
  birthDate: string;
  goal: Student['goal'];
  level: Student['level'];
  freq: number;
  equipment: Student['equipment'];
  limitations: Student['limitations'];
  agent: 'hip' | 'sau';
  autoUpdate: boolean;
  /** Dias desde o início do ciclo atual. null = sem programa (recém-convidado). */
  cycleAge: number | null;
  adherence: number;
  /** Comportamento das séries: atingir o topo da faixa ou ficar no meio. */
  performance: 'topo' | 'meio' | 'pesado';
  recentAssessment: boolean;
  discomfort?: { pattern: string; level: number; region: 'joelho' | 'ombro' | 'lombar' };
  weightStart: number;
  weightNow: number;
  status?: Student['status'];
  previousVersion?: boolean;
};

const SCENARIOS: Scenario[] = [
  { name: 'Ana Exemplo', email: 'ana.exemplo@demo.korvex.app', sex: 'feminino', birthDate: '1994-03-12', goal: 'hipertrofia', level: 'intermediario', freq: 3, equipment: ['barra', 'halteres', 'maquinas', 'polia'], limitations: [], agent: 'hip', autoUpdate: true, cycleAge: 45, adherence: 0.9, performance: 'topo', recentAssessment: true, weightStart: 62.4, weightNow: 63.1, previousVersion: true },
  { name: 'Bruno Fictício', email: 'bruno.ficticio@demo.korvex.app', sex: 'masculino', birthDate: '1989-08-30', goal: 'hipertrofia', level: 'avancado', freq: 3, equipment: ['barra', 'halteres', 'maquinas', 'polia'], limitations: ['ombro'], agent: 'hip', autoUpdate: true, cycleAge: 45, adherence: 0.85, performance: 'topo', recentAssessment: false, weightStart: 84.0, weightNow: 84.0 },
  { name: 'Carla Demonstração', email: 'carla.demo@demo.korvex.app', sex: 'feminino', birthDate: '1979-11-02', goal: 'saude', level: 'iniciante', freq: 3, equipment: ['halteres', 'maquinas', 'polia', 'peso_corporal'], limitations: [], agent: 'sau', autoUpdate: true, cycleAge: 45, adherence: 0.8, performance: 'meio', recentAssessment: true, discomfort: { pattern: 'agachar', level: 6, region: 'joelho' }, weightStart: 71.5, weightNow: 70.2 },
  { name: 'Diego Amostra', email: 'diego.amostra@demo.korvex.app', sex: 'masculino', birthDate: '2000-01-19', goal: 'emagrecimento', level: 'iniciante', freq: 3, equipment: ['halteres', 'maquinas', 'peso_corporal', 'esteira_bike'], limitations: ['lombar'], agent: 'sau', autoUpdate: true, cycleAge: 45, adherence: 0.15, performance: 'meio', recentAssessment: true, weightStart: 96.0, weightNow: 94.8 },
  { name: 'Elisa Modelo', email: 'elisa.modelo@demo.korvex.app', sex: 'feminino', birthDate: '1997-06-25', goal: 'hipertrofia', level: 'intermediario', freq: 3, equipment: ['barra', 'halteres', 'maquinas', 'polia'], limitations: [], agent: 'hip', autoUpdate: false, cycleAge: 45, adherence: 0.95, performance: 'topo', recentAssessment: true, weightStart: 58.0, weightNow: 58.9 },
  { name: 'Gabi Simulada', email: 'gabi.simulada@demo.korvex.app', sex: 'feminino', birthDate: '1991-09-08', goal: 'condicionamento', level: 'intermediario', freq: 3, equipment: ['halteres', 'elasticos', 'peso_corporal', 'esteira_bike'], limitations: ['punho'], agent: 'sau', autoUpdate: true, cycleAge: 16, adherence: 0.9, performance: 'meio', recentAssessment: false, weightStart: 66.0, weightNow: 66.0 },
  { name: 'Felipe Protótipo', email: 'felipe.prototipo@demo.korvex.app', sex: 'masculino', birthDate: '1996-12-01', goal: 'forca', level: 'intermediario', freq: 4, equipment: ['barra', 'halteres', 'maquinas', 'polia'], limitations: ['joelho'], agent: 'hip', autoUpdate: true, cycleAge: null, adherence: 0, performance: 'meio', recentAssessment: false, weightStart: 78.0, weightNow: 78.0, status: 'convidado' },
];

function assessment(state: PlatformState, student: Student, date: string, weight: number, waist: number, rand: () => number): Assessment {
  const fem = student.sex === 'feminino';
  const sites = fem
    ? { tricipital: 18 + rand() * 4, suprailiaca: 14 + rand() * 4, coxa: 24 + rand() * 5 }
    : { peitoral: 10 + rand() * 3, abdominal: 20 + rand() * 5, coxa: 14 + rand() * 4 };
  const sitesMm = Object.fromEntries(Object.entries(sites).map(([k, v]) => [k, Math.round(v * 10) / 10]));
  const protocol = fem ? 'jp3_feminino' : 'jp3_masculino';
  return {
    id: nextId(state, 'ava'),
    studentId: student.id,
    date,
    collectedBy: state.trainer.name,
    source: 'personal',
    weightKg: weight,
    heightCm: fem ? 164 : 178,
    circumferences: {
      cintura: waist,
      quadril: Math.round((waist + (fem ? 26 : 16)) * 10) / 10,
      braco_d: fem ? 28.5 : 35,
      coxa_d: fem ? 55 : 58,
    },
    skinfolds: { protocol, sitesMm },
    bodyFat: calculateBodyFat(protocol, sitesMm, student.sex, ageAt(student.birthDate, date), `${date}T12:00:00.000Z`),
    photos: [],
    notes: '',
  };
}

export function createSeedState(): PlatformState {
  const state: PlatformState = {
    schemaVersion: SCHEMA_VERSION,
    now: DEMO_NOW,
    trainer: {
      id: 'per_demo',
      tenantId: 'ten_demo',
      name: 'Rafael Demonstração',
      businessName: 'Studio Exemplo (fictício)',
      email: 'rafael@demo.korvex.app',
      timezone: 'America/Sao_Paulo',
      cref: '000000-G/SP (fictício)',
    },
    subscription: { planId: 'plano_profissional', status: 'teste', currentPeriodEnd: '2026-11-04', provider: 'mercado_pago' },
    subscriptionPlans: [
      { id: 'plano_essencial', name: 'Essencial', priceCents: 7900, currency: 'BRL', maxActiveStudents: 20, aiRunsPerMonth: 60, highlights: ['Até 20 alunos ativos', '1 agente de IA', 'Ciclos automáticos', 'App do aluno'] },
      { id: 'plano_profissional', name: 'Profissional', priceCents: 14900, currency: 'BRL', maxActiveStudents: 60, aiRunsPerMonth: 200, highlights: ['Até 60 alunos ativos', 'Agentes ilimitados', 'Comparação de avaliações', 'Fotos opcionais com consentimento'] },
      { id: 'plano_studio', name: 'Studio', priceCents: 29900, currency: 'BRL', maxActiveStudents: 150, aiRunsPerMonth: 500, highlights: ['Até 150 alunos ativos', 'Vários profissionais', 'Relatórios da equipe', 'Suporte prioritário'] },
    ],
    exercises: structuredClone(EXERCISES),
    students: [],
    agents: [
      { id: 'agt_hipertrofia', tenantId: 'ten_demo', status: 'ativo', currentVersion: 1, versions: [{ version: 1, config: hypertrophyAgent, createdAt: '2026-06-01T12:00:00.000Z', author: 'Rafael Demonstração', changedFields: [], note: 'Versão inicial a partir do modelo.' }] },
      { id: 'agt_saude', tenantId: 'ten_demo', status: 'ativo', currentVersion: 1, versions: [{ version: 1, config: healthAgent, createdAt: '2026-06-01T12:00:00.000Z', author: 'Rafael Demonstração', changedFields: [], note: 'Versão inicial a partir do modelo.' }] },
    ],
    plans: [],
    logs: [],
    assessments: [],
    cycles: [],
    aiRuns: [],
    notifications: [],
    audit: [],
    settings: { aiFailureMode: 'nenhuma' },
    seq: 0,
  };

  const today = DEMO_NOW.slice(0, 10);
  SCENARIOS.forEach((sc, idx) => {
    const rand = rng(idx + 7);
    const start = sc.cycleAge != null ? addDays(today, -sc.cycleAge) : today;
    const student: Student = {
      id: nextId(state, 'alu'),
      tenantId: 'ten_demo',
      trainerId: 'per_demo',
      name: sc.name,
      email: sc.email,
      sex: sc.sex,
      birthDate: sc.birthDate,
      goal: sc.goal,
      level: sc.level,
      weeklyFrequency: sc.freq,
      equipment: sc.equipment,
      limitations: sc.limitations,
      limitationNotes: sc.limitations.length ? 'Relato de desconforto antigo. Liberado pelo personal com cuidados.' : '',
      preferences: '',
      startDate: addDays(start, sc.previousVersion ? -45 : 0),
      status: sc.status ?? 'ativo',
      agentId: sc.agent === 'hip' ? 'agt_hipertrofia' : 'agt_saude',
      autoUpdate: sc.autoUpdate,
      photoConsent: false,
      createdAt: `${addDays(start, sc.previousVersion ? -45 : -2)}T12:00:00.000Z`,
    };
    state.students.push(student);
    if (sc.cycleAge == null) return;

    // Programa inicial gerado pelo mesmo motor do produto.
    const firstDate = sc.previousVersion ? addDays(start, -45) : start;
    state.now = `${firstDate}T12:00:00.000Z`;
    state.assessments.push(assessment(state, student, addDays(firstDate, -1), sc.previousVersion ? sc.weightStart - 0.6 : sc.weightStart, sc.sex === 'feminino' ? 72 : 88, rand));
    const proposal = buildInitialProposal(buildAgentContext(state, student, 'inicial', null));
    const v1 = draftFromProposal(state, student, proposal, 'seed', 'Programa inicial.');
    publishVersion(state, student.id, v1.id, state.trainer.name);

    let current = v1;
    if (sc.previousVersion) {
      state.now = `${start}T12:00:00.000Z`;
      state.assessments.push(assessment(state, student, addDays(start, -1), sc.weightStart, 71, rand));
      const days = structuredClone(v1.days).map((d) => ({
        ...d,
        id: '',
        exercises: d.exercises.map((e, i) => ({ ...e, id: '', sets: i === 0 ? e.sets + 1 : e.sets })),
      }));
      const v2 = createDraft(state, student, {
        days, weeklyFrequency: v1.weeklyFrequency, cardio: v1.cardio, source: 'manual', author: state.trainer.name,
        changeReason: 'Ajuste manual: +1 série no exercício principal de cada dia.',
        changes: days.map((d) => ({ kind: 'series' as const, dayLabel: d.label, before: `${d.exercises[0].sets - 1} séries`, after: `${d.exercises[0].sets} séries`, reason: 'Boa tolerância ao volume no ciclo anterior.', rule: 'manual', dataUsed: 'Avaliação do personal' })),
      });
      publishVersion(state, student.id, v2.id, state.trainer.name);
      current = v2;
    }
    startCycle(state, student, current.id);
    const cycle = state.cycles[state.cycles.length - 1];
    cycle.state = 'em_acompanhamento';
    cycle.events.push({ at: `${start}T12:00:00.000Z`, type: 'em_acompanhamento', message: 'Acompanhamento iniciado.' });

    // Sessões registradas no ciclo.
    const totalDays = sc.cycleAge;
    const expected = Math.round((totalDays / 7) * sc.freq);
    const sessions = Math.round(expected * sc.adherence);
    let discomfortPlaced = false;
    for (let i = 0; i < sessions; i++) {
      const dayOffset = Math.min(totalDays - 1, Math.floor((i * totalDays) / Math.max(1, sessions)));
      const date = `${addDays(start, dayOffset)}T${String(10 + Math.floor(rand() * 9)).padStart(2, '0')}:15:00.000Z`;
      const day = current.days[i % current.days.length];
      const progress = i / Math.max(1, sessions - 1);
      const log: WorkoutLog = {
        id: nextId(state, 'log'),
        studentId: student.id,
        planVersionId: current.id,
        dayId: day.id,
        date,
        status: 'concluido',
        entries: day.exercises.map((we) => {
          const ex = state.exercises.find((e) => e.id === we.exerciseId)!;
          const base = ex.equipment.length === 1 && ex.equipment[0] === 'peso_corporal' ? null : BASE_LOAD[ex.primary];
          const load = base != null ? Math.round(base * (sc.sex === 'feminino' ? 0.7 : 1) * (1 + progress * 0.1) * 2) / 2 : null;
          const reps =
            sc.performance === 'topo' && progress > 0.6
              ? we.repMax
              : sc.performance === 'pesado'
                ? we.repMin
                : Math.round((we.repMin + we.repMax) / 2);
          const rpe = sc.performance === 'pesado' ? 9.5 : sc.performance === 'topo' ? 7.5 + Math.round(rand() * 2) / 2 : 7;
          let discomfort = null;
          if (sc.discomfort && !discomfortPlaced && progress > 0.7 && ex.pattern === sc.discomfort.pattern) {
            discomfort = { level: sc.discomfort.level, region: sc.discomfort.region, note: 'Dor na parte da frente do joelho ao descer.' };
            discomfortPlaced = true;
          }
          return {
            workoutExerciseId: we.id,
            exerciseId: we.exerciseId,
            skipped: false,
            sets: Array.from({ length: we.sets }, () => ({ loadKg: load, reps, rpe })),
            discomfort,
          };
        }),
        notes: '',
      };
      state.logs.push(log);
    }

    if (sc.recentAssessment) {
      state.now = DEMO_NOW;
      state.assessments.push(assessment(state, student, addDays(today, -2), sc.weightNow, sc.sex === 'feminino' ? 70.5 : 86, rand));
    }
  });

  state.now = DEMO_NOW;
  state.notifications = [];
  state.audit = [];
  // Execuções "seed" não contam como uso de IA.
  state.aiRuns = [];
  return state;
}

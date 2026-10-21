// Tipos de domínio compartilhados entre o painel web, o futuro app Expo e o backend.
// Datas são sempre strings ISO em UTC. Datas "de calendário" usam YYYY-MM-DD.

export type ID = string;
export type ISODate = string;

export type Goal = 'hipertrofia' | 'emagrecimento' | 'condicionamento' | 'forca' | 'saude';
export type Level = 'iniciante' | 'intermediario' | 'avancado';
export type Sex = 'masculino' | 'feminino';

export type Equipment =
  | 'barra'
  | 'halteres'
  | 'maquinas'
  | 'polia'
  | 'elasticos'
  | 'peso_corporal'
  | 'esteira_bike';

export type MuscleGroup =
  | 'peito'
  | 'costas'
  | 'ombros'
  | 'biceps'
  | 'triceps'
  | 'quadriceps'
  | 'posteriores'
  | 'gluteos'
  | 'panturrilhas'
  | 'abdomen';

export type MovementPattern =
  | 'empurrar_horizontal'
  | 'empurrar_vertical'
  | 'puxar_horizontal'
  | 'puxar_vertical'
  | 'agachar'
  | 'dobrar_quadril'
  | 'afundo'
  | 'isolamento'
  | 'core';

/** Regiões usadas para cruzar limitações do aluno com cuidados do exercício. */
export type BodyRegion = 'ombro' | 'joelho' | 'lombar' | 'cotovelo' | 'punho' | 'quadril' | 'tornozelo';

export interface Exercise {
  id: ID;
  name: string;
  altNames: string[];
  primary: MuscleGroup;
  secondary: MuscleGroup[];
  pattern: MovementPattern;
  /** O exercício pode ser feito com QUALQUER um dos equipamentos listados. */
  equipment: Equipment[];
  complexity: 1 | 2 | 3;
  instructions: string;
  commonErrors: string[];
  /** Regiões que exigem cuidado. Bloqueia o exercício para alunos com limitação nessa região. */
  cautionRegions: BodyRegion[];
  substitutes: ID[];
  custom: boolean;
  active: boolean;
  validated: boolean;
}

export type StudentStatus = 'ativo' | 'convidado' | 'inativo' | 'arquivado';

export interface Student {
  id: ID;
  tenantId: ID;
  trainerId: ID;
  name: string;
  email: string;
  sex: Sex;
  birthDate: string; // YYYY-MM-DD
  goal: Goal;
  level: Level;
  weeklyFrequency: number;
  equipment: Equipment[];
  limitations: BodyRegion[];
  limitationNotes: string;
  preferences: string;
  startDate: string;
  status: StudentStatus;
  agentId: ID;
  /** Personal autorizou a publicação automática para este aluno. */
  autoUpdate: boolean;
  /** Consentimento específico para fotos corporais. Nunca obrigatório. */
  photoConsent: boolean;
  createdAt: ISODate;
}

// ---------- Agentes ----------

export type SplitType = 'fullbody' | 'ab' | 'abc' | 'upper_lower' | 'ppl';

export interface AgentConfig {
  name: string;
  description: string;
  goals: Goal[];
  levels: Level[];
  methodology: string;
  split: SplitType;
  effort: { targetRpeMin: number; targetRpeMax: number };
  rest: { minSec: number; maxSec: number };
  volume: { minSetsPerMuscleWeek: number; maxSetsPerMuscleWeek: number };
  progression: {
    /** Sessões registradas mínimas por exercício antes de sugerir progressão. */
    minSessions: number;
    /** Aumento de carga sugerido quando o topo da faixa é atingido com esforço controlado. */
    loadIncreasePct: number;
  };
  regression: {
    /** RPE médio acima deste valor dispara regressão de volume. */
    rpeAbove: number;
    onDiscomfort: 'substituir' | 'reduzir';
  };
  cycle: {
    days: number;
    minAdherencePct: number;
    requireAssessment: boolean;
    /** Variação máxima do total de séries semanais entre versões (%). */
    maxVolumeChangePct: number;
  };
  safety: {
    /** Desconforto relatado com nível >= este valor bloqueia publicação automática. */
    blockDiscomfortLevel: number;
    /** Variação de peso no ciclo acima deste % é tratada como inconsistência. */
    maxWeightChangePct: number;
  };
  cardio: {
    enabled: boolean;
    sessionsPerWeek: number;
    minutes: number;
    intensity: 'leve' | 'moderada' | 'intensa';
  };
  autoPublish: boolean;
  aiRunsPerMonth: number;
  /** Complementa as regras. Nunca desativa validações do sistema. */
  freeInstructions: string;
}

export interface AgentVersion {
  version: number;
  config: AgentConfig;
  createdAt: ISODate;
  author: string;
  changedFields: string[];
  note: string;
}

export interface Agent {
  id: ID;
  tenantId: ID;
  status: 'ativo' | 'rascunho' | 'arquivado';
  currentVersion: number;
  versions: AgentVersion[];
}

// ---------- Treinos ----------

export interface WorkoutExercise {
  id: ID;
  exerciseId: ID;
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  rpeTarget: number;
  /** Carga sugerida só quando há dados suficientes. */
  suggestedLoadKg: number | null;
  notes: string;
}

export interface WorkoutDay {
  id: ID;
  label: string;
  focus: string;
  exercises: WorkoutExercise[];
}

export interface CardioPrescription {
  sessionsPerWeek: number;
  minutes: number;
  intensity: 'leve' | 'moderada' | 'intensa';
  notes: string;
}

export interface PlanChange {
  kind: 'series' | 'repeticoes' | 'descanso' | 'exercicio' | 'carga' | 'cardio' | 'frequencia';
  dayLabel: string;
  before: string;
  after: string;
  reason: string;
  rule: string;
  dataUsed: string;
}

export type PlanVersionStatus = 'rascunho' | 'publicado' | 'substituido' | 'descartado';

export interface PlanVersion {
  id: ID;
  version: number;
  status: PlanVersionStatus;
  createdAt: ISODate;
  publishedAt: ISODate | null;
  author: string;
  source: 'manual' | 'ia' | 'restauracao';
  agentId: ID;
  agentVersion: number;
  goal: Goal;
  weeklyFrequency: number;
  days: WorkoutDay[];
  cardio: CardioPrescription | null;
  notes: string;
  changeReason: string;
  changes: PlanChange[];
  aiRunId: ID | null;
  alerts: string[];
}

export interface WorkoutPlan {
  id: ID;
  studentId: ID;
  name: string;
  versions: PlanVersion[];
}

// ---------- Execução ----------

export interface LoggedSet {
  loadKg: number | null;
  reps: number | null;
  rpe: number | null;
}

export interface LogEntry {
  workoutExerciseId: ID;
  exerciseId: ID;
  skipped: boolean;
  sets: LoggedSet[];
  discomfort: { level: number; region: BodyRegion | 'outra'; note: string } | null;
}

export interface WorkoutLog {
  id: ID;
  studentId: ID;
  planVersionId: ID;
  dayId: ID;
  date: ISODate;
  status: 'em_andamento' | 'concluido' | 'interrompido';
  entries: LogEntry[];
  notes: string;
}

// ---------- Avaliações ----------

export type CircumferenceKey =
  | 'cintura'
  | 'abdomen'
  | 'quadril'
  | 'torax'
  | 'braco_d'
  | 'braco_e'
  | 'coxa_d'
  | 'coxa_e'
  | 'panturrilha_d'
  | 'panturrilha_e';

export type SkinfoldSite = 'peitoral' | 'abdominal' | 'coxa' | 'tricipital' | 'suprailiaca';

export type SkinfoldProtocol = 'jp3_masculino' | 'jp3_feminino';

export interface BodyFatCalculation {
  formula: string;
  formulaVersion: string;
  inputs: Record<string, number>;
  resultPct: number;
  limitations: string;
  calculatedAt: ISODate;
}

export type PhotoCategory = 'frente' | 'perfil' | 'costas';

export interface Assessment {
  id: ID;
  studentId: ID;
  date: string; // YYYY-MM-DD
  collectedBy: string;
  source: 'personal' | 'aluno';
  weightKg: number | null;
  heightCm: number | null;
  circumferences: Partial<Record<CircumferenceKey, number>>;
  skinfolds: { protocol: SkinfoldProtocol; sitesMm: Partial<Record<SkinfoldSite, number>> } | null;
  bodyFat: BodyFatCalculation | null;
  /** Apenas metadados. Os arquivos ficam em armazenamento privado com links temporários. */
  photos: { category: PhotoCategory; storageKey: string; uploadedAt: ISODate }[];
  notes: string;
}

// ---------- Ciclos e IA ----------

export type CycleState =
  | 'agendado'
  | 'em_acompanhamento'
  | 'aguardando_avaliacao'
  | 'dados_incompletos'
  | 'em_processamento'
  | 'aguardando_validacao'
  | 'publicado'
  | 'suspenso'
  | 'falhou'
  | 'cancelado';

export interface ValidationResult {
  rule: string;
  ok: boolean;
  severity: 'bloqueio' | 'aviso';
  message: string;
}

export interface CycleEvent {
  at: ISODate;
  type: string;
  message: string;
}

export interface TrainingCycle {
  id: ID;
  studentId: ID;
  agentId: ID;
  agentVersion: number;
  sourcePlanVersionId: ID;
  startDate: string;
  dueDate: string;
  processedAt: ISODate | null;
  state: CycleState;
  paused: boolean;
  sourceAssessmentId: ID | null;
  targetAssessmentId: ID | null;
  aiRunId: ID | null;
  /** Proposta aguardando decisão do personal (quando não publicada automaticamente). */
  proposalPlanVersionId: ID | null;
  validations: ValidationResult[];
  blockReasons: string[];
  generatedPlanVersionId: ID | null;
  publishedAt: ISODate | null;
  errors: string[];
  attempts: number;
  notifiedUpcoming: boolean;
  events: CycleEvent[];
}

export interface AiRun {
  id: ID;
  studentId: ID;
  cycleId: ID | null;
  agentId: ID;
  agentVersion: number;
  provider: string;
  model: string;
  startedAt: ISODate;
  finishedAt: ISODate;
  status: 'sucesso' | 'resposta_invalida' | 'indisponivel';
  attempts: number;
  tokensIn: number;
  tokensOut: number;
  costCents: number;
  errors: string[];
}

// ---------- Plataforma ----------

export interface SubscriptionPlan {
  id: ID;
  name: string;
  priceCents: number;
  currency: 'BRL';
  maxActiveStudents: number;
  aiRunsPerMonth: number;
  highlights: string[];
}

export interface Subscription {
  planId: ID;
  status: 'teste' | 'ativa' | 'inadimplente' | 'cancelada';
  currentPeriodEnd: string;
  provider: 'mercado_pago';
}

export interface Notification {
  id: ID;
  audience: 'personal' | 'aluno';
  studentId: ID | null;
  kind:
    | 'convite'
    | 'avaliacao_proxima'
    | 'avaliacao_pendente'
    | 'ciclo_iniciado'
    | 'atualizacao_publicada'
    | 'atualizacao_suspensa'
    | 'aguardando_aprovacao'
    | 'falha_processamento'
    | 'nova_versao'
    | 'avaliacao_recebida'
    | 'solicitacao_exclusao';
  title: string;
  body: string;
  createdAt: ISODate;
  read: boolean;
}

export interface AuditLog {
  id: ID;
  at: ISODate;
  actor: string;
  action: string;
  entity: string;
  detail: string;
}

export interface Trainer {
  id: ID;
  tenantId: ID;
  name: string;
  businessName: string;
  email: string;
  timezone: string;
  cref: string;
}

export type AiFailureMode = 'nenhuma' | 'resposta_invalida' | 'indisponivel';

export interface PlatformState {
  schemaVersion: number;
  /** Relógio do servidor. Na demonstração pode ser avançado manualmente. */
  now: ISODate;
  trainer: Trainer;
  subscription: Subscription;
  subscriptionPlans: SubscriptionPlan[];
  exercises: Exercise[];
  students: Student[];
  agents: Agent[];
  plans: WorkoutPlan[];
  logs: WorkoutLog[];
  assessments: Assessment[];
  cycles: TrainingCycle[];
  aiRuns: AiRun[];
  notifications: Notification[];
  audit: AuditLog[];
  settings: { aiFailureMode: AiFailureMode };
  seq: number;
}

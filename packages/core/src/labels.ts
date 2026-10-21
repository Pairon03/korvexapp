// Textos externalizados em pt-BR. Estrutura pronta para receber en/es.
import type {
  BodyRegion,
  CircumferenceKey,
  CycleState,
  Equipment,
  Goal,
  Level,
  MovementPattern,
  MuscleGroup,
  SkinfoldSite,
  SplitType,
} from './types';

export const goalLabel: Record<Goal, string> = {
  hipertrofia: 'Hipertrofia',
  emagrecimento: 'Emagrecimento',
  condicionamento: 'Condicionamento',
  forca: 'Força',
  saude: 'Saúde e qualidade de vida',
};

export const levelLabel: Record<Level, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
};

export const equipmentLabel: Record<Equipment, string> = {
  barra: 'Barra e anilhas',
  halteres: 'Halteres',
  maquinas: 'Máquinas',
  polia: 'Polia / cross',
  elasticos: 'Elásticos',
  peso_corporal: 'Peso corporal',
  esteira_bike: 'Esteira / bike',
};

export const muscleLabel: Record<MuscleGroup, string> = {
  peito: 'Peito',
  costas: 'Costas',
  ombros: 'Ombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  quadriceps: 'Quadríceps',
  posteriores: 'Posteriores de coxa',
  gluteos: 'Glúteos',
  panturrilhas: 'Panturrilhas',
  abdomen: 'Abdômen',
};

export const patternLabel: Record<MovementPattern, string> = {
  empurrar_horizontal: 'Empurrar horizontal',
  empurrar_vertical: 'Empurrar vertical',
  puxar_horizontal: 'Puxar horizontal',
  puxar_vertical: 'Puxar vertical',
  agachar: 'Agachar',
  dobrar_quadril: 'Dobrar o quadril',
  afundo: 'Afundo',
  isolamento: 'Isolamento',
  core: 'Core',
};

export const regionLabel: Record<BodyRegion, string> = {
  ombro: 'Ombro',
  joelho: 'Joelho',
  lombar: 'Lombar',
  cotovelo: 'Cotovelo',
  punho: 'Punho',
  quadril: 'Quadril',
  tornozelo: 'Tornozelo',
};

export const splitLabel: Record<SplitType, string> = {
  fullbody: 'Corpo inteiro',
  ab: 'A/B',
  abc: 'A/B/C',
  upper_lower: 'Superior / inferior',
  ppl: 'Empurrar / puxar / pernas',
};

export const cycleStateLabel: Record<CycleState, string> = {
  agendado: 'Agendado',
  em_acompanhamento: 'Em acompanhamento',
  aguardando_avaliacao: 'Aguardando avaliação',
  dados_incompletos: 'Dados incompletos',
  em_processamento: 'Em processamento',
  aguardando_validacao: 'Aguardando validação',
  publicado: 'Publicado',
  suspenso: 'Suspenso',
  falhou: 'Falhou',
  cancelado: 'Cancelado',
};

export const circumferenceLabel: Record<CircumferenceKey, string> = {
  cintura: 'Cintura',
  abdomen: 'Abdômen',
  quadril: 'Quadril',
  torax: 'Tórax',
  braco_d: 'Braço direito',
  braco_e: 'Braço esquerdo',
  coxa_d: 'Coxa direita',
  coxa_e: 'Coxa esquerda',
  panturrilha_d: 'Panturrilha direita',
  panturrilha_e: 'Panturrilha esquerda',
};

export const skinfoldLabel: Record<SkinfoldSite, string> = {
  peitoral: 'Peitoral',
  abdominal: 'Abdominal',
  coxa: 'Coxa',
  tricipital: 'Tricipital',
  suprailiaca: 'Suprailíaca',
};

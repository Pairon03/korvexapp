import { z } from 'zod';

// ---------- Contrato de resposta da IA ----------
// Campos inesperados são rejeitados (.strict). Texto livre nunca substitui campos críticos.

export const ProposalExerciseSchema = z
  .object({
    exerciseId: z.string().min(1),
    sets: z.number().int(),
    repMin: z.number().int(),
    repMax: z.number().int(),
    restSec: z.number().int(),
    rpeTarget: z.number(),
    suggestedLoadKg: z.number().positive().nullable(),
    notes: z.string().max(280),
  })
  .strict();

export const ProposalChangeSchema = z
  .object({
    kind: z.enum(['series', 'repeticoes', 'descanso', 'exercicio', 'carga', 'cardio', 'frequencia']),
    dayLabel: z.string(),
    before: z.string(),
    after: z.string(),
    reason: z.string().min(3),
    rule: z.string().min(1),
    dataUsed: z.string(),
  })
  .strict();

export const ProposalSchema = z
  .object({
    meta: z
      .object({
        agentId: z.string(),
        agentVersion: z.number().int().positive(),
        schemaVersion: z.literal(1),
      })
      .strict(),
    goal: z.enum(['hipertrofia', 'emagrecimento', 'condicionamento', 'forca', 'saude']),
    weeklyFrequency: z.number().int().min(1).max(7),
    days: z
      .array(
        z
          .object({
            label: z.string().min(1),
            focus: z.string(),
            exercises: z.array(ProposalExerciseSchema).min(1),
          })
          .strict(),
      )
      .min(1)
      .max(7),
    cardio: z
      .object({
        sessionsPerWeek: z.number().int().min(0).max(7),
        minutes: z.number().int().min(0).max(120),
        intensity: z.enum(['leve', 'moderada', 'intensa']),
        notes: z.string(),
      })
      .strict()
      .nullable(),
    changes: z.array(ProposalChangeSchema),
    alerts: z.array(z.string()),
    missingData: z.array(z.string()),
    requiresReview: z.boolean(),
    summary: z.string(),
  })
  .strict();

export type Proposal = z.infer<typeof ProposalSchema>;

// ---------- Formulários ----------

export const StudentFormSchema = z.object({
  name: z.string().trim().min(3, 'Informe o nome completo.'),
  email: z.string().trim().email('Informe um e-mail válido.'),
  sex: z.enum(['masculino', 'feminino']),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data de nascimento.'),
  goal: z.enum(['hipertrofia', 'emagrecimento', 'condicionamento', 'forca', 'saude']),
  level: z.enum(['iniciante', 'intermediario', 'avancado']),
  weeklyFrequency: z.coerce.number().int().min(1, 'Mínimo de 1 dia.').max(6, 'Máximo de 6 dias.'),
  equipment: z
    .array(z.enum(['barra', 'halteres', 'maquinas', 'polia', 'elasticos', 'peso_corporal', 'esteira_bike']))
    .min(1, 'Selecione ao menos um equipamento.'),
  limitations: z.array(z.enum(['ombro', 'joelho', 'lombar', 'cotovelo', 'punho', 'quadril', 'tornozelo'])),
  limitationNotes: z.string().max(500),
  preferences: z.string().max(500),
  agentId: z.string().min(1, 'Escolha um agente.'),
  autoUpdate: z.boolean(),
});

export type StudentForm = z.infer<typeof StudentFormSchema>;

/** Faixas plausíveis. Valores fora são rejeitados (não convertidos). */
export const MEASUREMENT_RANGES = {
  weightKg: [25, 300],
  heightCm: [100, 230],
  circumferenceCm: [10, 200],
  skinfoldMm: [2, 80],
} as const;

const optionalRange = (min: number, max: number, label: string) =>
  z
    .number()
    .min(min, `${label}: valor mínimo ${min}.`)
    .max(max, `${label}: valor máximo ${max}.`)
    .nullable();

export const AssessmentFormSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weightKg: optionalRange(...MEASUREMENT_RANGES.weightKg, 'Peso'),
  heightCm: optionalRange(...MEASUREMENT_RANGES.heightCm, 'Altura'),
  circumferences: z.record(z.string(), z.number().min(MEASUREMENT_RANGES.circumferenceCm[0]).max(MEASUREMENT_RANGES.circumferenceCm[1])),
  skinfolds: z
    .object({
      protocol: z.enum(['jp3_masculino', 'jp3_feminino']),
      sitesMm: z.record(z.string(), z.number().min(MEASUREMENT_RANGES.skinfoldMm[0]).max(MEASUREMENT_RANGES.skinfoldMm[1])),
    })
    .nullable(),
  notes: z.string().max(1000),
});

export type AssessmentForm = z.infer<typeof AssessmentFormSchema>;

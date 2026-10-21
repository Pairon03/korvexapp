import { describe, expect, it } from 'vitest';
import {
  ProposalSchema,
  calculateBodyFat,
  compareAssessments,
  createSeedState,
  getPublished,
  hasBlockingFailure,
  validatePlan,
  validationContext,
  createStudent,
  LimitError,
  type Assessment,
} from '../src';

describe('validações determinísticas', () => {
  it('bloqueia exercício inexistente, incompatível com limitação e parâmetros fora da faixa', () => {
    const s = createSeedState();
    const bruno = s.students.find((x) => x.name.startsWith('Bruno'))!; // limitação: ombro
    const plan = structuredClone(getPublished(s, bruno.id)!);
    plan.days[0].exercises[0].exerciseId = 'ex_nao_existe';
    plan.days[0].exercises[1].exerciseId = 'ex_desenvolvimento_halteres';
    plan.days[1].exercises[0].sets = 12;
    const res = validatePlan(plan, validationContext(s, bruno));
    const failed = res.filter((r) => !r.ok).map((r) => r.rule);
    expect(failed).toEqual(expect.arrayContaining(['biblioteca', 'limitacoes', 'parametros']));
    expect(hasBlockingFailure(res)).toBe(true);
  });

  it('aceita o programa gerado pelo agente', () => {
    const s = createSeedState();
    const ana = s.students.find((x) => x.name.startsWith('Ana'))!;
    const res = validatePlan(getPublished(s, ana.id)!, { ...validationContext(s, ana), previous: null });
    expect(hasBlockingFailure(res)).toBe(false);
  });

  it('rejeita campos inesperados no contrato da IA', () => {
    const r = ProposalSchema.safeParse({ meta: { agentId: 'a', agentVersion: 1, schemaVersion: 1 }, extra: true });
    expect(r.success).toBe(false);
  });

  it('respeita o limite de alunos do plano', () => {
    const s = createSeedState();
    s.subscriptionPlans.find((p) => p.id === s.subscription.planId)!.maxActiveStudents = 7;
    expect(() =>
      createStudent(s, { name: 'Novo Aluno', email: 'novo@demo.korvex.app', sex: 'masculino', birthDate: '1990-01-01', goal: 'saude', level: 'iniciante', weeklyFrequency: 3, equipment: ['halteres'], limitations: [], limitationNotes: '', preferences: '', agentId: 'agt_saude', autoUpdate: true }, 'Rafael'),
    ).toThrow(LimitError);
  });
});

describe('avaliações', () => {
  const base: Assessment = { id: 'a', studentId: 's', date: '2026-01-01', collectedBy: 'x', source: 'personal', weightKg: 80, heightCm: 178, circumferences: { cintura: 90 }, skinfolds: null, bodyFat: null, photos: [], notes: '' };

  it('não trata valores ausentes como zero', () => {
    const cmp = compareAssessments(base, { ...base, id: 'b', date: '2026-02-15', weightKg: null, circumferences: { cintura: 88 } });
    const w = cmp.rows.find((r) => r.key === 'weightKg')!;
    expect(w.diff).toBeNull();
    expect(cmp.rows.find((r) => r.key === 'cintura')!.diff).toBe(-2);
  });

  it('não compara dobras de protocolos diferentes', () => {
    const cmp = compareAssessments(
      { ...base, skinfolds: { protocol: 'jp3_masculino', sitesMm: { peitoral: 10, abdominal: 20, coxa: 15 } } },
      { ...base, id: 'b', skinfolds: { protocol: 'jp3_feminino', sitesMm: { tricipital: 10, suprailiaca: 12, coxa: 15 } } },
    );
    expect(cmp.alerts.join(' ')).toContain('Protocolos de dobras diferentes');
  });

  it('calcula gordura estimada pelo protocolo JP3 e registra fórmula e limitações', () => {
    const r = calculateBodyFat('jp3_masculino', { peitoral: 10, abdominal: 20, coxa: 15 }, 'masculino', 30, '2026-01-01T00:00:00Z')!;
    expect(r.resultPct).toBeCloseTo(13.6, 1);
    expect(r.formulaVersion).toBe('jp3-siri@1');
    expect(calculateBodyFat('jp3_masculino', { peitoral: 10, abdominal: 20 }, 'masculino', 30, 'x')).toBeNull();
    expect(calculateBodyFat('jp3_masculino', { peitoral: 10, abdominal: 20, coxa: 15 }, 'feminino', 30, 'x')).toBeNull();
  });
});

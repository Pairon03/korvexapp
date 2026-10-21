import { describe, expect, it } from 'vitest';
import {
  addAssessment,
  approveProposal,
  createSeedState,
  getPublished,
  runScheduler,
  retryCycle,
  type PlatformState,
} from '../src';

const byName = (s: PlatformState, name: string) => s.students.find((x) => x.name.startsWith(name))!;
const cycleOf = (s: PlatformState, studentId: string) =>
  s.cycles.filter((c) => c.studentId === studentId).sort((a, b) => a.id.localeCompare(b.id));

describe('motor de ciclos', () => {
  it('processa cada cenário de demonstração para o estado esperado', async () => {
    const s = createSeedState();
    await runScheduler(s);
    const state = (n: string) => cycleOf(s, byName(s, n).id)[0].state;
    expect(state('Ana')).toBe('publicado');
    expect(state('Bruno')).toBe('aguardando_avaliacao');
    expect(state('Carla')).toBe('suspenso');
    expect(state('Diego')).toBe('dados_incompletos');
    expect(state('Elisa')).toBe('aguardando_validacao');
    expect(state('Gabi')).toBe('em_acompanhamento');
  });

  it('publica uma nova versão sem apagar a anterior e encadeia o próximo ciclo', async () => {
    const s = createSeedState();
    const ana = byName(s, 'Ana');
    const before = getPublished(s, ana.id)!;
    await runScheduler(s);
    const after = getPublished(s, ana.id)!;
    expect(after.id).not.toBe(before.id);
    expect(after.version).toBe(before.version + 1);
    const plan = s.plans.find((p) => p.studentId === ana.id)!;
    expect(plan.versions.find((v) => v.id === before.id)?.status).toBe('substituido');
    const cycles = cycleOf(s, ana.id);
    expect(cycles).toHaveLength(2);
    expect(cycles[1].state).toBe('agendado');
    expect(cycles[1].dueDate).toBe('2026-12-05');
    expect(after.changes.length).toBeGreaterThan(0);
  });

  it('é idempotente: rodar o agendador de novo não cria versões duplicadas', async () => {
    const s = createSeedState();
    await runScheduler(s);
    const versions = s.plans.reduce((a, p) => a + p.versions.length, 0);
    await runScheduler(s);
    await runScheduler(s);
    expect(s.plans.reduce((a, p) => a + p.versions.length, 0)).toBe(versions);
  });

  it('prossegue sem fotos quando a avaliação chega', async () => {
    const s = createSeedState();
    await runScheduler(s);
    const bruno = byName(s, 'Bruno');
    addAssessment(s, bruno.id, { date: '2026-10-21', weightKg: 84.5, heightCm: 178, circumferences: { cintura: 86 }, skinfolds: null, notes: '' }, { collectedBy: 'Bruno', source: 'aluno' });
    await runScheduler(s);
    expect(cycleOf(s, bruno.id)[0].state).toBe('publicado');
    expect(s.assessments.filter((a) => a.studentId === bruno.id).every((a) => a.photos.length === 0)).toBe(true);
  });

  it('mantém o treino vigente quando a IA está indisponível e encaminha após 3 tentativas', async () => {
    const s = createSeedState();
    s.settings.aiFailureMode = 'indisponivel';
    const ana = byName(s, 'Ana');
    const current = getPublished(s, ana.id)!;
    await runScheduler(s);
    await runScheduler(s);
    await runScheduler(s);
    const c = cycleOf(s, ana.id)[0];
    expect(c.state).toBe('falhou');
    expect(c.attempts).toBe(3);
    expect(c.blockReasons.join(' ')).toContain('monitoramento');
    expect(getPublished(s, ana.id)!.id).toBe(current.id);
    await runScheduler(s);
    expect(cycleOf(s, ana.id)[0].attempts).toBe(3);
  });

  it('rejeita resposta fora do contrato e não publica', async () => {
    const s = createSeedState();
    s.settings.aiFailureMode = 'resposta_invalida';
    const ana = byName(s, 'Ana');
    const current = getPublished(s, ana.id)!;
    await runScheduler(s);
    const c = cycleOf(s, ana.id)[0];
    expect(c.state).toBe('falhou');
    expect(s.aiRuns[0].status).toBe('resposta_invalida');
    expect(s.aiRuns[0].attempts).toBe(2);
    expect(getPublished(s, ana.id)!.id).toBe(current.id);
  });

  it('exige aprovação manual quando o aluno não autorizou atualização automática', async () => {
    const s = createSeedState();
    await runScheduler(s);
    const elisa = byName(s, 'Elisa');
    const c = cycleOf(s, elisa.id)[0];
    expect(c.proposalPlanVersionId).toBeTruthy();
    approveProposal(s, c.id, 'Rafael');
    expect(getPublished(s, elisa.id)!.id).toBe(c.proposalPlanVersionId);
  });

  it('após revisão do personal, a proposta de um ciclo suspenso nunca é publicada automaticamente', async () => {
    const s = createSeedState();
    await runScheduler(s);
    const carla = byName(s, 'Carla');
    const c = cycleOf(s, carla.id)[0];
    await retryCycle(s, c.id, 'Rafael', {}, true);
    expect(c.state).toBe('aguardando_validacao');
  });
});

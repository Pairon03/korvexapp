import { ProposalSchema, type Proposal } from '../schemas';
import type { AgentContext } from './context';

/**
 * Camada de abstração do provedor de IA. Nenhuma outra parte do código chama
 * a API de um fornecedor diretamente.
 */
export interface AiProvider {
  readonly name: string;
  readonly model: string;
  generate(ctx: AgentContext, opts: { correction?: string }): Promise<{ raw: unknown; tokensIn: number; tokensOut: number }>;
}

export class AiUnavailableError extends Error {
  constructor(message = 'Provedor de IA indisponível.') {
    super(message);
    this.name = 'AiUnavailableError';
  }
}

export interface ProposalOutcome {
  proposal: Proposal | null;
  status: 'sucesso' | 'resposta_invalida' | 'indisponivel';
  attempts: number;
  tokensIn: number;
  tokensOut: number;
  errors: string[];
}

export interface RunOptions {
  maxAttempts?: number;
  /** Espera entre tentativas. Injetável para testes e para a demonstração. */
  sleep?: (ms: number) => Promise<void>;
  baseDelayMs?: number;
  random?: () => number;
}

/**
 * Executa o provedor com retry exponencial + jitter para indisponibilidade e
 * uma única tentativa de correção controlada para respostas inválidas.
 */
export async function requestProposal(provider: AiProvider, ctx: AgentContext, opts: RunOptions = {}): Promise<ProposalOutcome> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const base = opts.baseDelayMs ?? 500;
  const random = opts.random ?? Math.random;
  const errors: string[] = [];
  let tokensIn = 0;
  let tokensOut = 0;
  let attempts = 0;
  let correction: string | undefined;
  let correctionsLeft = 1;

  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const res = await provider.generate(ctx, { correction });
      tokensIn += res.tokensIn;
      tokensOut += res.tokensOut;
      const parsed = ProposalSchema.safeParse(res.raw);
      if (parsed.success) {
        if (parsed.data.meta.agentId !== ctx.agentId || parsed.data.meta.agentVersion !== ctx.agentVersion) {
          errors.push(`Tentativa ${attempts}: versão do agente divergente na resposta.`);
        } else {
          return { proposal: parsed.data, status: 'sucesso', attempts, tokensIn, tokensOut, errors };
        }
      } else {
        // Registra só o caminho e o tipo do erro, sem ecoar dados do aluno.
        const issues = parsed.error.issues.slice(0, 4).map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`);
        errors.push(`Tentativa ${attempts}: resposta fora do contrato (${issues.join('; ')}).`);
      }
      if (correctionsLeft === 0) {
        return { proposal: null, status: 'resposta_invalida', attempts, tokensIn, tokensOut, errors };
      }
      correctionsLeft -= 1;
      correction = 'A resposta anterior não seguiu o esquema. Responda apenas com JSON válido no formato exigido.';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Tentativa ${attempts}: ${msg}`);
      if (!(err instanceof AiUnavailableError)) {
        return { proposal: null, status: 'indisponivel', attempts, tokensIn, tokensOut, errors };
      }
      if (attempts < maxAttempts) {
        const delay = base * 2 ** (attempts - 1) * (0.5 + random());
        await sleep(delay);
      }
    }
  }
  const lastWasInvalid = errors[errors.length - 1]?.includes('fora do contrato');
  return { proposal: null, status: lastWasInvalid ? 'resposta_invalida' : 'indisponivel', attempts, tokensIn, tokensOut, errors };
}

/** Preço de referência por milhão de tokens, em centavos. Configurável por ambiente. */
export const REFERENCE_PRICING = { inCentsPerMTok: 1500, outCentsPerMTok: 7500 };

export function estimateCostCents(tokensIn: number, tokensOut: number, pricing = REFERENCE_PRICING): number {
  return Math.round(((tokensIn * pricing.inCentsPerMTok + tokensOut * pricing.outCentsPerMTok) / 1_000_000) * 100) / 100;
}

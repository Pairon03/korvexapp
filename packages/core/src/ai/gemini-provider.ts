import type { AgentContext } from './context';
import { AiUnavailableError, type AiProvider } from './provider';
import { callGemini, type GeminiConfig } from './gemini.js';

/** Adaptador do Gemini para o motor de ciclos. Uso exclusivo no servidor. */
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  readonly model: string;
  constructor(private cfg: GeminiConfig) {
    this.model = cfg.model;
  }

  async generate(ctx: AgentContext, opts: { correction?: string }) {
    try {
      return await callGemini(this.cfg, ctx, opts.correction);
    } catch (err) {
      if ((err as { unavailable?: boolean }).unavailable) throw new AiUnavailableError((err as Error).message);
      throw err;
    }
  }
}

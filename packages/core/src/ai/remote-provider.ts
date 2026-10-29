import type { AgentContext } from './context';
import { AiUnavailableError, type AiProvider } from './provider';

/**
 * Provedor usado no navegador: envia o contexto mínimo para a função do servidor
 * (/api/ia), que guarda a chave e chama o modelo. O navegador nunca vê a chave.
 */
export class RemoteProvider implements AiProvider {
  readonly name: string;
  readonly model: string;
  constructor(
    private endpoint = '/api/ia',
    opts: { name?: string; model?: string; fetchImpl?: typeof fetch } = {},
  ) {
    this.name = opts.name ?? 'gemini';
    this.model = opts.model ?? 'servidor';
    this.fetchImpl = opts.fetchImpl;
  }
  private fetchImpl?: typeof fetch;

  async generate(ctx: AgentContext, opts: { correction?: string }) {
    let res: Response;
    try {
      res = await (this.fetchImpl ?? fetch)(this.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ctx, correction: opts.correction }),
      });
    } catch {
      throw new AiUnavailableError('Sem conexão com o servidor da IA.');
    }
    const body = (await res.json().catch(() => ({}))) as { raw?: unknown; tokensIn?: number; tokensOut?: number; error?: string; unavailable?: boolean };
    if (!res.ok) {
      const msg = body.error ?? `Servidor da IA respondeu ${res.status}.`;
      if (body.unavailable || res.status === 429 || res.status >= 500) throw new AiUnavailableError(msg);
      throw new Error(msg);
    }
    return { raw: body.raw ?? { invalid: true }, tokensIn: body.tokensIn ?? 0, tokensOut: body.tokensOut ?? 0 };
  }
}

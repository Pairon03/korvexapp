import type { AgentContext } from './context';
import { AiUnavailableError, type AiProvider } from './provider';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt.js';

export { SYSTEM_PROMPT, buildUserPrompt };

/**
 * Adaptador para um modelo de linguagem via HTTP (API de mensagens da Anthropic).
 * USO EXCLUSIVO NO SERVIDOR: a chave nunca pode chegar ao navegador.
 * Não é usado no protótipo; depende de AI_API_KEY e AI_MODEL configurados.
 */
export interface HttpProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxOutputTokens?: number;
  fetchImpl?: typeof fetch;
}

export class HttpModelProvider implements AiProvider {
  readonly name = 'anthropic';
  readonly model: string;
  constructor(private cfg: HttpProviderConfig) {
    this.model = cfg.model;
    if (typeof window !== 'undefined') {
      throw new Error('HttpModelProvider só pode ser instanciado no servidor.');
    }
  }

  async generate(ctx: AgentContext, opts: { correction?: string }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs ?? 60_000);
    const doFetch = this.cfg.fetchImpl ?? fetch;
    try {
      const res = await doFetch(`${this.cfg.baseUrl ?? 'https://api.anthropic.com'}/v1/messages`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.cfg.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: this.cfg.maxOutputTokens ?? 4000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: buildUserPrompt(ctx, opts.correction) }],
        }),
      });
      if (res.status === 429 || res.status >= 500) throw new AiUnavailableError(`Provedor respondeu ${res.status}.`);
      if (!res.ok) throw new Error(`Requisição rejeitada pelo provedor (${res.status}).`);
      const body = (await res.json()) as { content: { type: string; text?: string }[]; usage?: { input_tokens: number; output_tokens: number } };
      const text = body.content.find((c) => c.type === 'text')?.text ?? '';
      let raw: unknown;
      try {
        raw = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
      } catch {
        raw = { invalid: true };
      }
      return { raw, tokensIn: body.usage?.input_tokens ?? 0, tokensOut: body.usage?.output_tokens ?? 0 };
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw new AiUnavailableError('Tempo limite excedido.');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

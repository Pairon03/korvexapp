import type { AgentContext } from './context';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt.js';

/**
 * Chamada ao Gemini (Google AI Studio) pela API REST generateContent.
 * USO EXCLUSIVO NO SERVIDOR: a chave nunca pode chegar ao navegador.
 * Sem dependências além de fetch, para rodar tanto nos testes quanto na função da Vercel (api/ia.ts).
 */
export interface GeminiConfig {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  maxOutputTokens?: number;
  fetchImpl?: typeof fetch;
}

export const GEMINI_DEFAULT_MODEL = 'gemini-3.8-flash';

/** Erro que o motor trata como indisponibilidade (nova tentativa, treino vigente mantido). */
export class GeminiUnavailableError extends Error {
  readonly unavailable = true;
  constructor(message: string) {
    super(message);
    this.name = 'GeminiUnavailableError';
  }
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
}

export async function callGemini(cfg: GeminiConfig, ctx: AgentContext, correction?: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 60_000);
  const doFetch = cfg.fetchImpl ?? fetch;
  try {
    const res = await doFetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': cfg.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: buildUserPrompt(ctx, correction) }] }],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: cfg.maxOutputTokens ?? 8000 },
      }),
    });
    // 429 no plano gratuito = cota do minuto ou do dia esgotada.
    if (res.status === 429 || res.status >= 500) throw new GeminiUnavailableError(`Gemini respondeu ${res.status}.`);
    if (!res.ok) throw new Error(`Requisição rejeitada pelo Gemini (${res.status}).`);
    const body = (await res.json()) as GeminiResponse;
    const text = (body.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
    let raw: unknown;
    try {
      raw = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    } catch {
      raw = { invalid: true };
    }
    const usage = body.usageMetadata ?? {};
    return { raw, tokensIn: usage.promptTokenCount ?? 0, tokensOut: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0) };
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new GeminiUnavailableError('Tempo limite excedido ao chamar o Gemini.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

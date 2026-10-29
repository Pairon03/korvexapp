import { describe, expect, it } from 'vitest';
import { buildAgentContext, buildInitialProposal, createSeedState, GeminiProvider, requestProposal } from '../src';

function ctxFixture() {
  const s = createSeedState();
  const student = s.students[0];
  return buildAgentContext(s, student, 'inicial', { start: s.now.slice(0, 10), end: s.now.slice(0, 10) });
}

function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
}

describe('GeminiProvider', () => {
  it('aceita uma proposta válida e soma tokens de pensamento na saída', async () => {
    const ctx = ctxFixture();
    const proposal = buildInitialProposal(ctx);
    const fetchImpl = fakeFetch(200, {
      candidates: [{ content: { parts: [{ text: JSON.stringify(proposal) }] } }],
      usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 300, thoughtsTokenCount: 200 },
    });
    const out = await requestProposal(new GeminiProvider({ apiKey: 'k', model: 'gemini-3.8-flash', fetchImpl }), ctx, { sleep: async () => {} });
    expect(out.status).toBe('sucesso');
    expect(out.tokensIn).toBe(1000);
    expect(out.tokensOut).toBe(500);
  });

  it('trata cota esgotada (429) como indisponível', async () => {
    const out = await requestProposal(new GeminiProvider({ apiKey: 'k', model: 'm', fetchImpl: fakeFetch(429, {}) }), ctxFixture(), { sleep: async () => {} });
    expect(out.status).toBe('indisponivel');
  });
});

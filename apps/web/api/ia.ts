// Função da Vercel (Node): recebe o contexto mínimo do agente e chama o Gemini com a chave guardada no servidor.
// Variáveis: GEMINI_API_KEY (obrigatória) e GEMINI_MODEL (opcional, padrão gemini-3.8-flash).
// Fase de teste: usar apenas alunos fictícios, porque o plano gratuito do Gemini pode usar o conteúdo para treinar modelos.
import { callGemini, GEMINI_DEFAULT_MODEL } from '../../../packages/core/src/ai/gemini.js';
import type { AgentContext } from '../../../packages/core/src/ai/context';

const MAX_BODY = 200_000;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

// Diagnóstico sem gerar treino: confirma se a chave existe e se o Google aceita a chave e o modelo (não gasta cota de geração).
export async function GET(): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
  if (!apiKey) return json(200, { configurada: false, modelo: model });
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`, {
      headers: { 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    return json(200, { configurada: true, modelo: model, googleAceitou: res.ok, statusGoogle: res.status });
  } catch {
    return json(200, { configurada: true, modelo: model, googleAceitou: false, statusGoogle: null });
  }
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json(503, { error: 'A chave do Gemini ainda não foi configurada na Vercel (GEMINI_API_KEY).', unavailable: true });

  const text = await request.text();
  if (text.length > MAX_BODY) return json(413, { error: 'Contexto grande demais.' });
  let payload: { ctx?: AgentContext; correction?: string };
  try {
    payload = JSON.parse(text);
  } catch {
    return json(400, { error: 'Pedido inválido.' });
  }
  const ctx = payload.ctx;
  if (!ctx || typeof ctx.agentId !== 'string' || !Array.isArray(ctx.library)) return json(400, { error: 'Contexto do agente ausente.' });

  try {
    const result = await callGemini({ apiKey, model: process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL }, ctx, typeof payload.correction === 'string' ? payload.correction.slice(0, 500) : undefined);
    return json(200, result);
  } catch (err) {
    const unavailable = (err as { unavailable?: boolean }).unavailable === true;
    return json(unavailable ? 503 : 502, { error: (err as Error).message, unavailable });
  }
}

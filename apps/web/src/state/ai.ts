import { RemoteProvider, type AiProvider } from '@korvex/core';
import { authedFetch } from './cloud';

// Escolha da IA na demonstração: o gerador local (padrão) ou o Gemini real pela função /api/ia.
// O Gemini só existe no site publicado na Vercel; o HTML único do protótipo não tem servidor.
export type AiSource = 'local' | 'gemini';
const KEY = 'fitcore-ia';

export const geminiAvailable = import.meta.env.MODE !== 'artifact';

export function getAiSource(): AiSource {
  try {
    return geminiAvailable && localStorage.getItem(KEY) === 'gemini' ? 'gemini' : 'local';
  } catch {
    return 'local';
  }
}

export function setAiSource(source: AiSource) {
  try {
    localStorage.setItem(KEY, source);
  } catch {
    /* preferência só nesta sessão */
  }
}

/** Provedor para passar ao motor; undefined usa o gerador local. */
export function aiProvider(): AiProvider | undefined {
  return getAiSource() === 'gemini' ? new RemoteProvider('/api/ia', { name: 'gemini', model: 'gemini (servidor)', fetchImpl: authedFetch }) : undefined;
}

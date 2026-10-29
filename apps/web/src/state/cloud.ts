import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import { SCHEMA_VERSION, type PlatformState } from '@korvex/core';

// Etapa 1 do backend: login do personal no Supabase e o estado do app salvo por conta (tabela fitcore_workspaces).
// Sem VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY (ou no HTML único do protótipo) o app segue só no navegador.
// A chave "anon" é pública por definição; quem protege os dados são as regras de acesso (RLS) do supabase/fitcore.sql.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey && import.meta.env.MODE !== 'artifact'
    ? createClient(url, anonKey, {
        // PKCE devolve ?code= antes do "#", então não briga com as rotas do HashRouter.
        auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true },
      })
    : null;

export const cloudEnabled = supabase != null;

const TABLE = 'fitcore_workspaces';

export interface Workspace {
  state: PlatformState;
  version: number;
}

export async function loadWorkspace(): Promise<Workspace | null> {
  const { data, error } = await supabase!.from(TABLE).select('state, schema_version, version').maybeSingle();
  if (error) throw new Error(`Não foi possível carregar seus dados (${error.message}).`);
  if (!data || data.schema_version !== SCHEMA_VERSION) return null;
  return { state: data.state as PlatformState, version: Number(data.version) };
}

/** Cria ou substitui o espaço da conta (primeiro acesso, dados de versão antiga ou "reiniciar"). */
export async function replaceWorkspace(state: PlatformState): Promise<number> {
  const { data, error } = await supabase!
    .from(TABLE)
    .upsert({ state, schema_version: SCHEMA_VERSION }, { onConflict: 'owner' })
    .select('version')
    .single();
  if (error) throw new Error(`Não foi possível salvar seus dados (${error.message}).`);
  return Number(data.version);
}

/** Grava só se ninguém gravou depois da versão lida. Devolve a nova versão ou 'conflito'. */
export async function saveWorkspace(state: PlatformState, version: number): Promise<number | 'conflito'> {
  const { data, error } = await supabase!
    .from(TABLE)
    .update({ state, schema_version: SCHEMA_VERSION })
    .eq('version', version)
    .select('version')
    .maybeSingle();
  if (error) throw new Error(`Não foi possível salvar (${error.message}).`);
  return data ? Number(data.version) : 'conflito';
}

// ---------- Sessão ----------

interface AuthState {
  /** undefined enquanto o Supabase confere se já existe sessão. */
  session: Session | null | undefined;
  /** Usuário chegou pelo link de "esqueci a senha" e precisa definir uma nova. */
  recovering: boolean;
  setRecovering: (v: boolean) => void;
}

const AuthCtx = createContext<AuthState>({ session: null, recovering: false, setRecovering: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(cloudEnabled ? undefined : null);
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return createElement(AuthCtx.Provider, { value: { session, recovering, setRecovering } }, children);
}

export function useAuth(): AuthState {
  return useContext(AuthCtx);
}

/** fetch que manda o token da sessão; a função /api/ia exige login quando o Supabase está configurado. */
export const authedFetch: typeof fetch = async (input, init) => {
  const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : undefined;
  const headers = new Headers(init?.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
};

/** Endereço para onde os e-mails de confirmação e de nova senha devolvem o usuário. */
export function redirectUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

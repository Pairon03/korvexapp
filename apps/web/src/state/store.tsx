import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { createSeedState, migrateTimedExercises, SCHEMA_VERSION, type PlatformState } from '@korvex/core';
import { cloudEnabled, loadWorkspace, replaceWorkspace, saveWorkspace, supabase, useAuth } from './cloud';

// As ações rodam no navegador sobre o estado inteiro. Sem Supabase, o estado fica no localStorage;
// com Supabase (etapa 1), cada personal tem o seu estado salvo na nuvem e só ele acessa.
const STORAGE_KEY = 'korvex-demo-state';
const SAVE_DELAY_MS = 800;

export type CloudStatus = 'local' | 'sem-sessao' | 'carregando' | 'pronto' | 'erro';

/** Primeiro acesso de uma conta: alunos fictícios de exemplo, com o nome e o e-mail do personal. */
function seedFor(user: User): PlatformState {
  const fresh = createSeedState();
  const name = typeof user.user_metadata?.name === 'string' ? user.user_metadata.name.trim() : '';
  fresh.trainer = { ...fresh.trainer, email: user.email ?? fresh.trainer.email, ...(name ? { name } : {}) };
  return fresh;
}

function load(): PlatformState {
  if (cloudEnabled) return createSeedState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PlatformState;
      if (parsed.schemaVersion === SCHEMA_VERSION) return migrateTimedExercises(parsed);
    }
  } catch {
    /* armazenamento indisponível: segue com dados novos */
  }
  return createSeedState();
}

type Toast = { id: number; kind: 'ok' | 'erro' | 'info'; text: string };

interface Store {
  state: PlatformState;
  /** Executa uma ação sobre uma cópia do estado e só confirma se não houver erro. */
  run: <T>(fn: (draft: PlatformState) => T | Promise<T>, success?: string | ((r: T) => string)) => Promise<T | undefined>;
  reset: () => void;
  saved: boolean;
  /** A última tentativa de salvar falhou (sem rede, armazenamento cheio...). */
  saveFailed: boolean;
  toasts: Toast[];
  toast: (kind: Toast['kind'], text: string) => void;
  dismiss: (id: number) => void;
  studentViewId: string;
  setStudentViewId: (id: string) => void;
  cloud: { enabled: boolean; status: CloudStatus; error: string | null; email: string | null; retry: () => void; signOut: () => Promise<void> };
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlatformState>(load);
  const [saved, setSaved] = useState(true);
  const [saveFailed, setSaveFailed] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [studentViewId, setStudentViewId] = useState(() => state.students[0]?.id ?? '');
  const ref = useRef(state);
  ref.current = state;
  const seq = useRef(0);

  const { session } = useAuth();
  const user = session?.user ?? null;
  const [status, setStatus] = useState<CloudStatus>(cloudEnabled ? 'carregando' : 'local');
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const version = useRef<number | null>(null);
  /** O próximo estado veio do servidor: não precisa ser gravado de volta. */
  const fromServer = useRef(false);
  const saving = useRef(false);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const adopt = useCallback((next: PlatformState) => {
    fromServer.current = true;
    setState(next);
    setStudentViewId(next.students[0]?.id ?? '');
    setSaved(true);
  }, []);

  // Carrega (ou cria) o espaço da conta sempre que o usuário logado muda.
  useEffect(() => {
    if (!cloudEnabled || session === undefined) return;
    version.current = null;
    if (!user) {
      setStatus('sem-sessao');
      adopt(createSeedState());
      return;
    }
    let alive = true;
    setStatus('carregando');
    setCloudError(null);
    (async () => {
      const ws = await loadWorkspace();
      if (ws) return { state: migrateTimedExercises(ws.state), version: ws.version };
      const fresh = seedFor(user);
      return { state: fresh, version: await replaceWorkspace(fresh) };
    })()
      .then((ws) => {
        if (!alive) return;
        version.current = ws.version;
        adopt(ws.state);
        setStatus('pronto');
      })
      .catch((err: Error) => {
        if (!alive) return;
        setCloudError(err.message);
        setStatus('erro');
      });
    return () => {
      alive = false;
    };
    // user?.id em vez de user: a renovação do token troca o objeto sem trocar a conta.
  }, [session === undefined, user?.id, attempt, adopt]);

  const toastRef = useRef<(kind: Toast['kind'], text: string) => void>(() => {});

  /** Grava o estado mais recente; se outra gravação chegar no meio, grava de novo no fim. */
  const flush = useCallback(async () => {
    if (saving.current) {
      dirty.current = true;
      return;
    }
    saving.current = true;
    try {
      do {
        dirty.current = false;
        if (version.current == null) return;
        const result = await saveWorkspace(ref.current, version.current);
        if (result === 'conflito') {
          toastRef.current('erro', 'Seus dados mudaram em outra aba ou aparelho. Carregamos a versão mais recente.');
          const ws = await loadWorkspace();
          if (ws) {
            version.current = ws.version;
            adopt(migrateTimedExercises(ws.state));
          }
          return;
        }
        version.current = result;
      } while (dirty.current);
      setSaved(true);
      setSaveFailed(false);
    } catch (err) {
      setSaved(false);
      setSaveFailed(true);
      toastRef.current('erro', `${(err as Error).message} Suas últimas alterações ainda não foram salvas.`);
    } finally {
      saving.current = false;
    }
  }, [adopt]);

  useEffect(() => {
    if (!cloudEnabled) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        setSaved(true);
        setSaveFailed(false);
      } catch {
        setSaved(false);
        setSaveFailed(true);
      }
      return;
    }
    if (fromServer.current) {
      fromServer.current = false;
      return;
    }
    if (status !== 'pronto') return;
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
  }, [state, status, flush]);

  // Avisa antes de fechar a aba com alteração ainda não gravada.
  useEffect(() => {
    if (!cloudEnabled || saved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saved]);

  const signOut = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      await flush();
    }
    await supabase?.auth.signOut();
  }, [flush]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (kind: Toast['kind'], text: string) => {
      const id = ++seq.current;
      setToasts((t) => [...t.slice(-3), { id, kind, text }]);
      setTimeout(() => dismiss(id), kind === 'erro' ? 7000 : 4000);
    },
    [dismiss],
  );
  toastRef.current = toast;

  const run = useCallback<Store['run']>(
    async (fn, success) => {
      const draft = structuredClone(ref.current);
      try {
        const result = await fn(draft);
        setState(draft);
        if (success) toast('ok', typeof success === 'function' ? success(result) : success);
        return result;
      } catch (err) {
        toast('erro', err instanceof Error ? err.message : 'Não foi possível concluir a ação.');
        return undefined;
      }
    },
    [toast],
  );

  const reset = useCallback(() => {
    const fresh = user ? seedFor(user) : createSeedState();
    setState(fresh);
    setStudentViewId(fresh.students[0].id);
    toast('info', 'Demonstração reiniciada com os dados fictícios originais.');
  }, [toast, user]);

  const cloud = useMemo(
    () => ({ enabled: cloudEnabled, status, error: cloudError, email: user?.email ?? null, retry, signOut }),
    [status, cloudError, user?.email, retry, signOut],
  );
  const value = useMemo(
    () => ({ state, run, reset, saved, saveFailed, toasts, toast, dismiss, studentViewId, setStudentViewId, cloud }),
    [state, run, reset, saved, saveFailed, toasts, toast, dismiss, studentViewId, cloud],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider ausente');
  return s;
}

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createSeedState, migrateTimedExercises, SCHEMA_VERSION, type PlatformState } from '@korvex/core';

// No protótipo, o "servidor" roda no navegador e o estado fica no localStorage.
// Em produção, cada ação abaixo vira uma chamada autenticada à API.
const STORAGE_KEY = 'korvex-demo-state';

function load(): PlatformState {
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
  toasts: Toast[];
  toast: (kind: Toast['kind'], text: string) => void;
  dismiss: (id: number) => void;
  studentViewId: string;
  setStudentViewId: (id: string) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlatformState>(load);
  const [saved, setSaved] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [studentViewId, setStudentViewId] = useState(() => state.students[0]?.id ?? '');
  const ref = useRef(state);
  ref.current = state;
  const seq = useRef(0);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [state]);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (kind: Toast['kind'], text: string) => {
      const id = ++seq.current;
      setToasts((t) => [...t.slice(-3), { id, kind, text }]);
      setTimeout(() => dismiss(id), kind === 'erro' ? 7000 : 4000);
    },
    [dismiss],
  );

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
    const fresh = createSeedState();
    setState(fresh);
    setStudentViewId(fresh.students[0].id);
    toast('info', 'Demonstração reiniciada com os dados fictícios originais.');
  }, [toast]);

  const value = useMemo(
    () => ({ state, run, reset, saved, toasts, toast, dismiss, studentViewId, setStudentViewId }),
    [state, run, reset, saved, toasts, toast, dismiss, studentViewId],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider ausente');
  return s;
}

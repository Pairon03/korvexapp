import { useState, type FormEvent } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Briefcase, Smartphone } from 'lucide-react';
import { Logo } from '../../components/Layouts';
import { Button, Callout, Field, Input, Modal } from '../../components/ui';
import { cloudEnabled, redirectUrl, supabase, useAuth } from '../../state/cloud';
import { useStore } from '../../state/store';

type Mode = 'entrar' | 'criar' | 'esqueci';

// Mensagens do Supabase em inglês viram texto claro em português.
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (m.includes('already registered')) return 'Já existe uma conta com este e-mail. Use "Entrar".';
  if (m.includes('password should be')) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (m.includes('failed to fetch') || m.includes('networkerror')) return 'Sem conexão com o servidor. Confira a internet e tente de novo.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas seguidas. Aguarde alguns minutos.';
  return message;
}

/** Tela de login com Supabase: entrar, criar conta e recuperar senha. */
export function CloudLogin() {
  const { session } = useAuth();
  const { cloud } = useStore();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [mode, setMode] = useState<Mode>('entrar');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (session && from) return <Navigate to={from} replace />;

  if (session) {
    return (
      <AuthShell title="Sua conta" subtitle={`Você entrou como ${session.user.email}.`}>
        <div className="flex flex-col gap-3">
          <Link to="/personal" className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 hover:border-accent/50">
            <Briefcase className="text-accent" />
            <span>
              <span className="block font-bold">Painel do personal</span>
              <span className="text-[13px] text-muted">Alunos, agentes e ciclos</span>
            </span>
          </Link>
          <Link to="/aluno" className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 hover:border-accent/50">
            <Smartphone className="text-accent" />
            <span>
              <span className="block font-bold">Ver como aluno</span>
              <span className="text-[13px] text-muted">Como o aluno enxerga o treino (simulação)</span>
            </span>
          </Link>
          <Button variant="ghost" onClick={() => void cloud.signOut()}>
            Sair
          </Button>
        </div>
      </AuthShell>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'entrar') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw err;
      } else if (mode === 'criar') {
        if (password.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() }, emailRedirectTo: redirectUrl() },
        });
        if (err) throw err;
        if (!data.session) {
          setNotice(`Enviamos um link de confirmação para ${email.trim()}. Abra o e-mail neste mesmo navegador para ativar a conta.`);
          setMode('entrar');
        }
      } else {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectUrl() });
        if (err) throw err;
        setNotice(`Se existir uma conta com ${email.trim()}, você vai receber um link para criar uma nova senha. Abra o link neste mesmo navegador.`);
        setMode('entrar');
      }
    } catch (err) {
      setError(friendly((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const titles: Record<Mode, [string, string]> = {
    entrar: ['Entrar', 'Acesse o painel com seu e-mail e senha.'],
    criar: ['Criar conta', 'Para personal trainers. Sua conta começa com alunos fictícios de exemplo.'],
    esqueci: ['Esqueci a senha', 'Enviamos um link para você criar uma nova senha.'],
  };

  return (
    <AuthShell title={titles[mode][0]} subtitle={titles[mode][1]}>
      {from && !notice && <Callout tone="info">Entre para continuar.</Callout>}
      {notice && <Callout tone="ok">{notice}</Callout>}
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {mode === 'criar' && (
          <Field label="Seu nome" htmlFor="auth-name">
            <Input id="auth-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
        )}
        <Field label="E-mail" htmlFor="auth-email">
          <Input id="auth-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        {mode !== 'esqueci' && (
          <Field label="Senha" htmlFor="auth-password" hint={mode === 'criar' ? 'Pelo menos 8 caracteres.' : undefined}>
            <Input
              id="auth-password"
              type="password"
              autoComplete={mode === 'criar' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
        )}
        {error && (
          <p role="alert" className="text-[13px] font-medium text-bad">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" loading={busy} disabled={!email.trim() || (mode !== 'esqueci' && !password) || (mode === 'criar' && !name.trim())}>
          {mode === 'entrar' ? 'Entrar' : mode === 'criar' ? 'Criar conta' : 'Enviar link'}
        </Button>
      </form>
      <div className="flex flex-wrap justify-between gap-3 text-[13px]">
        {mode !== 'entrar' ? (
          <ModeLink onClick={() => setMode('entrar')}>Já tenho conta</ModeLink>
        ) : (
          <ModeLink onClick={() => setMode('criar')}>Criar conta</ModeLink>
        )}
        {mode === 'entrar' && <ModeLink onClick={() => setMode('esqueci')}>Esqueci a senha</ModeLink>}
      </div>
      <p className="text-[12px] text-faint">
        Fase de teste: cadastre apenas alunos fictícios. Ao continuar, você aceita os <Link to="/termos" className="underline">termos</Link> e a{' '}
        <Link to="/privacidade" className="underline">política de privacidade</Link>.
      </p>
    </AuthShell>
  );
}

function ModeLink({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} className="font-semibold text-accent hover:underline">
      {children}
    </button>
  );
}

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="gutter mx-auto flex max-w-md flex-col gap-6 py-14">
      <Link to="/">
        <Logo />
      </Link>
      <div>
        <h1 className="display-wide text-[21px] sm:text-[26px]">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

/** Protege as áreas logadas quando o Supabase está ligado; sem ele, a demonstração segue aberta. */
export function RequireAuth() {
  const { session } = useAuth();
  const { cloud } = useStore();
  const location = useLocation();
  if (!cloudEnabled) return <Outlet />;
  if (session === null) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  if (cloud.status === 'erro') {
    return (
      <div className="gutter mx-auto flex max-w-md flex-col gap-4 py-20">
        <Callout tone="bad" title="Não conseguimos abrir seus dados">
          {cloud.error}
        </Callout>
        <div className="flex gap-2">
          <Button variant="primary" onClick={cloud.retry}>
            Tentar de novo
          </Button>
          <Button variant="ghost" onClick={() => void cloud.signOut()}>
            Sair
          </Button>
        </div>
      </div>
    );
  }
  if (session === undefined || cloud.status !== 'pronto') {
    return (
      <div className="flex justify-center py-24" role="status">
        <span className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden />
        <span className="sr-only">Carregando seus dados…</span>
      </div>
    );
  }
  return <Outlet />;
}

/** Aparece quando o usuário volta pelo link de "esqueci a senha". */
export function NewPasswordModal() {
  const { recovering, setRecovering } = useAuth();
  const { toast } = useStore();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.');
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(friendly(err.message));
    setRecovering(false);
    setPassword('');
    toast('ok', 'Senha alterada.');
    navigate('/personal');
  };

  return (
    <Modal open={recovering} onClose={() => setRecovering(false)} title="Criar nova senha">
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field label="Nova senha" htmlFor="new-password" hint="Pelo menos 8 caracteres." error={error ?? undefined}>
          <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" variant="primary" loading={busy}>
          Salvar senha
        </Button>
      </form>
    </Modal>
  );
}

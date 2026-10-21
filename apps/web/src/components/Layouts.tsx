import { NavLink, Outlet, Link } from 'react-router-dom';
import {
  Bell,
  Bot,
  CreditCard,
  Dumbbell,
  History,
  LayoutDashboard,
  Ruler,
  RefreshCcw,
  Sun,
  User,
  Users,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';
import { useStore } from '../state/store';
import { Select, cx } from './ui';

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx('display-wide flex items-center gap-2 text-[17px] font-extrabold tracking-tight', className)}>
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
        <rect x="1" y="1" width="22" height="22" rx="6" fill="var(--accent)" />
        <path d="M7 6v12M7 12l7-6M10 10l6 8" stroke="var(--accent-ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      KORVEX
    </span>
  );
}

export function Toasts() {
  const { toasts, dismiss } = useStore();
  return (
    <div
      className="pointer-events-none fixed right-0 bottom-0 z-[70] flex w-full max-w-sm flex-col gap-2 p-4"
      style={{ paddingBottom: 'max(16px, calc(env(safe-area-inset-bottom, 0px) + 72px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div key={t.id} className="rise pointer-events-auto flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 p-3 text-sm shadow-xl">
          {t.kind === 'ok' && <CheckCircle2 size={18} className="mt-px shrink-0 text-ok" />}
          {t.kind === 'erro' && <AlertTriangle size={18} className="mt-px shrink-0 text-bad" />}
          {t.kind === 'info' && <Info size={18} className="mt-px shrink-0 text-info" />}
          <p className="min-w-0 flex-1">{t.text}</p>
          <button onClick={() => dismiss(t.id)} className="text-faint hover:text-fg" aria-label="Fechar aviso">
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

const personalNav = [
  { to: '/personal', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/personal/alunos', label: 'Alunos', icon: Users },
  { to: '/personal/ciclos', label: 'Ciclos', icon: RefreshCcw },
  { to: '/personal/agentes', label: 'Agentes', icon: Bot },
  { to: '/personal/exercicios', label: 'Exercícios', icon: Dumbbell },
  { to: '/personal/assinatura', label: 'Assinatura', icon: CreditCard },
  { to: '/personal/notificacoes', label: 'Avisos', icon: Bell },
];

export function PersonalLayout() {
  const { state } = useStore();
  const unread = state.notifications.filter((n) => n.audience === 'personal' && !n.read).length;
  return (
    <div className="mx-auto flex max-w-[1400px]">
      <aside className="sticky top-12 hidden h-[calc(100vh-48px)] w-60 shrink-0 flex-col border-r border-line px-3 py-5 md:flex">
        <Link to="/" className="mb-6 px-2">
          <Logo />
        </Link>
        <nav className="flex flex-col gap-0.5" aria-label="Painel do personal">
          {personalNav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold', isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg')
              }
            >
              <Icon size={17} aria-hidden />
              {label}
              {label === 'Avisos' && unread > 0 && <span className="num ml-auto rounded bg-accent px-1.5 text-[11px] text-accent-ink">{unread}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-lg border border-line bg-surface p-3 text-[12px]">
          <p className="font-semibold">{state.trainer.name}</p>
          <p className="text-muted">{state.trainer.businessName}</p>
        </div>
      </aside>
      <main className="gutter min-w-0 flex-1 pt-6 pb-28 md:px-8 md:pb-12">
        <Outlet />
      </main>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' }}
        aria-label="Painel do personal"
      >
        {personalNav.slice(0, 5).map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => cx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold', isActive ? 'text-accent' : 'text-muted')}
          >
            <Icon size={19} aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

const alunoNav = [
  { to: '/aluno', label: 'Hoje', icon: Sun, end: true },
  { to: '/aluno/historico', label: 'Histórico', icon: History },
  { to: '/aluno/avaliacao', label: 'Avaliação', icon: Ruler },
  { to: '/aluno/perfil', label: 'Perfil', icon: User },
];

export function AlunoLayout() {
  const { state, studentViewId, setStudentViewId } = useStore();
  const eligible = state.students.filter((s) => s.status !== 'arquivado');
  return (
    <div className="mx-auto max-w-md pb-28">
      <div className="gutter flex items-center justify-between gap-3 border-b border-line bg-surface-2/50 py-2">
        <label htmlFor="as-student" className="text-[12px] text-muted">
          Entrar como
        </label>
        <Select id="as-student" value={studentViewId} onChange={(e) => setStudentViewId(e.target.value)} className="h-8 max-w-[220px] text-[13px]">
          {eligible.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.status === 'convidado' ? ' (convite pendente)' : ''}
            </option>
          ))}
        </Select>
      </div>
      <main className="gutter pt-5">
        <Outlet />
      </main>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="App do aluno"
      >
        <div className="mx-auto flex max-w-md">
          {alunoNav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cx('flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold', isActive ? 'text-accent' : 'text-muted')}
            >
              <Icon size={20} aria-hidden />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

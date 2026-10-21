import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cycleStateLabel, type CycleState } from '@korvex/core';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';
export function buttonClass(variant: Variant = 'secondary', size: Size = 'md', className?: string) {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap',
    size === 'sm' && 'h-8 px-3 text-[13px]',
    size === 'md' && 'h-10 px-4 text-sm',
    size === 'lg' && 'h-13 px-6 text-base',
    variant === 'primary' && 'bg-accent text-accent-ink hover:bg-accent-strong',
    variant === 'secondary' && 'border border-line bg-surface-2 text-fg hover:bg-surface-3',
    variant === 'ghost' && 'text-muted hover:bg-surface-2 hover:text-fg',
    variant === 'danger' && 'border border-bad/40 bg-bad-soft text-bad hover:bg-bad/20',
    className,
  );
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button {...rest} disabled={rest.disabled || loading} className={buttonClass(variant, size, className)}>
      {loading && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
}

/** Link com aparência de botão (evita botão dentro de link). */
export function LinkButton({ to, variant = 'secondary', size = 'md', className, children, onClick }: { to: string; variant?: Variant; size?: Size; className?: string; children: ReactNode; onClick?: () => void }) {
  return (
    <Link to={to} onClick={onClick} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

export function Card({ children, className, as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <As className={cx('rounded-xl border border-line bg-surface', className)}>{children}</As>;
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h3 className="text-[15px] font-bold">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'bad' | 'info';
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap',
        tone === 'neutral' && 'bg-surface-3 text-muted',
        tone === 'accent' && 'bg-accent-soft text-accent',
        tone === 'ok' && 'bg-ok-soft text-ok',
        tone === 'warn' && 'bg-warn-soft text-warn',
        tone === 'bad' && 'bg-bad-soft text-bad',
        tone === 'info' && 'bg-info-soft text-info',
        className,
      )}
    >
      {children}
    </span>
  );
}

export const cycleTone: Record<CycleState, Tone> = {
  agendado: 'neutral',
  em_acompanhamento: 'info',
  aguardando_avaliacao: 'warn',
  dados_incompletos: 'warn',
  em_processamento: 'info',
  aguardando_validacao: 'accent',
  publicado: 'ok',
  suspenso: 'bad',
  falhou: 'bad',
  cancelado: 'neutral',
};

export function CycleBadge({ state }: { state: CycleState }) {
  return (
    <Badge tone={cycleTone[state]}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {cycleStateLabel[state]}
    </Badge>
  );
}

export function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-fg">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-[12px] text-faint">{hint}</p>}
      {error && (
        <p role="alert" className="text-[12px] font-medium text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls =
  'h-10 min-w-0 rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none aria-[invalid=true]:border-bad';

// Largura total por padrão, a menos que o chamador defina uma largura própria.
const width = (c?: string) => (c && /(^|\s)(w-|max-w-|flex-1)/.test(c) ? '' : 'w-full');

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, width(props.className), props.className)} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputCls, width(props.className), 'pr-8', props.className)} />;
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputCls, 'w-full h-auto min-h-20 py-2', props.className)} />;
}

export function Toggle({ checked, onChange, label, description, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; id?: string }) {
  const auto = useId();
  const tid = id ?? auto;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={tid} className="text-sm font-semibold">
          {label}
        </label>
        {description && <p className="text-[13px] text-muted">{description}</p>}
      </div>
      <button
        id={tid}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-surface-3 border border-line')}
      >
        <span className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx('rise flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-base font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            '-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors',
            value === t.id ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg',
          )}
        >
          {t.label}
          {t.count != null && t.count > 0 && <span className="num rounded bg-surface-3 px-1.5 text-[11px] text-muted">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      {icon && <div className="mb-1 text-faint">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {children && <p className="max-w-md text-[13px] text-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-line bg-surface p-4">
      <span className="text-[12px] font-semibold text-muted">{label}</span>
      <span
        className={cx(
          'num text-[26px] leading-none font-semibold',
          tone === 'bad' && 'text-bad',
          tone === 'warn' && 'text-warn',
          tone === 'ok' && 'text-ok',
          tone === 'accent' && 'text-accent',
        )}
      >
        {value}
      </span>
      {hint && <span className="text-[12px] text-faint">{hint}</span>}
    </div>
  );
}

export function Progress({ value, max, tone = 'accent', label }: { value: number; max: number; tone?: Tone; label?: string }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div
        className={cx(
          'h-full rounded-full transition-all',
          tone === 'accent' && 'bg-accent',
          tone === 'ok' && 'bg-ok',
          tone === 'warn' && 'bg-warn',
          tone === 'bad' && 'bg-bad',
          tone === 'info' && 'bg-info',
          tone === 'neutral' && 'bg-faint',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="display-narrow text-[28px] leading-tight font-extrabold sm:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Callout({ tone = 'info', title, children, icon }: { tone?: Tone; title?: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <div
      className={cx(
        'flex gap-3 rounded-xl border px-4 py-3 text-[13px]',
        tone === 'info' && 'border-info/30 bg-info-soft',
        tone === 'warn' && 'border-warn/30 bg-warn-soft',
        tone === 'bad' && 'border-bad/30 bg-bad-soft',
        tone === 'ok' && 'border-ok/30 bg-ok-soft',
        tone === 'accent' && 'border-accent/30 bg-accent-soft',
        tone === 'neutral' && 'border-line bg-surface-2',
      )}
    >
      {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
      <div className="min-w-0">
        {title && <p className="font-bold text-fg">{title}</p>}
        <div className="text-muted [&_strong]:text-fg">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmButton({
  label,
  confirmLabel,
  message,
  onConfirm,
  variant = 'danger',
  size = 'sm',
}: {
  label: ReactNode;
  confirmLabel: string;
  message: string;
  onConfirm: () => void;
  variant?: Variant;
  size?: 'sm' | 'md';
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Confirme a ação">
        <p className="text-sm text-muted">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Voltar
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </Modal>
    </>
  );
}

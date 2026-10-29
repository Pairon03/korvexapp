import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { CalendarClock, ChevronDown, FlaskConical, Play, RotateCcw, Sun, Moon, SlidersHorizontal } from 'lucide-react';
import { advanceClock, cycleStateLabel, formatDate, runScheduler, type CycleReport } from '@korvex/core';
import { useStore } from '../state/store';
import { aiProvider, geminiAvailable, getAiSource, setAiSource, type AiSource } from '../state/ai';
import { Badge, Button, Callout, CycleBadge, Modal, Select, cx } from './ui';

const views = [
  { to: '/', label: 'Site', end: true },
  { to: '/personal', label: 'Personal' },
  { to: '/aluno', label: 'Aluno' },
  { to: '/admin', label: 'Admin' },
];

function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'));
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('korvex-theme', next);
    } catch {
      /* preferência só nesta sessão */
    }
    setTheme(next);
  };
  return { theme, toggle };
}

export function DemoBar() {
  const { state, run, reset } = useStore();
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<CycleReport[] | null>(null);
  const [running, setRunning] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [aiSource, setSource] = useState<AiSource>(getAiSource);

  const runNow = async () => {
    setRunning(true);
    const r = await run((d) => runScheduler(d, { provider: aiProvider() }));
    setRunning(false);
    if (r) setReport(r);
  };

  const controls = (
    <>
      <div className="flex items-center gap-1.5">
        <CalendarClock size={15} className="text-accent" aria-hidden />
        <span className="text-[12px] text-muted">Hoje:</span>
        <span className="num text-[13px] font-semibold">{formatDate(state.now)}</span>
      </div>
      <div className="flex items-center gap-1" role="group" aria-label="Avançar o relógio">
        {[1, 7, 45].map((d) => (
          <Button key={d} size="sm" variant="ghost" className="h-7 px-2" onClick={() => run((s) => advanceClock(s, d), `Relógio avançado ${d} dia(s).`)}>
            +{d}d
          </Button>
        ))}
      </div>
      <Button size="sm" variant="primary" className="h-7" onClick={runNow} loading={running}>
        <Play size={13} aria-hidden /> Executar agendador
      </Button>
      <div className="flex items-center gap-1.5">
        <label htmlFor="ai-mode" className="text-[12px] text-muted">
          IA:
        </label>
        <Select
          id="ai-mode"
          value={aiSource === 'gemini' ? 'gemini' : state.settings.aiFailureMode}
          onChange={(e) => {
            const v = e.target.value;
            const source: AiSource = v === 'gemini' ? 'gemini' : 'local';
            setAiSource(source);
            setSource(source);
            run((s) => void (s.settings.aiFailureMode = v === 'gemini' ? 'nenhuma' : (v as typeof s.settings.aiFailureMode)));
          }}
          className="h-7 w-auto py-0 text-[12px]"
        >
          <option value="nenhuma">Funcionando</option>
          <option value="resposta_invalida">Simular resposta inválida</option>
          <option value="indisponivel">Simular indisponível</option>
          {geminiAvailable && <option value="gemini">Gemini real (teste)</option>}
        </Select>
      </div>
      <Button size="sm" variant="ghost" className="h-7" onClick={() => setConfirmReset(true)}>
        <RotateCcw size={13} aria-hidden /> Reiniciar
      </Button>
    </>
  );

  return (
    <>
      <div className="sticky z-40 border-b border-line bg-surface" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="gutter mx-auto flex max-w-[1400px] items-center gap-2 py-2 sm:gap-3">
          <Badge tone="warn" className="shrink-0">
            <FlaskConical size={12} aria-label="Demonstração" /> <span className="hidden sm:inline">Demonstração</span>
          </Badge>
          <nav className="flex min-w-0 overflow-x-auto rounded-lg bg-surface-2 p-0.5" aria-label="Perfil de visualização">
            {views.map((v) => (
              <NavLink
                key={v.to}
                to={v.to}
                end={v.end}
                className={({ isActive }) =>
                  cx('shrink-0 rounded-md px-2 py-1 text-[12px] font-semibold sm:px-3', isActive ? 'bg-surface-3 text-fg' : 'text-muted hover:text-fg')
                }
              >
                {v.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden min-w-0 flex-1 flex-wrap items-center justify-end gap-x-3 gap-y-1 lg:flex">{controls}</div>
          <div className="ml-auto flex shrink-0 items-center gap-0.5 lg:ml-0">
            <button onClick={toggle} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-fg" aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-semibold text-muted hover:bg-surface-2 lg:hidden"
              aria-expanded={open}
              aria-label="Controles da demonstração"
            >
              <SlidersHorizontal size={16} /> <ChevronDown size={14} className={cx('transition-transform', open && 'rotate-180')} />
            </button>
          </div>
        </div>
        {open && <div className="gutter flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line py-2 lg:hidden">{controls}</div>}
      </div>

      <Modal open={report !== null} onClose={() => setReport(null)} title="Resultado do agendador" wide>
        <p className="mb-3 text-sm text-muted">
          O agendador verificou todos os ciclos ativos em <strong className="text-fg">{formatDate(state.now)}</strong>. Em produção, esta tarefa roda no servidor
          diariamente, no fuso da conta.
        </p>
        {report && report.length === 0 && (
          <Callout tone="neutral" title="Nenhum ciclo venceu hoje">
            Avance o relógio (+7d ou +45d) para levar ciclos à data de reavaliação e execute de novo.
          </Callout>
        )}
        <ul className="flex flex-col gap-2">
          {report?.map((r) => (
            <li key={r.cycleId + r.to} className="rounded-lg border border-line bg-surface-2 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{r.studentName}</span>
                <span className="text-[12px] text-faint">{cycleStateLabel[r.from]}</span>
                <span className="text-faint" aria-hidden>
                  →
                </span>
                <CycleBadge state={r.to} />
              </div>
              <p className="mt-1 text-[13px] text-muted">{r.message}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setReport(null);
              navigate('/personal/ciclos');
            }}
          >
            Ver ciclos
          </Button>
          <Button variant="primary" onClick={() => setReport(null)}>
            Fechar
          </Button>
        </div>
      </Modal>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Reiniciar a demonstração?">
        <p className="text-sm text-muted">Tudo o que você fez nesta demonstração será apagado deste navegador e os dados fictícios originais voltam.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmReset(false)}>
            Voltar
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setConfirmReset(false);
              reset();
            }}
          >
            Reiniciar
          </Button>
        </div>
      </Modal>
    </>
  );
}

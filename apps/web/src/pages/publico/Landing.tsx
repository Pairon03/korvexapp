import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Lock, ShieldCheck, Smartphone, Sparkles, Ruler, SlidersHorizontal, Eye, FileClock, Database } from 'lucide-react';
import {
  buildAgentContext,
  buildUpdateProposal,
  createSeedState,
  draftFromProposal,
  formatBRL,
  validatePlan,
  validationContext,
} from '@korvex/core';
import { useStore } from '../../state/store';
import { Logo } from '../../components/Layouts';
import { Badge, Button, cx, LinkButton } from '../../components/ui';

/** Gera uma proposta real com o motor do produto sobre dados fictícios. */
function useSampleProposal() {
  return useMemo(() => {
    const s = createSeedState();
    const ana = s.students.find((x) => x.name.startsWith('Ana'))!;
    const cycle = s.cycles.find((c) => c.studentId === ana.id)!;
    const ctx = buildAgentContext(s, ana, 'atualizacao', { start: cycle.startDate, end: s.now.slice(0, 10) });
    const proposal = buildUpdateProposal(ctx);
    const draft = draftFromProposal(s, ana, proposal, 'exemplo', '');
    const validations = validatePlan(draft, validationContext(s, ana));
    return { proposal, validations, adherence: ctx.adherencePct, sessions: ctx.sessionsCompleted };
  }, []);
}

const KIND = { series: 'Séries', repeticoes: 'Repetições', descanso: 'Descanso', exercicio: 'Exercício', carga: 'Carga', cardio: 'Cardio', frequencia: 'Frequência' };

export default function Landing() {
  const { state } = useStore();
  const sample = useSampleProposal();
  return (
    <div>
      <header className="gutter mx-auto flex max-w-6xl items-center justify-between py-5">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm font-semibold text-muted md:flex" aria-label="Site">
          <a href="#como-funciona" className="hover:text-fg">Como funciona</a>
          <a href="#agente" className="hover:text-fg">Agente</a>
          <a href="#seguranca" className="hover:text-fg">Segurança</a>
          <a href="#planos" className="hover:text-fg">Planos</a>
          <a href="#perguntas" className="hover:text-fg">Perguntas</a>
        </nav>
        <LinkButton to="/entrar" size="sm">Entrar</LinkButton>
      </header>

      <section className="gutter mx-auto grid max-w-6xl items-center gap-10 pt-8 pb-16 lg:grid-cols-[1.05fr_1fr] lg:pt-14">
        <div className="min-w-0">
          <p className="eyebrow mb-4">Para personal trainers · ciclos de 45 dias</p>
          <h1 className="display-wide text-[40px] leading-[0.98] font-extrabold sm:text-[56px] lg:text-[64px]">
            O treino se atualiza sozinho. <span className="text-accent">As regras são suas.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[17px] text-muted">
            Configure um agente de IA com a sua metodologia. A cada ciclo, ele lê os registros do aluno e a reavaliação, propõe a nova versão do treino e o sistema só publica se
            todas as validações passarem. Dor relatada, dados faltando ou resposta estranha da IA seguram a publicação e chegam até você.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <LinkButton to="/personal" size="lg" variant="primary">
                Abrir o painel de demonstração <ArrowRight size={18} />
              </LinkButton>
            <LinkButton to="/aluno" size="lg">
                <Smartphone size={18} /> Ver o app do aluno
              </LinkButton>
          </div>
          <p className="mt-4 text-[13px] text-faint">Demonstração com dados fictícios. Nada é enviado a servidores.</p>
        </div>

        <div className="min-w-0 rounded-2xl border border-line bg-surface p-1.5" style={{ boxShadow: 'var(--shadow)' }}>
          <div className="rounded-xl border border-line bg-bg/60">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <p className="text-[12px] text-muted">Ana Exemplo · fim do ciclo de 45 dias</p>
                <p className="font-bold">Proposta de atualização</p>
              </div>
              <Badge tone="ok">
                <CheckCircle2 size={12} /> Validada
              </Badge>
            </div>
            <div className="num grid grid-cols-3 border-b border-line text-center">
              <div className="border-r border-line px-2 py-3">
                <p className="text-xl font-semibold">{sample.sessions}</p>
                <p className="font-sans text-[11px] text-muted">sessões</p>
              </div>
              <div className="border-r border-line px-2 py-3">
                <p className="text-xl font-semibold">{sample.adherence}%</p>
                <p className="font-sans text-[11px] text-muted">adesão</p>
              </div>
              <div className="px-2 py-3">
                <p className="text-xl font-semibold">{sample.proposal.changes.length}</p>
                <p className="font-sans text-[11px] text-muted">ajustes</p>
              </div>
            </div>
            <ul className="flex flex-col divide-y divide-line">
              {sample.proposal.changes.slice(0, 4).map((c, i) => (
                <li key={i} className="px-4 py-2.5 text-[13px]">
                  <div className="flex items-center gap-2">
                    <Badge tone="info">{KIND[c.kind]}</Badge>
                    <span className="text-muted">{c.dayLabel}</span>
                  </div>
                  <p className="mt-1">
                    <span className="text-muted line-through decoration-faint">{c.before}</span> → <span className="font-semibold">{c.after}</span>
                  </p>
                  <p className="text-[12px] text-faint">{c.reason}</p>
                </li>
              ))}
            </ul>
            <div className="border-t border-line px-4 py-3">
              <p className="mb-1.5 text-[11px] font-bold tracking-wider text-muted uppercase">Checagens do servidor</p>
              <div className="flex flex-wrap gap-1.5">
                {sample.validations.map((v) => (
                  <span key={v.rule} className={cx('num rounded px-1.5 py-0.5 text-[11px]', v.ok ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn')}>
                    {v.ok ? '✓' : '!'} {v.rule}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="border-y border-line bg-surface">
        <div className="gutter mx-auto max-w-6xl py-16">
          <h2 className="display-wide text-[32px] font-extrabold sm:text-[40px]">Como um ciclo funciona</h2>
          <p className="mt-2 max-w-2xl text-muted">Quatro etapas, sempre nesta ordem. A IA só participa da terceira, e não tem permissão para publicar nada.</p>
          <ol className="mt-10 grid gap-8 md:grid-cols-4">
            {[
              { t: 'Você define as regras', d: 'Divisão, faixas de esforço, volume máximo, como progredir e quando parar. Cada mudança vira uma versão do agente.' },
              { t: 'O aluno treina e registra', d: 'Carga, repetições e esforço de cada série pelo celular, além de desconfortos. Nada se perde se a conexão cair.' },
              { t: 'A IA propõe', d: 'No vencimento, o agente recebe só o necessário: regras, histórico do ciclo e a reavaliação. Devolve uma proposta estruturada com justificativas.' },
              { t: 'O sistema decide', d: 'Validações determinísticas checam biblioteca, limitações, volume e tamanho da mudança. Passou e você autorizou: publica. Senão, chega até você.' },
            ].map((s, i) => (
              <li key={s.t} className="flex flex-col gap-2">
                <span className="display-wide num text-[44px] leading-none font-extrabold text-accent">{i + 1}</span>
                <p className="text-lg font-bold">{s.t}</p>
                <p className="text-[14px] text-muted">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="agente" className="gutter mx-auto grid max-w-6xl gap-10 py-16 lg:grid-cols-2">
        <div>
          <SlidersHorizontal className="mb-3 text-accent" />
          <h2 className="display-wide text-[30px] font-extrabold">Um agente que trabalha do seu jeito</h2>
          <p className="mt-3 text-muted">
            Em vez de um prompt solto, você preenche regras: faixas de RPE, descanso mínimo e máximo, séries por grupo muscular, aumento de carga permitido, o que fazer diante de
            desconforto. Instruções livres complementam, mas não desligam nenhuma trava de segurança.
          </p>
          <ul className="mt-5 grid grid-cols-2 gap-2 text-[13px]">
            {['RPE alvo 7 – 8,5', 'Volume 6 – 20 séries/semana', '+5% de carga no topo da faixa', 'Substituir diante de desconforto', 'Ciclo de 45 dias', 'Bloquear com dor ≥ 5/10'].map((x) => (
              <li key={x} className="num rounded-lg border border-line bg-surface px-3 py-2">
                {x}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <Ruler className="mb-3 text-accent" />
          <h2 className="display-wide text-[30px] font-extrabold">Avaliações que podem ser comparadas</h2>
          <p className="mt-3 text-muted">
            Peso, altura, circunferências e dobras cutâneas com protocolo registrado. O percentual de gordura só é calculado com protocolo definido, e a fórmula, a versão e as
            limitações ficam guardadas junto com o resultado. Medidas de protocolos diferentes não são misturadas e valores ausentes nunca viram zero.
          </p>
          <div className="mt-5 overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="num w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] text-muted">
                  <th className="px-4 py-2 font-sans">Medida</th>
                  <th className="py-2 text-right">01/09</th>
                  <th className="py-2 text-right">19/10</th>
                  <th className="px-4 py-2 text-right">Δ</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Peso', '62,4 kg', '63,1 kg', '+0,7'],
                  ['Cintura', '71,0 cm', '70,5 cm', '−0,5'],
                  ['Dobra coxa', '26,1 mm', '25,4 mm', '−0,7'],
                  ['Braço direito', '—', '28,5 cm', '—'],
                ].map((r) => (
                  <tr key={r[0]} className="border-t border-line">
                    <td className="px-4 py-2 font-sans">{r[0]}</td>
                    <td className="py-2 text-right text-muted">{r[1]}</td>
                    <td className="py-2 text-right">{r[2]}</td>
                    <td className="px-4 py-2 text-right">{r[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[12px] text-faint">Exemplo ilustrativo. Fotos corporais são opcionais e nunca bloqueiam um ciclo.</p>
        </div>
      </section>

      <section id="seguranca" className="border-y border-line bg-surface">
        <div className="gutter mx-auto max-w-6xl py-16">
          <h2 className="display-wide text-[30px] font-extrabold">Segurança e privacidade desde o desenho</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: ShieldCheck, t: 'A IA não publica', d: 'Ela produz uma proposta. Serviços do servidor validam, registram e decidem a publicação.' },
              { icon: FileClock, t: 'Nada é sobrescrito', d: 'Toda versão de treino e de agente fica no histórico, com autor, data e motivo.' },
              { icon: Database, t: 'Dados isolados', d: 'Cada personal vê só os próprios alunos; cada aluno, só os próprios dados.' },
              { icon: Lock, t: 'Fotos sob consentimento', d: 'Armazenamento privado, links temporários e revogação a qualquer momento. Não vão para a IA.' },
              { icon: Eye, t: 'Sem promessas de precisão', d: 'Estimativas mostram a fórmula e o erro esperado. Nenhuma métrica é apresentada como diagnóstico.' },
              { icon: Sparkles, t: 'Pronta para a LGPD', d: 'Exportação, correção e exclusão de dados pelo próprio aluno, com registro das solicitações.' },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="flex gap-3">
                <Icon size={20} className="mt-0.5 shrink-0 text-accent" />
                <div>
                  <p className="font-bold">{t}</p>
                  <p className="text-[14px] text-muted">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="planos" className="gutter mx-auto max-w-6xl py-16">
        <h2 className="display-wide text-[30px] font-extrabold">Planos</h2>
        <p className="mt-2 text-muted">Cobrança mensal do personal ou do studio. O aluno não paga nada para usar o app.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {state.subscriptionPlans.map((p, i) => (
            <div key={p.id} className={cx('flex flex-col gap-4 rounded-2xl border p-6', i === 1 ? 'border-accent/60 bg-accent-soft/30' : 'border-line bg-surface')}>
              <div className="flex items-center justify-between">
                <p className="display-wide text-2xl font-extrabold">{p.name}</p>
              </div>
              <p className="num text-3xl font-semibold">
                {formatBRL(p.priceCents)}
                <span className="font-sans text-sm font-normal text-muted">/mês</span>
              </p>
              <ul className="flex flex-1 flex-col gap-2 text-sm">
                {p.highlights.map((h) => (
                  <li key={h} className="flex gap-2">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent" /> {h}
                  </li>
                ))}
              </ul>
              <LinkButton to="/personal/assinatura" variant={i === 1 ? 'primary' : 'secondary'} className="w-full">
                  Começar teste
                </LinkButton>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-faint">Valores de lançamento, sujeitos a alteração.</p>
      </section>

      <section id="perguntas" className="border-t border-line bg-surface">
        <div className="gutter mx-auto max-w-3xl py-16">
          <h2 className="display-wide text-[30px] font-extrabold">Perguntas frequentes</h2>
          <div className="mt-6 flex flex-col divide-y divide-line">
            {[
              ['A IA substitui o personal?', 'Não. Ela aplica as regras que você configurou e prepara uma proposta. Você define quando ela pode publicar sozinha e quando precisa da sua aprovação.'],
              ['O que acontece se o aluno relatar dor?', 'Relatos acima do limite que você definiu suspendem a publicação automática. O treino atual continua e você recebe um aviso para revisar.'],
              ['O aluno precisa enviar fotos?', 'Não. Fotos são opcionais, exigem consentimento específico e não são usadas para gerar treinos.'],
              ['E se a IA estiver fora do ar?', 'O treino vigente continua. O sistema tenta de novo com intervalos crescentes e, se não conseguir, avisa você.'],
              ['Posso mudar o intervalo de 45 dias?', 'Sim, por agente. Estender o prazo de um aluno específico também é possível, sempre com motivo registrado.'],
              ['Como funciona o pagamento?', 'Assinatura mensal recorrente pelo Mercado Pago, com checkout hospedado. O plano só muda após a confirmação do provedor.'],
            ].map(([q, a]) => (
              <details key={q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {q}
                  <span className="text-muted transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-2 text-[14px] text-muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="gutter mx-auto max-w-6xl py-16 text-center">
        <h2 className="display-wide text-[32px] font-extrabold sm:text-[44px]">Veja um ciclo acontecer agora</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted">
          No painel de demonstração, clique em <strong className="text-fg">Executar agendador</strong> e acompanhe cinco alunos fictícios chegando ao fim do ciclo, cada um com um
          desfecho diferente.
        </p>
        <LinkButton to="/personal" size="lg" variant="primary" className="mt-6">
            Abrir o painel <ArrowRight size={18} />
          </LinkButton>
      </section>

      <footer className="border-t border-line">
        <div className="gutter mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 py-8 text-[13px] text-muted">
          <Logo />
          <nav className="flex flex-wrap gap-5" aria-label="Rodapé">
            <Link to="/termos" className="hover:text-fg">Termos de uso</Link>
            <Link to="/privacidade" className="hover:text-fg">Privacidade</Link>
            <a href="#perguntas" className="hover:text-fg">Suporte</a>
          </nav>
          <p>© {new Date(state.now).getFullYear()} Korvex. Protótipo.</p>
        </div>
      </footer>
    </div>
  );
}

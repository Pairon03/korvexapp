import { Link } from 'react-router-dom';
import { ArrowLeft, Briefcase, Smartphone, Shield } from 'lucide-react';
import { Logo } from '../../components/Layouts';
import { Button, Callout, EmptyState, LinkButton } from '../../components/ui';
import { cloudEnabled } from '../../state/cloud';
import { CloudLogin } from './Auth';

function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="gutter mx-auto max-w-3xl py-10">
      <Link to="/" className="mb-8 flex w-fit items-center gap-1 text-[13px] text-muted hover:text-fg">
        <ArrowLeft size={14} /> Início
      </Link>
      <h1 className="display-wide text-[24px]">{title}</h1>
      <div className="my-6">
        <Callout tone="warn" title="Rascunho para revisão jurídica">
          Este texto é um ponto de partida e não garante conformidade legal. Deve ser revisado por profissional qualificado antes do lançamento.
        </Callout>
      </div>
      <div className="flex flex-col gap-5 text-[15px] leading-relaxed text-muted [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-fg">{children}</div>
    </div>
  );
}

export function Terms() {
  return (
    <LegalShell title="Termos de uso">
      <h2>1. O serviço</h2>
      <p>O FitCore Korvex oferece a personal trainers e studios uma plataforma para prescrever, acompanhar e atualizar programas de treinamento com apoio de inteligência artificial.</p>
      <h2>2. Responsabilidade profissional</h2>
      <p>As propostas geradas são ferramentas de apoio. A prescrição e o acompanhamento são de responsabilidade do profissional habilitado que utiliza a plataforma.</p>
      <h2>3. Assinatura</h2>
      <p>Os planos são cobrados mensalmente. Em caso de inadimplência, recursos automáticos são suspensos e os dados são mantidos conforme a política de retenção.</p>
      <h2>4. Uso aceitável</h2>
      <p>É proibido usar a plataforma para fins de diagnóstico médico, para prescrever medicamentos ou dietas terapêuticas, ou para acessar dados de outros usuários.</p>
    </LegalShell>
  );
}

export function Privacy() {
  return (
    <LegalShell title="Política de privacidade">
      <h2>Dados tratados</h2>
      <p>Dados de cadastro, objetivos, registros de treino, medidas corporais e, apenas com consentimento específico, fotos de acompanhamento.</p>
      <h2>Finalidades</h2>
      <p>Prescrever e ajustar treinos, acompanhar a evolução e operar a assinatura. Fotos não são usadas para treinar modelos nem enviadas a provedores de IA.</p>
      <h2>Dados sensíveis</h2>
      <p>Informações de saúde, lesões e limitações têm acesso restrito ao profissional responsável e ao próprio titular.</p>
      <h2>Direitos do titular</h2>
      <p>Acesso, correção, exportação e exclusão podem ser solicitados no app, na área Perfil. A exclusão considera arquivos, dados derivados e backups, respeitando obrigações legais.</p>
      <h2>Fornecedores</h2>
      <p>Hospedagem, banco de dados, provedor de IA, e-mail e pagamento. Transferências internacionais serão avaliadas e informadas.</p>
    </LegalShell>
  );
}

export function Login() {
  if (cloudEnabled) return <CloudLogin />;
  return (
    <div className="gutter mx-auto flex max-w-md flex-col gap-6 py-14">
      <Link to="/">
        <Logo />
      </Link>
      <div>
        <h1 className="display-wide text-[21px] sm:text-[26px]">Entrar</h1>
        <p className="mt-1 text-sm text-muted">Na versão final, o acesso é por e-mail e senha com verificação. Nesta demonstração, escolha um perfil.</p>
      </div>
      <div className="flex flex-col gap-3">
        <Link to="/personal" className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 hover:border-accent/50">
          <Briefcase className="text-accent" />
          <span>
            <span className="block font-bold">Personal trainer</span>
            <span className="text-[13px] text-muted">Painel, alunos, agentes e ciclos</span>
          </span>
        </Link>
        <Link to="/aluno" className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 hover:border-accent/50">
          <Smartphone className="text-accent" />
          <span>
            <span className="block font-bold">Aluno</span>
            <span className="text-[13px] text-muted">Treino do dia, registros e avaliações</span>
          </span>
        </Link>
        <Link to="/admin" className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 hover:border-accent/50">
          <Shield className="text-accent" />
          <span>
            <span className="block font-bold">Equipe Korvex</span>
            <span className="text-[13px] text-muted">Planos, uso de IA, falhas e auditoria</span>
          </span>
        </Link>
      </div>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="py-20">
      <EmptyState title="Página não encontrada" action={<LinkButton to="/">Voltar ao início</LinkButton>}>
        O endereço pode estar incorreto ou a página foi movida.
      </EmptyState>
    </div>
  );
}

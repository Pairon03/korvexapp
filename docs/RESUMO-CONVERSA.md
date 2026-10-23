# Resumo da conversa: protótipo Korvex

## Pedido inicial
A ideia é um app fitness da Korvex, uma plataforma SaaS em que personal trainers prescrevem treinos com um agente de IA. O ponto de partida foi um "prompt mestre" com a especificação completa:
- agente de IA configurável;
- ciclos automáticos de 45 dias;
- avaliações físicas e fotos opcionais;
- assinaturas, painel administrativo, LGPD e segurança.

A combinação foi fazer primeiro **um site para visualizar o funcionamento** e só depois partir para o app nativo. O repositório usado é **`Pairon03/korvexapp`**, que estava vazio no início.

## O que foi entregue

### 1. Protótipo navegável
- **Link:** https://claude.ai/artifact/4judHzf7PVJETpePdkxrkp (privado; para mostrar a outras pessoas, use o menu Share).
- **Código:** branch `main` do `korvexapp`.

**Estrutura do código**
- `packages/core`: as regras de negócio, separadas da interface para serem reaproveitadas no servidor e no app Expo. Inclui:
  - motor de ciclos (estados, idempotência, novas tentativas e bloqueios);
  - validações determinísticas antes de publicar;
  - contrato da IA (Zod) e provedor de IA abstraído;
  - comparação de avaliações (protocolo JP3 + Siri);
  - dados fictícios.
- `apps/web`: React + Vite + Tailwind, com quatro perfis:
  - **Site:** landing, como funciona, planos, perguntas frequentes e rascunhos de termos e privacidade.
  - **Personal:** painel, alunos, ficha do aluno (treino, versões, avaliações, execução, ciclo, dados), construtor de treino, agentes com versões, biblioteca de exercícios, assinatura e avisos.
  - **Aluno (celular):** treino do dia, registro de séries, timer de descanso, relato de desconforto, histórico, avaliação, consentimento de fotos, exportação e pedido de exclusão.
  - **Admin:** indicadores, execuções de IA, planos, auditoria e simulação de falhas.
- **Barra de demonstração:** relógio simulado (+1, +7 e +45 dias), botão "Executar agendador", simulação de falhas da IA e reinício dos dados.
- **Qualidade:** 15 testes automáticos passando, verificação de tipos e CI no GitHub Actions. A documentação está no `README.md`, em `docs/ARQUITETURA.md` e no `.env.example`.

**Cenários de demonstração** (ao clicar em "Executar agendador")

| Aluno | Resultado |
|---|---|
| Ana | Treino atualizado e publicado automaticamente |
| Bruno | Aguardando avaliação |
| Carla | Suspenso: relatou dor no joelho |
| Diego | Dados incompletos: adesão de 16% |
| Elisa | Aguardando a aprovação do personal |
| Gabi | Ainda no meio do ciclo |
| Felipe | Convite pendente, sem treino (serve para testar a geração com IA) |

### 2. Identidade visual da marca
Foi aplicada a identidade do site **cvkorvex.vercel.app**:
- **Cores:** fundo `#07070A`, destaque `#FF2D4F`, apoio `#E23CCB` e `#9B4DFF`.
- **Fontes:** Michroma nos títulos e Manrope nos textos.
- **Logotipo:** "KORVEX" com o "E" espelhado.
- **Estados do sistema:**
  - erro em laranja e aviso em âmbar, para não se confundirem com o vermelho da marca;
  - "Aguardando validação" em azul, porque é um estado normal.

## O que é real e o que é simulado
**Real e testado:**
- regras dos ciclos;
- validações antes de publicar;
- histórico de versões que nunca é sobrescrito;
- comparação de avaliações.

**Simulado ou ainda inexistente:**
- **IA:** os treinos vêm de um motor de regras local. A conexão com uma IA real foi escrita para rodar no servidor, mas ainda não foi testada.
- **Sem servidor:** não há login, banco de dados, pagamento (Mercado Pago), e-mail nem upload de fotos.
- **Dados:** são fictícios e ficam só no navegador.

## Próximos passos
1. Navegar pelo protótipo e definir os ajustes de funcionamento.
2. Montar o backend: Supabase (Postgres, login e armazenamento privado), separação dos dados por personal, agendador no servidor e IA real.
3. Integrar o Mercado Pago (assinaturas e webhooks) e o envio de e-mails.
4. Fazer o app nativo com Expo, reaproveitando o `packages/core`.

## Decisões pendentes
- **Nome do produto:** manter só "Korvex" ou usar algo como "Korvex Fit"?
- **Provedor de IA:** o código está preparado para a Anthropic, mas dá para trocar.
- **Cor de destaque:** manter o vermelho `#FF2D4F` ou testar o magenta.

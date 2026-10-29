# Pontos de melhoria: comparação com a prévia do ChatGPT

Referência: https://korvexapp-2.vercel.app (Next.js, prévia visual estática com dados fictícios).
Comparada em 29/10/2026 com este protótipo.

## O que este protótipo já cobre
A prévia do ChatGPT mostra as mesmas ideias (perfil do aluno, avaliação, proposta validada, ciclo de 45 dias,
planos Essencial/Profissional/Studio de R$ 79/149/299), mas só como telas estáticas. Aqui o motor de ciclos,
as validações, o construtor de treino, o app do aluno e o painel admin funcionam de verdade sobre dados fictícios.

## O que vale aproveitar dela
| Ideia | Situação |
|---|---|
| Nome **FitCore** e frase "Você orienta. A tecnologia acompanha." | Feito: nome "FitCore Korvex" e frase no topo da landing |
| Pergunta "O ciclo sempre altera o treino após 45 dias?" | Feito: entrou nas perguntas frequentes |
| Avisos honestos sobre o que ainda não está ativo (IA, cobrança) | Já existe na barra de demonstração; a rota do Gemini avisa quando a chave não está configurada |
| Cabeçalhos de segurança no deploy (CSP, HSTS, X-Frame-Options, Permissions-Policy) | Feito: `apps/web/vercel.json` |
| Navegação "Programas" e "Avaliações" como itens próprios no painel | Feito para Avaliações: nova tela no painel com a situação de cada aluno. Programas continuam na ficha do aluno |
| Cartão do hero com o fluxo em 4 passos com ícones | Opcional: a landing já tem a seção "Como um ciclo funciona" |
| Rotas `/termos`, `/privacidade`, `/painel` separadas | Já existem aqui |

## O que não copiar
- Cor de destaque verde-limão (#B8FF3B) e fonte Arial: o app segue a identidade do site da Korvex
  (fundo #07070A, vermelho #FF2D4F, magenta #E23CCB, roxo #9B4DFF, Michroma + Manrope).
- Checkout pelo Stripe: o plano é Mercado Pago.

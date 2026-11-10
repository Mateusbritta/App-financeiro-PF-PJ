# Como foi feito (com IA)

Este projeto foi desenvolvido em conversa com uma IA (Claude Code). Esta página mostra **o pedido que originou o app**, para quem quiser entender o processo, reproduzir ou adaptar. O texto abaixo foi reconstruído a partir do resultado final, não é uma transcrição.

## Papéis
- **Eu:** defini o problema, o escopo e o que ficaria de fora; testei no dia a dia; decidi o que mudar.
- **IA:** escreveu e revisou código, testes e documentação; sugeriu soluções e apontou falhas.

## Prompt para recriar

Cole em uma IA de programação, numa pasta vazia, e ajuste ao seu caso.

```text
Crie um aplicativo web instalável no celular (PWA), em português do Brasil, para
controle financeiro de pessoa física e de MEI. Stack: Next.js (App Router, Server
Actions), TypeScript, Tailwind e Supabase (Postgres, Auth, Realtime). Hospedagem na
Vercel (plano gratuito).

Funcionalidades:
1. Boletos: cadastro manual; leitura da linha digitável (47/48 dígitos) preenchendo
   valor e vencimento; leitura do código de barras pela câmera, no aparelho; boletos
   recorrentes que preservam o dia original (dia 31 volta ao 31 depois de fevereiro);
   ao pagar, vira despesa.
2. Avisos de vencimento por e-mail (Resend) e push, 7, 3, 1 dia antes e no dia,
   configurável por pessoa, via rotina diária (Vercel Cron).
3. Lançamentos de gastos e entradas, com categoria sugerida automaticamente por
   palavras-chave e que aprende com as correções do usuário.
4. Importação de extrato OFX e CSV, sem duplicar lançamentos.
5. Limites mensais por categoria, com alerta a partir de 80%.
6. Painel: receitas, despesas, saldo, previsão após os boletos, pizza por categoria e
   próximos vencimentos.
7. Relatório mensal exportável em CSV e PDF (gerado no navegador).
8. Módulo MEI: DAS no dia 20 com valor estimado, faturamento do ano contra o limite,
   relatório de receitas brutas e prazo da DASN-SIMEI.
9. Vários aparelhos e pessoas em tempo real, com convite por e-mail e papéis de
   administrador e colaborador. Um login pode ter um espaço Pessoal e um MEI.

Requisitos não funcionais:
- Segurança no banco: RLS em todas as tabelas, com is_member/is_admin. Nenhuma chave
  no código; .env.example documentado.
- Datas sempre no fuso de São Paulo.
- Lógica de negócio (boleto, DAS, categorização, importação, PDF) em funções puras
  com testes Vitest.
- Avisar na interface e no README que valores fiscais são estimativas.
- Fora do escopo: integração com WhatsApp.

Entregue também: supabase/schema.sql, README com passo a passo para quem nunca usou
Supabase, e um guia para agentes de IA com as decisões não óbvias.
```

## Como a conversa evoluiu
> Reconstruído a partir do código e dos comentários; a ordem exata pode ter sido diferente. Ajuste com a sua memória.

1. **Base:** esquema do banco com RLS, login e o painel.
2. **Funcionalidades:** boletos, lançamentos, importação, limites, relatório e MEI, uma de cada vez, com testes.
3. **Correções de uso real:** recorrência do dia 31, duplo toque ao pagar, convites só com e-mail confirmado, limite de 1.000 linhas por consulta.
4. **Desempenho:** depois de alguns dias de uso, o app estava lento. A causa era a verificação do login ir ao Supabase duas vezes por tela; trocar `getUser()` por `getClaims()` reduziu as idas ao banco.
5. **Publicação:** deploy na Vercel, documentação e prints com dados fictícios.

## Lições
> Sugestões para você revisar e reescrever com a sua experiência.

- Pedir **uma funcionalidade por vez**, com testes, deu resultado melhor do que pedir tudo junto.
- Regras de domínio (boleto, imposto) precisam de **conferência humana**: a IA pode errar valores e prazos.
- Uso real revela o que o teste não mostra (lentidão, toques duplos, datas na virada do dia).
- Pedir à IA que **explique o motivo** de cada decisão ajuda a manter o projeto sustentável.

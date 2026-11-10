# Guia para agentes de IA (e para quem vai mexer no código)

Leia antes de alterar o projeto. É o contexto que não está óbvio só lendo os arquivos.

## O que é
App web (PWA) em português para controle de boletos, gastos, limites e impostos do MEI. Next.js (App Router) + Supabase + Vercel. Veja [funcionalidades](funcionalidades.md) e [arquitetura](arquitetura.md).

## Antes de escrever código
1. Este projeto usa uma versão do Next.js com mudanças em relação ao que você conhece. Consulte `node_modules/next/dist/docs/` antes de usar uma API (convenções, `proxy.ts` no lugar de `middleware.ts`, `cookies()` assíncrono, `searchParams` como Promise).
2. Depois de qualquer mudança, rode:
   ```bash
   npm run typecheck
   npm test
   ```
3. Texto da interface e nomes de variáveis de negócio ficam em **português**. Siga o estilo do arquivo vizinho.

## Decisões que não são óbvias

| Tema | Regra | Onde |
|---|---|---|
| Segurança | A barreira real é o **RLS** do banco. Toda tabela nova precisa de RLS ativado e políticas com `is_member(org_id)` / `is_admin(org_id)`. Filtrar por `org_id` no código é redundância útil, não a proteção. | `supabase/schema.sql` |
| Gravações | Todas passam por Server Actions em `src/app/actions.ts`, que começam com `getContext()`. Não crie rotas de API para gravar. | `src/app/actions.ts` |
| Contexto | `getContext()` (com `cache`) devolve usuário, espaço ativo e papel. Redireciona para `/login` ou `/comecar` quando preciso. O espaço ativo vem do cookie `org_id`. | `src/lib/context.ts` |
| Sessão | `proxy.ts` e `getContext()` usam `getClaims()`, que valida o JWT localmente. Não volte para `getUser()`: ele faz uma chamada de rede por requisição e deixou o app lento. | `src/proxy.ts` |
| Datas | Sempre use `hojeSP()` e as funções de `format.ts`. O servidor roda em UTC e uma data "de hoje" calculada ali vira o dia errado à noite. | `src/lib/format.ts` |
| Boleto recorrente | O dia original fica em `due_day`. Um boleto do dia 31 volta ao 31 depois de fevereiro. Nunca recalcule a partir de `due_date`. | `actions.ts`, `schema.sql` |
| Pagar boleto | O `update` só vale se o status ainda for `pendente`. Isso impede despesa duplicada com toque duplo ou dois sócios. Mantenha essa condição. | `pagarBoleto` |
| Limite do Supabase | Uma consulta devolve no máximo 1.000 linhas. Para varrer mais, pagine. | `actions.ts` (importação) |
| Avisos | Quem é avisado de quê é decidido no banco (`avisos_de_hoje`). A rota do cron só envia e exige `CRON_SECRET`. | `src/app/api/cron/avisos/route.ts` |
| MEI | Só entradas com `is_sale = true` contam no faturamento. Valores do DAS e do limite ficam em `das.ts` e são **estimativas**. | `src/lib/das.ts` |
| Convites | Só são aceitos por e-mail confirmado. Não relaxe essa regra. | `accept_invites()` |

## O que não fazer
- Não versione `.env*` (exceto `.env.example`), chaves `service_role`, VAPID privada ou `CRON_SECRET`.
- Não use a chave `service_role` fora de `src/lib/supabase/admin.ts` e da rotina de avisos.
- Não coloque dado real (e-mail, gasto, nome) em testes, prints ou exemplos.
- Não afirme valores fiscais como definitivos: o app avisa que são estimativas.

## Onde mexer para...
- **Nova tela:** `src/app/(app)/<nome>/page.tsx` e um item em `layout.tsx`.
- **Nova ação de gravação:** função em `actions.ts`, usando `getContext()`.
- **Nova tabela ou coluna:** `schema.sql` e uma migração em `supabase/` (com `if not exists`, pode rodar mais de uma vez), mais RLS.
- **Regra de negócio pura:** `src/lib/` com teste em `lib.test.ts`.
- **Valores do MEI no novo ano:** `src/lib/das.ts`.

## Verificação rápida
Para ver uma tela com dados sem expor os seus, use uma conta de teste com dados fictícios e apague-a depois. Não tire prints da sua conta real.

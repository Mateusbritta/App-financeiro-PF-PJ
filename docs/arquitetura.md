# Arquitetura

```
 Navegador / PWA ──► Vercel (Next.js)  ──► Supabase
   │                   ├─ proxy.ts           ├─ Auth (e-mail e senha)
   │                   ├─ Server Components  ├─ Postgres + RLS
   │                   ├─ Server Actions     └─ Realtime
   │                   └─ /api/cron/avisos ──► Resend (e-mail) e Web Push
   └─ Realtime (AoVivo.tsx) recarrega a tela quando outro aparelho grava
```

## Decisões principais

- **Server Components + Server Actions**: as telas leem direto do banco no servidor e todas as gravações passam por `src/app/actions.ts`. Não há API REST própria, só a rota do cron.
- **Segurança no banco (RLS)**: toda tabela tem política baseada em `is_member(org_id)` / `is_admin(org_id)`. Mesmo que o código de uma tela esqueça um filtro, o banco não entrega dados de outro espaço.
- **Espaços (organizations)**: tudo pertence a um espaço Pessoal ou MEI; `members` liga pessoas a espaços com papel de administrador ou colaborador. O espaço ativo fica no cookie `org_id`.
- **Sessão**: `src/proxy.ts` renova a sessão e redireciona quem não está logado; `getClaims()` valida o JWT localmente, evitando uma ida ao Supabase por requisição.
- **Avisos**: a função SQL `avisos_de_hoje` decide quem é avisado de quê; a rota `/api/cron/avisos` (protegida por `CRON_SECRET`) apenas envia.
- **Lógica pura testada**: leitura de boleto, DAS, categorização, importação OFX/CSV e PDF ficam em `src/lib/` com testes em Vitest.
- **Datas**: sempre calculadas no fuso de São Paulo (`hojeSP`) para o vencimento não "virar" por causa do servidor em UTC.

## Banco de dados

Tabelas: `organizations`, `members`, `invites`, `categories`, `category_rules`, `bills`, `transactions`, `push_subscriptions`. Índices em `bills(org_id, due_date)` e `transactions(org_id, date)`. Veja `supabase/schema.sql`.

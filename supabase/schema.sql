-- =====================================================================
-- App Financeiro - esquema do banco (Supabase / PostgreSQL)
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tabelas ----------

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mode text not null check (mode in ('pessoal', 'mei')),
  mei_activity text not null default 'servico' check (mei_activity in ('comercio', 'servico', 'ambos')),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists members (
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'colaborador' check (role in ('admin', 'colaborador')),
  email text,
  notify_days int[] not null default '{7,3,1,0}',
  notify_email boolean not null default true,
  notify_push boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null default 'colaborador' check (role in ('admin', 'colaborador')),
  created_at timestamptz not null default now(),
  unique (org_id, email)
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  color text not null default '#64748b',
  kind text not null check (kind in ('despesa', 'receita')),
  monthly_limit numeric(12, 2),
  created_at timestamptz not null default now(),
  unique (org_id, name, kind)
);

-- Regras aprendidas: palavra-chave -> categoria
create table if not exists category_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  keyword text not null,
  category_id uuid not null references categories(id) on delete cascade,
  unique (org_id, keyword)
);

create table if not exists bills (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  description text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  due_date date not null,
  due_day smallint check (due_day between 1 and 31), -- dia original do vencimento (recorrentes voltam ao 31 depois de fevereiro)
  barcode text,
  status text not null default 'pendente' check (status in ('pendente', 'pago')),
  paid_at date,
  category_id uuid references categories(id) on delete set null,
  recurring boolean not null default false,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists bills_org_due on bills (org_id, due_date);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  date date not null,
  description text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  type text not null check (type in ('receita', 'despesa')),
  category_id uuid references categories(id) on delete set null,
  is_sale boolean not null default false, -- MEI: entrada de venda (conta no faturamento)
  bill_id uuid references bills(id) on delete set null,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists tx_org_date on transactions (org_id, date);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ---------- Funções auxiliares ----------

create or replace function public.is_member(o uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from members where org_id = o and user_id = auth.uid())
$$;

create or replace function public.is_admin(o uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from members where org_id = o and user_id = auth.uid() and role = 'admin')
$$;

-- Cria o espaço (pessoal ou MEI), torna o criador administrador e semeia categorias.
create or replace function public.create_organization(p_name text, p_mode text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  o uuid;
  imp uuid;
  d date;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  if p_mode not in ('pessoal', 'mei') then raise exception 'modo inválido'; end if;

  insert into organizations (name, mode, created_by) values (p_name, p_mode, auth.uid()) returning id into o;
  insert into members (org_id, user_id, role, email)
    values (o, auth.uid(), 'admin', (select email from auth.users where id = auth.uid()));

  insert into categories (org_id, name, color, kind) values
    (o, 'Alimentação',  '#f97316', 'despesa'),
    (o, 'Moradia',      '#6366f1', 'despesa'),
    (o, 'Contas fixas', '#0ea5e9', 'despesa'),
    (o, 'Transporte',   '#eab308', 'despesa'),
    (o, 'Saúde',        '#ef4444', 'despesa'),
    (o, 'Lazer',        '#ec4899', 'despesa'),
    (o, 'Educação',     '#8b5cf6', 'despesa'),
    (o, 'Impostos',     '#14b8a6', 'despesa'),
    (o, 'Outros',       '#64748b', 'despesa'),
    (o, 'Outras receitas', '#84cc16', 'receita');

  if p_mode = 'mei' then
    insert into categories (org_id, name, color, kind) values
      (o, 'Fornecedores', '#a16207', 'despesa'),
      (o, 'Marketing',    '#d946ef', 'despesa'),
      (o, 'Equipamentos', '#475569', 'despesa'),
      (o, 'Vendas',       '#10b981', 'receita');

    -- DAS recorrente, sempre dia 20
    select id into imp from categories where org_id = o and name = 'Impostos' and kind = 'despesa';
    d := make_date(extract(year from current_date)::int, extract(month from current_date)::int, 20);
    if d < current_date then d := (d + interval '1 month')::date; end if;
    insert into bills (org_id, description, amount, due_date, due_day, category_id, recurring)
      values (o, 'DAS MEI', 0, d, 20, imp, true);
  else
    insert into categories (org_id, name, color, kind) values
      (o, 'Salário', '#10b981', 'receita');
  end if;

  return o;
end $$;

-- Quando alguém é convidado por e-mail, ao entrar no app o convite vira participação.
-- Só vale para e-mail confirmado por link enviado ao e-mail. Com "Confirm email" desligado o Supabase marca a
-- conta como confirmada sem enviar nada (confirmation_sent_at fica vazio), e qualquer um que criasse conta com o
-- e-mail convidado entraria no espaço.
create or replace function public.accept_invites() returns void
language plpgsql security definer set search_path = public as $$
declare em text;
begin
  if auth.uid() is null then return; end if;
  select email into em from auth.users
    where id = auth.uid() and email_confirmed_at is not null and confirmation_sent_at is not null;
  if em is null then return; end if;
  insert into members (org_id, user_id, role, email)
    select org_id, auth.uid(), role, em from invites where lower(email) = lower(em)
    on conflict do nothing;
  delete from invites where lower(email) = lower(em);
end $$;

-- Faturamento do MEI somado no banco (a API devolve no máximo 1.000 linhas; somar no app cortaria vendas).
-- Roda com as permissões de quem chama, então as regras de RLS continuam valendo.
create or replace function public.faturamento_mensal(o uuid, ano int)
returns table (mes int, total numeric)
language sql stable set search_path = public as $$
  select extract(month from date)::int, sum(amount)
  from transactions
  where org_id = o and is_sale and date >= make_date(ano, 1, 1) and date < make_date(ano + 1, 1, 1)
  group by 1
$$;

-- Rotina diária: só os pares (pessoa, boleto) que precisam de aviso hoje.
-- Vencimento no fim de semana conta como segunda-feira, igual às telas.
create or replace function public.avisos_de_hoje(hoje date)
returns table (org_id uuid, user_id uuid, email text, notify_email boolean, notify_push boolean,
               description text, amount numeric, due_date date, faltam int)
language sql stable set search_path = public as $$
  select m.org_id, m.user_id, m.email, m.notify_email, m.notify_push, b.description, b.amount, b.due_date, x.faltam
  from bills b
  join members m on m.org_id = b.org_id
  cross join lateral (
    select (case extract(isodow from b.due_date) when 6 then b.due_date + 2 when 7 then b.due_date + 1 else b.due_date end) - hoje as faltam
  ) x
  where b.status = 'pendente'
    and b.due_date between hoje - 7 and hoje + 31
    and (m.notify_email or m.notify_push)
    and (x.faltam = any (m.notify_days) or x.faltam between -5 and -1)
  order by m.org_id, m.user_id, x.faltam
$$;

grant execute on function public.create_organization(text, text) to authenticated;
grant execute on function public.accept_invites() to authenticated;
grant execute on function public.faturamento_mensal(uuid, int) to authenticated;
revoke execute on function public.avisos_de_hoje(date) from public, anon, authenticated;
grant execute on function public.avisos_de_hoje(date) to service_role;

-- ---------- Segurança em nível de linha (RLS) ----------

alter table organizations     enable row level security;
alter table members           enable row level security;
alter table invites           enable row level security;
alter table categories        enable row level security;
alter table category_rules    enable row level security;
alter table bills             enable row level security;
alter table transactions      enable row level security;
alter table push_subscriptions enable row level security;

create policy org_select on organizations for select using (is_member(id));
create policy org_update on organizations for update using (is_admin(id));

create policy mem_select on members for select using (is_member(org_id));
create policy mem_update_self on members for update using (user_id = auth.uid());
create policy mem_delete_admin on members for delete using (is_admin(org_id) and user_id <> auth.uid());
-- o próprio usuário só pode alterar as preferências de aviso, nunca o seu papel
revoke update on members from authenticated;
grant update (notify_days, notify_email, notify_push) on members to authenticated;

create policy inv_select on invites for select using (is_admin(org_id));
create policy inv_insert on invites for insert with check (is_admin(org_id));
create policy inv_delete on invites for delete using (is_admin(org_id));

create policy cat_select on categories for select using (is_member(org_id));
create policy cat_insert on categories for insert with check (is_member(org_id));
create policy cat_update on categories for update using (is_member(org_id));
create policy cat_delete on categories for delete using (is_admin(org_id));

create policy rule_select on category_rules for select using (is_member(org_id));
create policy rule_insert on category_rules for insert with check (is_member(org_id));
create policy rule_update on category_rules for update using (is_member(org_id));
create policy rule_delete on category_rules for delete using (is_admin(org_id));

create policy bill_select on bills for select using (is_member(org_id));
create policy bill_insert on bills for insert with check (is_member(org_id));
create policy bill_update on bills for update using (is_member(org_id));
create policy bill_delete on bills for delete using (is_admin(org_id));

create policy tx_select on transactions for select using (is_member(org_id));
create policy tx_insert on transactions for insert with check (is_member(org_id));
create policy tx_update on transactions for update using (is_member(org_id));
create policy tx_delete on transactions for delete using (is_admin(org_id));

create policy push_own on push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Tempo real (telas atualizam sozinhas entre aparelhos) ----------
alter publication supabase_realtime add table bills, transactions;

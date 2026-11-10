-- =====================================================================
-- App Financeiro - migração de outubro/2026
-- Para bancos criados com uma versão anterior do schema.sql.
-- Cole este arquivo no SQL Editor do Supabase e clique em Run (pode rodar mais de uma vez).
-- Bancos novos não precisam dele: o schema.sql já inclui tudo.
-- =====================================================================

-- Dia original do vencimento: boleto recorrente do dia 31 volta ao 31 depois de fevereiro.
alter table bills add column if not exists due_day smallint check (due_day between 1 and 31);
-- Boletos antigos guardam o dia de hoje. Os que já tinham escorregado para o 28 continuam no 28:
-- recadastre esses boletos com o dia certo (ou ajuste due_day aqui no SQL) que daí em diante o dia se mantém.
update bills set due_day = extract(day from due_date)::smallint where due_day is null;

-- O DAS criado em espaços MEI novos já nasce com due_day = 20.
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

-- Convite só vale para e-mail confirmado por link enviado ao e-mail (com "Confirm email" desligado o Supabase
-- confirma sozinho, sem enviar nada, e confirmation_sent_at fica vazio).
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

-- Faturamento do MEI somado no banco.
create or replace function public.faturamento_mensal(o uuid, ano int)
returns table (mes int, total numeric)
language sql stable set search_path = public as $$
  select extract(month from date)::int, sum(amount)
  from transactions
  where org_id = o and is_sale and date >= make_date(ano, 1, 1) and date < make_date(ano + 1, 1, 1)
  group by 1
$$;

-- Rotina diária: só os pares (pessoa, boleto) que precisam de aviso hoje.
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

grant execute on function public.faturamento_mensal(uuid, int) to authenticated;
revoke execute on function public.avisos_de_hoje(date) from public, anon, authenticated;
grant execute on function public.avisos_de_hoje(date) to service_role;

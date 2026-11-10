'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getContext } from '@/lib/context';
import { createClient } from '@/lib/supabase/server';
import { chaveDeAprendizado, sugerirCategoria } from '@/lib/categorize';
import { brl, hojeSP, parseMoney, soDigitos, somarMeses } from '@/lib/format';
import { decodificar, lerCSV, lerOFX } from '@/lib/importar';
import type { Estado, Row } from '@/lib/types';

const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? '').trim();
const atualizar = () => revalidatePath('/', 'layout');

async function categoriasERegras(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string) {
  const [c, r] = await Promise.all([
    supabase.from('categories').select('*').eq('org_id', orgId),
    supabase.from('category_rules').select('*').eq('org_id', orgId),
  ]);
  return { categorias: (c.data ?? []) as Row[], regras: (r.data ?? []) as Row[] };
}

/* ------------------------------ Conta / espaço ------------------------------ */

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function criarEspaco(_: Estado, fd: FormData): Promise<Estado> {
  const supabase = await createClient();
  const nome = texto(fd, 'nome');
  const modo = texto(fd, 'modo');
  if (!nome) return { error: 'Dê um nome ao espaço.' };
  if (modo !== 'pessoal' && modo !== 'mei') return { error: 'Escolha o tipo.' };
  const { data, error } = await supabase.rpc('create_organization', { p_name: nome, p_mode: modo });
  if (error) return { error: error.message };
  (await cookies()).set('org_id', data as string, { path: '/', maxAge: 60 * 60 * 24 * 365 });
  redirect('/');
}

export async function trocarEspaco(fd: FormData) {
  (await cookies()).set('org_id', texto(fd, 'id'), { path: '/', maxAge: 60 * 60 * 24 * 365 });
  atualizar();
  redirect('/');
}

/* --------------------------------- Boletos --------------------------------- */

export async function salvarBoleto(_: Estado, fd: FormData): Promise<Estado> {
  const { supabase, org } = await getContext();
  const descricao = texto(fd, 'descricao');
  const valor = parseMoney(texto(fd, 'valor'));
  const vencimento = texto(fd, 'vencimento');
  const linha = soDigitos(texto(fd, 'linha'));

  if (!descricao) return { error: 'Informe a descrição.' };
  if (!(valor >= 0) || Number.isNaN(valor)) return { error: 'Informe um valor válido.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) return { error: 'Informe a data de vencimento.' };

  if (!fd.get('forcar')) {
    const { data: iguais } = await supabase
      .from('bills')
      .select('description, amount, due_date, barcode')
      .eq('org_id', org.id)
      .or(`and(amount.eq.${valor},due_date.eq.${vencimento})${linha ? `,barcode.eq.${linha}` : ''}`)
      .limit(1);
    if (iguais?.length) {
      const d = iguais[0];
      return {
        duplicate: true,
        error: `Parece duplicado: já existe "${d.description}" de ${brl(d.amount)} com vencimento em ${d.due_date.split('-').reverse().join('/')}.`,
      };
    }
  }

  let categoria = texto(fd, 'categoria');
  const { categorias, regras } = await categoriasERegras(supabase, org.id);
  // boleto é sempre um gasto: não aceita categoria de entrada (nem de outro espaço)
  if (categoria && !categorias.some((c) => c.id === categoria && c.kind === 'despesa')) {
    return { error: 'Escolha uma categoria de gasto.' };
  }
  if (!categoria) categoria = sugerirCategoria(descricao, 'despesa', categorias, regras) ?? '';

  const { error } = await supabase.from('bills').insert({
    org_id: org.id,
    description: descricao,
    amount: valor,
    due_date: vencimento,
    barcode: linha || null,
    category_id: categoria || null,
    recurring: fd.get('recorrente') === 'on',
    due_day: Number(vencimento.slice(8, 10)),
  });
  if (error) return { error: error.message };
  atualizar();
  return { ok: true, info: 'Boleto cadastrado.' };
}

export async function pagarBoleto(fd: FormData) {
  const { supabase, org } = await getContext();
  const id = texto(fd, 'id');
  const { data: b } = await supabase.from('bills').select('*').eq('id', id).eq('org_id', org.id).single();
  // boleto com valor zerado (ex.: DAS recém-criado) precisa ter o valor informado antes
  if (!b || b.status === 'pago' || Number(b.amount) === 0) return;

  const hoje = hojeSP();
  // só um pedido consegue trocar "pendente" por "pago": um toque duplo ou dois sócios ao mesmo tempo não duplicam a despesa
  const { data: marcado } = await supabase
    .from('bills')
    .update({ status: 'pago', paid_at: hoje })
    .eq('id', id)
    .eq('org_id', org.id)
    .eq('status', 'pendente')
    .select('id');
  if (!marcado?.length) return;

  // o pagamento vira uma despesa, para entrar nos gráficos e limites
  await supabase.from('transactions').insert({
    org_id: org.id,
    date: hoje,
    description: b.description,
    amount: b.amount,
    type: 'despesa',
    category_id: b.category_id,
    bill_id: b.id,
  });

  if (b.recurring) {
    const proximo = somarMeses(b.due_date, 1, b.due_day ?? undefined);
    const { data: existe } = await supabase
      .from('bills')
      .select('id')
      .eq('org_id', org.id)
      .eq('description', b.description)
      .eq('due_date', proximo)
      .limit(1);
    if (!existe?.length) {
      await supabase.from('bills').insert({
        org_id: org.id,
        description: b.description,
        amount: b.amount,
        due_date: proximo,
        due_day: b.due_day,
        category_id: b.category_id,
        recurring: true,
      });
    }
  }
  atualizar();
}

export async function reabrirBoleto(fd: FormData) {
  const { supabase, org, role } = await getContext();
  // desfazer apaga a despesa do pagamento, e só administradores excluem lançamentos
  if (role !== 'admin') return;
  const id = texto(fd, 'id');
  await supabase.from('transactions').delete().eq('bill_id', id).eq('org_id', org.id);
  await supabase.from('bills').update({ status: 'pendente', paid_at: null }).eq('id', id).eq('org_id', org.id);
  atualizar();
}

export async function atualizarValorBoleto(fd: FormData) {
  const { supabase, org } = await getContext();
  const valor = parseMoney(texto(fd, 'valor'));
  if (!(valor >= 0)) return;
  await supabase.from('bills').update({ amount: valor }).eq('id', texto(fd, 'id')).eq('org_id', org.id);
  atualizar();
}

export async function excluirBoleto(fd: FormData) {
  const { supabase, org, role } = await getContext();
  if (role !== 'admin') return;
  await supabase.from('bills').delete().eq('id', texto(fd, 'id')).eq('org_id', org.id);
  atualizar();
}

/* ------------------------------- Lançamentos ------------------------------- */

export async function salvarLancamento(_: Estado, fd: FormData): Promise<Estado> {
  const { supabase, org } = await getContext();
  const tipo = texto(fd, 'tipo') === 'receita' ? 'receita' : 'despesa';
  const valor = parseMoney(texto(fd, 'valor'));
  const descricao = texto(fd, 'descricao');
  const data = texto(fd, 'data') || hojeSP();

  if (!descricao) return { error: 'Informe a descrição.' };
  if (!(valor > 0)) return { error: 'Informe um valor maior que zero.' };

  const { categorias, regras } = await categoriasERegras(supabase, org.id);
  const informada = texto(fd, 'categoria');
  // a categoria precisa ser do mesmo tipo do lançamento: uma despesa não pode ir para "Salário"
  if (informada && !categorias.some((c) => c.id === informada && c.kind === tipo)) {
    return { error: `Escolha uma categoria de ${tipo === 'receita' ? 'entrada' : 'gasto'}.` };
  }
  const sugerida = sugerirCategoria(descricao, tipo, categorias, regras);
  const escolhida = informada || sugerida;

  const { error } = await supabase.from('transactions').insert({
    org_id: org.id,
    date: data,
    description: descricao,
    amount: valor,
    type: tipo,
    category_id: escolhida,
    is_sale: org.mode === 'mei' && tipo === 'receita' && fd.get('venda') === 'on',
  });
  if (error) return { error: error.message };

  // aprende com a correção manual
  const chave = chaveDeAprendizado(descricao);
  if (chave && escolhida && escolhida !== sugerida) {
    await supabase
      .from('category_rules')
      .upsert({ org_id: org.id, keyword: chave, category_id: escolhida }, { onConflict: 'org_id,keyword' });
  }
  atualizar();
  return { ok: true, info: 'Lançamento salvo.' };
}

export async function excluirLancamento(fd: FormData) {
  const { supabase, org, role } = await getContext();
  if (role !== 'admin') return;
  await supabase.from('transactions').delete().eq('id', texto(fd, 'id')).eq('org_id', org.id);
  atualizar();
}

export async function mudarCategoria(fd: FormData) {
  const { supabase, org } = await getContext();
  const id = texto(fd, 'id');
  const categoria = texto(fd, 'categoria') || null;
  const { data: t } = await supabase.from('transactions').select('type, description').eq('id', id).eq('org_id', org.id).single();
  if (!t) return;
  // só aceita categoria do mesmo tipo do lançamento (e do mesmo espaço)
  if (categoria) {
    const { data: c } = await supabase.from('categories').select('id').eq('id', categoria).eq('org_id', org.id).eq('kind', t.type).maybeSingle();
    if (!c) return;
  }
  await supabase.from('transactions').update({ category_id: categoria }).eq('id', id).eq('org_id', org.id);
  const chave = chaveDeAprendizado(t.description);
  if (chave && categoria) {
    await supabase
      .from('category_rules')
      .upsert({ org_id: org.id, keyword: chave, category_id: categoria }, { onConflict: 'org_id,keyword' });
  }
  atualizar();
}

/* ------------------------------ Importar extrato ------------------------------ */

export async function importarExtrato(_: Estado, fd: FormData): Promise<Estado> {
  const { supabase, org } = await getContext();
  const arquivo = fd.get('arquivo');
  if (!(arquivo instanceof File) || arquivo.size === 0) return { error: 'Escolha um arquivo OFX ou CSV.' };

  const conteudo = decodificar(await arquivo.arrayBuffer());
  const nome = arquivo.name.toLowerCase();
  const linhas = nome.endsWith('.ofx') || /<OFX>|<STMTTRN>/i.test(conteudo) ? lerOFX(conteudo) : lerCSV(conteudo);
  if (!linhas.length) {
    return { error: 'Não encontrei lançamentos. Use um OFX do banco ou um CSV com colunas data, descrição e valor.' };
  }

  const datas = linhas.map((l) => l.data).sort();
  // o Supabase devolve no máximo 1.000 linhas por consulta: busca em páginas para não deixar duplicados passarem
  const jaTem = new Set<string>();
  for (let de = 0; ; de += 1000) {
    const { data: pagina } = await supabase
      .from('transactions')
      .select('date, amount, type')
      .eq('org_id', org.id)
      .gte('date', datas[0])
      .lte('date', datas[datas.length - 1])
      .order('id')
      .range(de, de + 999);
    for (const t of pagina ?? []) jaTem.add(`${t.date}|${Number(t.amount).toFixed(2)}|${t.type}`);
    if (!pagina || pagina.length < 1000) break;
  }

  const { categorias, regras } = await categoriasERegras(supabase, org.id);
  const novos: Row[] = [];
  let ignorados = 0;
  for (const l of linhas) {
    const tipo = l.valor < 0 ? 'despesa' : 'receita';
    const valor = Math.abs(l.valor);
    if (jaTem.has(`${l.data}|${valor.toFixed(2)}|${tipo}`)) {
      ignorados++;
      continue;
    }
    novos.push({
      org_id: org.id,
      date: l.data,
      description: l.descricao.slice(0, 200),
      amount: valor,
      type: tipo,
      category_id: sugerirCategoria(l.descricao, tipo, categorias, regras),
      is_sale: false,
    });
  }
  if (novos.length) {
    const { error } = await supabase.from('transactions').insert(novos);
    if (error) return { error: error.message };
  }
  atualizar();
  return {
    ok: true,
    info: `${novos.length} lançamento(s) importado(s)${ignorados ? `, ${ignorados} ignorado(s) por já existirem` : ''}. Revise as categorias na tela Lançamentos.`,
  };
}

/* --------------------------- Categorias e limites --------------------------- */

export async function salvarLimite(fd: FormData) {
  const { supabase, org } = await getContext();
  const bruto = texto(fd, 'limite');
  const valor = bruto ? parseMoney(bruto) : null;
  if (valor !== null && !(valor >= 0)) return;
  await supabase
    .from('categories')
    .update({ monthly_limit: valor })
    .eq('id', texto(fd, 'id'))
    .eq('org_id', org.id);
  atualizar();
}

export async function criarCategoria(_: Estado, fd: FormData): Promise<Estado> {
  const { supabase, org } = await getContext();
  const nome = texto(fd, 'nome');
  if (!nome) return { error: 'Informe o nome da categoria.' };
  const { error } = await supabase.from('categories').insert({
    org_id: org.id,
    name: nome,
    color: texto(fd, 'cor') || '#64748b',
    kind: texto(fd, 'tipo') === 'receita' ? 'receita' : 'despesa',
  });
  if (error) return { error: error.code === '23505' ? 'Essa categoria já existe.' : error.message };
  atualizar();
  return { ok: true, info: 'Categoria criada.' };
}

/* --------------------------- Equipe e preferências --------------------------- */

export async function convidar(_: Estado, fd: FormData): Promise<Estado> {
  const { supabase, org, role } = await getContext();
  if (role !== 'admin') return { error: 'Só administradores podem convidar.' };
  const email = texto(fd, 'email').toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'E-mail inválido.' };
  const papel = texto(fd, 'papel') === 'admin' ? 'admin' : 'colaborador';
  const { error } = await supabase.from('invites').upsert({ org_id: org.id, email, role: papel }, { onConflict: 'org_id,email' });
  if (error) return { error: error.message };
  atualizar();
  return { ok: true, info: `Convite criado. Peça para ${email} criar a conta (ou entrar) com esse e-mail.` };
}

export async function removerConvite(fd: FormData) {
  const { supabase, org, role } = await getContext();
  if (role !== 'admin') return;
  await supabase.from('invites').delete().eq('id', texto(fd, 'id')).eq('org_id', org.id);
  atualizar();
}

export async function removerMembro(fd: FormData) {
  const { supabase, org, role } = await getContext();
  if (role !== 'admin') return;
  await supabase.from('members').delete().eq('org_id', org.id).eq('user_id', texto(fd, 'user_id'));
  atualizar();
}

export async function salvarPreferencias(fd: FormData) {
  const { supabase, org, user } = await getContext();
  const dias = fd
    .getAll('dias')
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 30);
  await supabase
    .from('members')
    .update({ notify_days: dias, notify_email: fd.get('email') === 'on' })
    .eq('org_id', org.id)
    .eq('user_id', user.id);
  atualizar();
}

export async function salvarPush(assinatura: string): Promise<Estado> {
  const { supabase, org, user } = await getContext();
  try {
    const s = JSON.parse(assinatura);
    if (!s?.endpoint || !s?.keys?.p256dh || !s?.keys?.auth) return { error: 'Assinatura inválida.' };
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ user_id: user.id, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth }, { onConflict: 'endpoint' });
    // a regra do banco impede assumir a assinatura de outra conta que usou este mesmo aparelho
    if (error) return { error: 'Este aparelho já recebe avisos de outra conta. Desative os avisos nela primeiro.' };
    await supabase.from('members').update({ notify_push: true }).eq('org_id', org.id).eq('user_id', user.id);
    atualizar();
    return { ok: true };
  } catch {
    return { error: 'Não foi possível salvar a assinatura.' };
  }
}

/** Desliga os avisos só do aparelho atual: os outros aparelhos da pessoa continuam recebendo. */
export async function desativarPush(endpoint: string) {
  const { supabase, user } = await getContext();
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', user.id);
  atualizar();
}

export async function salvarAtividade(fd: FormData) {
  const { supabase, org, role } = await getContext();
  if (role !== 'admin') return;
  const a = texto(fd, 'atividade');
  if (!['comercio', 'servico', 'ambos'].includes(a)) return;
  await supabase.from('organizations').update({ mei_activity: a }).eq('id', org.id);
  atualizar();
}

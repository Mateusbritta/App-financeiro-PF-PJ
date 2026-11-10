import Link from 'next/link';
import { getContext } from '@/lib/context';
import { brl, dataBR, diasEntre, faixaDoMes, hojeSP, nomeDoMes, normalizarMes, vencimentoEfetivo } from '@/lib/format';
import { LIMITE_MEI, proximoVencimentoDAS } from '@/lib/das';
import type { Row } from '@/lib/types';
import Pizza from '@/components/Pizza';
import SeletorMes from '@/components/SeletorMes';
import Barra from '@/components/Barra';

export default async function Painel({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { supabase, org } = await getContext();
  const mes = normalizarMes((await searchParams).mes);
  const { inicio, fim } = faixaDoMes(mes);
  const hoje = hojeSP();
  const ano = hoje.slice(0, 4);

  const [tx, cats, pendentes, vendas] = await Promise.all([
    supabase.from('transactions').select('*').eq('org_id', org.id).gte('date', inicio).lt('date', fim),
    supabase.from('categories').select('*').eq('org_id', org.id),
    supabase.from('bills').select('*').eq('org_id', org.id).eq('status', 'pendente').order('due_date'),
    org.mode === 'mei'
      ? supabase.rpc('faturamento_mensal', { o: org.id, ano: Number(ano) })
      : Promise.resolve({ data: [] as Row[] }),
  ]);

  const transacoes = (tx.data ?? []) as Row[];
  const categorias = (cats.data ?? []) as Row[];
  const boletos = (pendentes.data ?? []) as Row[];
  const porId = new Map(categorias.map((c) => [c.id, c]));

  const receitas = transacoes.filter((t) => t.type === 'receita').reduce((s, t) => s + Number(t.amount), 0);
  const despesas = transacoes.filter((t) => t.type === 'despesa').reduce((s, t) => s + Number(t.amount), 0);

  const gastoPorCat = new Map<string, number>();
  for (const t of transacoes.filter((t) => t.type === 'despesa')) {
    gastoPorCat.set(t.category_id ?? 'sem', (gastoPorCat.get(t.category_id ?? 'sem') ?? 0) + Number(t.amount));
  }
  const fatias = [...gastoPorCat.entries()]
    .map(([id, value]) => ({ name: porId.get(id)?.name ?? 'Sem categoria', value, color: porId.get(id)?.color ?? '#94a3b8' }))
    .sort((a, b) => b.value - a.value);

  const doMes = boletos.filter((b) => b.due_date >= inicio && b.due_date < fim);
  const aPagarNoMes = doMes.reduce((s, b) => s + Number(b.amount), 0);
  const previsao = receitas - despesas - aPagarNoMes;

  const alertas = categorias
    .filter((c) => c.kind === 'despesa' && c.monthly_limit)
    .map((c) => ({ c, gasto: gastoPorCat.get(c.id) ?? 0 }))
    .filter(({ c, gasto }) => gasto >= Number(c.monthly_limit) * 0.8)
    .sort((a, b) => b.gasto / Number(b.c.monthly_limit) - a.gasto / Number(a.c.monthly_limit));

  const proximos = boletos.slice(0, 6);
  const faturamento = ((vendas.data ?? []) as Row[]).reduce((s, m) => s + Number(m.total), 0);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold">{nomeDoMes(mes)}</h1>
        <SeletorMes mes={mes} />
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Resumo titulo="Receitas" valor={brl(receitas)} cor="text-brand-700" />
        <Resumo titulo="Despesas" valor={brl(despesas)} cor="text-red-600" />
        <Resumo titulo="Saldo" valor={brl(receitas - despesas)} cor={receitas - despesas >= 0 ? 'text-brand-700' : 'text-red-600'} />
        <Resumo
          titulo="Previsão (após boletos)"
          valor={brl(previsao)}
          cor={previsao >= 0 ? 'text-slate-800' : 'text-red-600'}
          nota={`${brl(aPagarNoMes)} ainda a pagar no mês`}
        />
      </section>

      {alertas.length > 0 && (
        <section className="card border-amber-200 bg-amber-50">
          <h2 className="mb-2 text-sm font-semibold text-amber-800">Atenção aos limites</h2>
          <ul className="space-y-1 text-sm text-amber-900">
            {alertas.map(({ c, gasto }) => (
              <li key={c.id}>
                <b>{c.name}</b>: {brl(gasto)} de {brl(c.monthly_limit)} ({Math.round((gasto / Number(c.monthly_limit)) * 100)}%)
                {gasto > Number(c.monthly_limit) ? ' — limite estourado' : ''}
              </li>
            ))}
          </ul>
        </section>
      )}

      {org.mode === 'mei' && (
        <section className="card space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Faturamento de {ano} (limite do MEI)</h2>
            <Link href="/mei" className="text-xs text-brand-700 hover:underline">detalhes</Link>
          </div>
          <Barra valor={faturamento} limite={LIMITE_MEI} />
          <p className="text-sm text-slate-600">
            {brl(faturamento)} de {brl(LIMITE_MEI)} ({Math.round((faturamento / LIMITE_MEI) * 100)}%) · próximo DAS em{' '}
            <b>{dataBR(proximoVencimentoDAS(hoje))}</b>
          </p>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">Gastos por categoria</h2>
          <Pizza dados={fatias} />
        </section>

        <section className="card">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Próximos vencimentos</h2>
            <Link href="/boletos" className="text-xs text-brand-700 hover:underline">ver todos</Link>
          </div>
          {proximos.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Nenhum boleto pendente. 🎉</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {proximos.map((b) => {
                const dias = diasEntre(hoje, vencimentoEfetivo(b.due_date));
                const rotulo = dias < 0 ? `venceu há ${-dias} dia(s)` : dias === 0 ? 'vence hoje' : dias === 1 ? 'vence amanhã' : `em ${dias} dias`;
                return (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>
                      <b className="block">{b.description}</b>
                      <span className={`text-xs ${dias < 0 ? 'text-red-600' : dias <= 3 ? 'text-amber-600' : 'text-slate-500'}`}>
                        {dataBR(b.due_date)} · {rotulo}
                      </span>
                    </span>
                    <span className="tabular-nums font-medium">{brl(b.amount)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function Resumo({ titulo, valor, cor, nota }: { titulo: string; valor: string; cor: string; nota?: string }) {
  return (
    <div className="card">
      <p className="text-xs text-slate-500">{titulo}</p>
      <p className={`mt-1 whitespace-nowrap text-lg font-bold tabular-nums sm:text-xl ${cor}`}>{valor}</p>
      {nota && <p className="mt-0.5 text-xs text-slate-400">{nota}</p>}
    </div>
  );
}

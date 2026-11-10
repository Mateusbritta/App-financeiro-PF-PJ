import { getContext } from '@/lib/context';
import { brl, dataBR, faixaDoMes, nomeDoMes, normalizarMes } from '@/lib/format';
import type { Row } from '@/lib/types';
import Pizza from '@/components/Pizza';
import SeletorMes from '@/components/SeletorMes';
import BaixarPdf from '@/components/BaixarPdf';

export default async function Relatorio({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { supabase, org } = await getContext();
  const mes = normalizarMes((await searchParams).mes);
  const { inicio, fim } = faixaDoMes(mes);

  const [tx, cats] = await Promise.all([
    supabase.from('transactions').select('*').eq('org_id', org.id).gte('date', inicio).lt('date', fim).order('date'),
    supabase.from('categories').select('*').eq('org_id', org.id),
  ]);
  const transacoes = (tx.data ?? []) as Row[];
  const porId = new Map(((cats.data ?? []) as Row[]).map((c) => [c.id, c]));

  const resumir = (tipo: string) => {
    const mapa = new Map<string, number>();
    for (const t of transacoes.filter((x) => x.type === tipo)) mapa.set(t.category_id ?? 'sem', (mapa.get(t.category_id ?? 'sem') ?? 0) + Number(t.amount));
    return [...mapa.entries()]
      .map(([id, value]) => ({ name: porId.get(id)?.name ?? 'Sem categoria', value, color: porId.get(id)?.color ?? '#94a3b8' }))
      .sort((a, b) => b.value - a.value);
  };
  const despesas = resumir('despesa');
  const receitas = resumir('receita');
  const totalDesp = despesas.reduce((s, d) => s + d.value, 0);
  const totalRec = receitas.reduce((s, d) => s + d.value, 0);
  const vendas = transacoes.filter((t) => t.is_sale);
  const totalVendas = vendas.reduce((s, t) => s + Number(t.amount), 0);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold">
          Relatório de {nomeDoMes(mes)} <span className="block text-sm font-normal text-slate-500 sm:inline">· {org.name}</span>
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <SeletorMes mes={mes} />
          <a className="btn print:hidden" href={`/api/export?mes=${mes}`}>Baixar CSV (Excel)</a>
          <BaixarPdf
            nomeArquivo={`relatorio-${mes}.pdf`}
            dados={{
              espaco: org.name,
              titulo: nomeDoMes(mes),
              mei: org.mode === 'mei',
              despesas,
              receitas,
              vendas: vendas.map((v) => ({ data: dataBR(v.date), descricao: v.description, valor: Number(v.amount) })),
            }}
          />
        </div>
      </div>

      {/* no celular: receitas e despesas lado a lado e o resultado na linha de baixo, para os valores caberem no cartão */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card"><p className="text-xs text-slate-500">Receitas</p><p className="whitespace-nowrap text-base font-bold tabular-nums text-brand-700 sm:text-lg">{brl(totalRec)}</p></div>
        <div className="card"><p className="text-xs text-slate-500">Despesas</p><p className="whitespace-nowrap text-base font-bold tabular-nums text-red-600 sm:text-lg">{brl(totalDesp)}</p></div>
        <div className="card col-span-2 sm:col-span-1"><p className="text-xs text-slate-500">Resultado</p><p className={`whitespace-nowrap text-base font-bold tabular-nums sm:text-lg ${totalRec - totalDesp >= 0 ? 'text-brand-700' : 'text-red-600'}`}>{brl(totalRec - totalDesp)}</p></div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">Despesas por categoria</h2>
          <Pizza dados={despesas} />
        </section>
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">Tabela de categorias</h2>
          <table className="w-full">
            <thead>
              <tr><th className="th">Categoria</th><th className="th text-right">Total</th><th className="th text-right">%</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {despesas.map((d) => (
                <tr key={d.name}>
                  <td className="td">{d.name}</td>
                  <td className="td text-right tabular-nums">{brl(d.value)}</td>
                  <td className="td text-right tabular-nums text-slate-500">{Math.round((d.value / totalDesp) * 100)}%</td>
                </tr>
              ))}
              {despesas.length === 0 && (<tr><td className="td text-slate-500" colSpan={3}>Sem despesas no mês.</td></tr>)}
              {receitas.length > 0 && (<tr><td className="td pt-4 text-xs font-semibold uppercase text-slate-500" colSpan={3}>Receitas</td></tr>)}
              {receitas.map((d) => (
                <tr key={d.name}>
                  <td className="td">{d.name}</td>
                  <td className="td text-right tabular-nums text-brand-700">{brl(d.value)}</td>
                  <td className="td text-right tabular-nums text-slate-500">{Math.round((d.value / totalRec) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {org.mode === 'mei' && (
        <section className="card">
          <h2 className="text-sm font-semibold">Relatório mensal de receitas brutas (vendas)</h2>
          <p className="mb-3 text-xs text-slate-500">
            Guarde este relatório junto com as notas fiscais do mês. Total de receitas brutas: <b className="text-slate-800">{brl(totalVendas)}</b>
          </p>
          <table className="w-full">
            <thead><tr><th className="th">Data</th><th className="th">Descrição</th><th className="th text-right">Valor</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {vendas.map((v) => (
                <tr key={v.id}><td className="td">{dataBR(v.date)}</td><td className="td">{v.description}</td><td className="td text-right tabular-nums">{brl(v.amount)}</td></tr>
              ))}
              {vendas.length === 0 && (<tr><td className="td text-slate-500" colSpan={3}>Nenhuma venda registrada no mês.</td></tr>)}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

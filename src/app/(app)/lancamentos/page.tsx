import { getContext } from '@/lib/context';
import { excluirLancamento, mudarCategoria } from '@/app/actions';
import { brl, dataBR, faixaDoMes, hojeSP, nomeDoMes, normalizarMes } from '@/lib/format';
import type { Row } from '@/lib/types';
import FormLancamento from '@/components/FormLancamento';
import SeletorMes from '@/components/SeletorMes';

const MAXIMO = 500;

export default async function Lancamentos({ searchParams }: { searchParams: Promise<{ mes?: string; q?: string }> }) {
  const { supabase, org, role } = await getContext();
  const params = await searchParams;
  const mes = normalizarMes(params.mes);
  const q = (params.q ?? '').trim().slice(0, 60);
  const { inicio, fim } = faixaDoMes(mes);

  let consulta = supabase.from('transactions').select('*').eq('org_id', org.id).gte('date', inicio).lt('date', fim);
  if (q) consulta = consulta.ilike('description', `%${q.replace(/[%_,()]/g, ' ')}%`);
  const [{ data }, cats] = await Promise.all([
    consulta.order('date', { ascending: false }).order('created_at', { ascending: false }).limit(MAXIMO),
    supabase.from('categories').select('*').eq('org_id', org.id).order('name'),
  ]);
  const itens = (data ?? []) as Row[];
  const categorias = (cats.data ?? []) as Row[];

  return (
    <>
      <h1 className="text-lg font-bold">Lançamentos</h1>
      <FormLancamento categorias={categorias} mei={org.mode === 'mei'} hoje={hojeSP()} />

      <section className="card p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-3">
          <h2 className="text-sm font-semibold">{nomeDoMes(mes)}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <form method="get" className="flex gap-1">
              <input type="hidden" name="mes" value={mes} />
              <input name="q" defaultValue={q} placeholder="Buscar descrição" className="input w-40 py-1.5" />
              <button className="btn btn-sm">Buscar</button>
            </form>
            <SeletorMes mes={mes} extra={q ? { q } : undefined} />
          </div>
        </div>
        {itens.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">Nenhum lançamento neste período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Data</th>
                  <th className="th">Descrição</th>
                  <th className="th">Categoria</th>
                  <th className="th text-right">Valor</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itens.map((t) => (
                  <tr key={t.id}>
                    <td className="td whitespace-nowrap">{dataBR(t.date)}</td>
                    <td className="td">
                      {t.description}
                      {t.is_sale && <span className="badge ml-1 bg-brand-100 text-brand-700">venda</span>}
                    </td>
                    <td className="td">
                      <form action={mudarCategoria} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={t.id} />
                        <select name="categoria" defaultValue={t.category_id ?? ''} className="input w-36 py-1 text-xs" aria-label="Categoria">
                          <option value="">Sem categoria</option>
                          {categorias.filter((c) => c.kind === t.type).map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <button className="btn btn-sm" title="Salvar categoria (o app aprende com a sua escolha)">✓</button>
                      </form>
                    </td>
                    <td className={`td text-right font-medium tabular-nums ${t.type === 'receita' ? 'text-brand-700' : 'text-red-600'}`}>
                      {t.type === 'receita' ? '+' : '−'} {brl(t.amount)}
                    </td>
                    <td className="td text-right">
                      {role === 'admin' && (
                        <form action={excluirLancamento}>
                          <input type="hidden" name="id" value={t.id} />
                          <button className="btn-danger">Excluir</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {itens.length === MAXIMO && (
              <p className="border-t border-slate-100 p-3 text-center text-xs text-slate-500">
                Mostrando os {MAXIMO} lançamentos mais recentes do mês. Use a busca para achar os mais antigos.
              </p>
            )}
          </div>
        )}
      </section>
    </>
  );
}

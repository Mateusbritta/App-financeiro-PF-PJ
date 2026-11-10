import Link from 'next/link';
import { getContext } from '@/lib/context';
import { atualizarValorBoleto, excluirBoleto, pagarBoleto, reabrirBoleto } from '@/app/actions';
import { brl, dataBR, diasEntre, hojeSP, vencimentoEfetivo } from '@/lib/format';
import type { Row } from '@/lib/types';
import FormBoleto from '@/components/FormBoleto';
import CopiarBotao from '@/components/CopiarBotao';

const FILTROS = [
  { id: 'pendente', rotulo: 'A pagar' },
  { id: 'pago', rotulo: 'Pagos' },
  { id: 'todos', rotulo: 'Todos' },
];

export default async function Boletos({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { supabase, org, role } = await getContext();
  const { status } = await searchParams;
  const filtro = FILTROS.some((f) => f.id === status) ? (status as string) : 'pendente';
  const hoje = hojeSP();

  let consulta = supabase.from('bills').select('*').eq('org_id', org.id);
  if (filtro !== 'todos') consulta = consulta.eq('status', filtro);
  const [{ data }, cats] = await Promise.all([
    consulta.order('due_date', { ascending: filtro !== 'pago' }).limit(200),
    supabase.from('categories').select('*').eq('org_id', org.id).order('name'),
  ]);
  const boletos = (data ?? []) as Row[];
  const categorias = (cats.data ?? []) as Row[];
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const totalAPagar = boletos.filter((b) => b.status === 'pendente').reduce((s, b) => s + Number(b.amount), 0);

  return (
    <>
      <h1 className="text-lg font-bold">Boletos e contas</h1>
      <FormBoleto categorias={categorias} />

      <section className="card p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-3">
          <div className="flex gap-1">
            {FILTROS.map((f) => (
              <Link key={f.id} href={`/boletos?status=${f.id}`} className={`btn btn-sm ${filtro === f.id ? '!border-brand-600 !bg-brand-50 !text-brand-700' : ''}`}>
                {f.rotulo}
              </Link>
            ))}
          </div>
          {filtro !== 'pago' && <p className="text-sm text-slate-600">A pagar: <b>{brl(totalAPagar)}</b></p>}
        </div>

        {boletos.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">Nenhum boleto por aqui.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Vencimento</th>
                  <th className="th">Descrição</th>
                  <th className="th hidden sm:table-cell">Categoria</th>
                  <th className="th text-right">Valor</th>
                  <th className="th">Situação</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {boletos.map((b) => {
                  const dias = diasEntre(hoje, vencimentoEfetivo(b.due_date));
                  const vencido = b.status === 'pendente' && dias < 0;
                  const cat = porId.get(b.category_id);
                  return (
                    <tr key={b.id}>
                      <td className="td whitespace-nowrap">{dataBR(b.due_date)}</td>
                      <td className="td">
                        <b>{b.description}</b>
                        {b.recurring && <span className="ml-1 text-xs text-slate-400">↻ mensal</span>}
                      </td>
                      <td className="td hidden sm:table-cell">
                        {cat ? (
                          <span className="badge" style={{ background: `${cat.color}22`, color: cat.color }}>{cat.name}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="td text-right tabular-nums">
                        {b.status === 'pendente' && Number(b.amount) === 0 ? (
                          <form action={atualizarValorBoleto} className="flex justify-end gap-1">
                            <input type="hidden" name="id" value={b.id} />
                            <input name="valor" className="input w-24 py-1 text-right" placeholder="valor" inputMode="decimal" aria-label="Informar valor" />
                            <button className="btn btn-sm">OK</button>
                          </form>
                        ) : (
                          brl(b.amount)
                        )}
                      </td>
                      <td className="td whitespace-nowrap">
                        {b.status === 'pago' ? (
                          <span className="badge bg-brand-100 text-brand-700">Pago {b.paid_at ? dataBR(b.paid_at) : ''}</span>
                        ) : vencido ? (
                          <span className="badge bg-red-100 text-red-700">Vencido há {-dias}d</span>
                        ) : dias <= 3 ? (
                          <span className="badge bg-amber-100 text-amber-800">{dias === 0 ? 'Vence hoje' : `Vence em ${dias}d`}</span>
                        ) : (
                          <span className="badge bg-slate-100 text-slate-600">A vencer</span>
                        )}
                      </td>
                      <td className="td">
                        <div className="flex items-center justify-end gap-1">
                          {b.barcode && <CopiarBotao texto={b.barcode} rotulo="Copiar linha" />}
                          {b.status === 'pendente' ? (
                            // boleto sem valor (ex.: DAS recém-criado) não pode ser pago: o servidor recusa sem avisar
                            Number(b.amount) === 0 ? (
                              <span className="whitespace-nowrap text-xs text-amber-700">Informe o valor primeiro</span>
                            ) : (
                              <form action={pagarBoleto}>
                                <input type="hidden" name="id" value={b.id} />
                                <button className="btn-primary btn-sm !px-2 !py-1 !text-xs">Marcar pago</button>
                              </form>
                            )
                          ) : role === 'admin' ? (
                            <form action={reabrirBoleto}>
                              <input type="hidden" name="id" value={b.id} />
                              <button className="btn btn-sm">Desfazer</button>
                            </form>
                          ) : null}
                          {role === 'admin' && (
                            <form action={excluirBoleto}>
                              <input type="hidden" name="id" value={b.id} />
                              <button className="btn-danger" aria-label="Excluir boleto">Excluir</button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

import { getContext } from '@/lib/context';
import { salvarLimite } from '@/app/actions';
import { brl, faixaDoMes, nomeDoMes, normalizarMes } from '@/lib/format';
import type { Row } from '@/lib/types';
import Barra from '@/components/Barra';
import SeletorMes from '@/components/SeletorMes';

export default async function Limites({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { supabase, org } = await getContext();
  const mes = normalizarMes((await searchParams).mes);
  const { inicio, fim } = faixaDoMes(mes);

  const [cats, tx] = await Promise.all([
    supabase.from('categories').select('*').eq('org_id', org.id).eq('kind', 'despesa').order('name'),
    supabase.from('transactions').select('amount, category_id').eq('org_id', org.id).eq('type', 'despesa').gte('date', inicio).lt('date', fim),
  ]);
  const categorias = (cats.data ?? []) as Row[];
  const gasto = new Map<string, number>();
  for (const t of (tx.data ?? []) as Row[]) gasto.set(t.category_id, (gasto.get(t.category_id) ?? 0) + Number(t.amount));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold">Limites mensais · {nomeDoMes(mes)}</h1>
        <SeletorMes mes={mes} />
      </div>
      <p className="text-sm text-slate-600">
        Defina quanto quer gastar por categoria. O painel avisa quando você chega a 80% e quando estoura.
      </p>

      <section className="grid gap-3 md:grid-cols-2">
        {categorias.map((c) => {
          const g = gasto.get(c.id) ?? 0;
          const limite = c.monthly_limit ? Number(c.monthly_limit) : 0;
          return (
            <div key={c.id} className="card space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
                  {c.name}
                </span>
                <span className="text-sm tabular-nums text-slate-600">
                  {brl(g)}
                  {limite > 0 && <span className="text-slate-400"> / {brl(limite)}</span>}
                </span>
              </div>
              {limite > 0 ? (
                <>
                  <Barra valor={g} limite={limite} />
                  <p className={`text-xs ${g > limite ? 'font-medium text-red-600' : 'text-slate-500'}`}>
                    {g > limite ? `Estourou em ${brl(g - limite)}` : `Restam ${brl(limite - g)} (${Math.round((g / limite) * 100)}% usado)`}
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-400">Sem limite definido.</p>
              )}
              <form action={salvarLimite} className="flex gap-2">
                <input type="hidden" name="id" value={c.id} />
                <input name="limite" className="input py-1.5" inputMode="decimal" placeholder="Limite mensal (R$)" defaultValue={limite > 0 ? String(limite).replace('.', ',') : ''} aria-label={`Limite de ${c.name}`} />
                <button className="btn btn-sm">Salvar</button>
              </form>
            </div>
          );
        })}
      </section>
    </>
  );
}

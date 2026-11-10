import { notFound } from 'next/navigation';
import { getContext } from '@/lib/context';
import { salvarAtividade } from '@/app/actions';
import { LIMITE_MEI, SALARIO_MINIMO, valorDAS, proximoVencimentoDAS, prazoDASN, type Atividade } from '@/lib/das';
import { brl, dataBR, diasEntre, hojeSP } from '@/lib/format';
import type { Row } from '@/lib/types';
import Barra from '@/components/Barra';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export default async function Mei() {
  const { supabase, org, role } = await getContext();
  if (org.mode !== 'mei') notFound();

  const hoje = hojeSP();
  const ano = Number(hoje.slice(0, 4));
  const { data } = await supabase.rpc('faturamento_mensal', { o: org.id, ano });

  const porMes = Array(12).fill(0) as number[];
  for (const m of (data ?? []) as Row[]) porMes[m.mes - 1] = Number(m.total);
  const faturamento = porMes.reduce((s, v) => s + v, 0);
  const pct = (faturamento / LIMITE_MEI) * 100;
  const atividade = org.mei_activity as Atividade;
  const proxDAS = proximoVencimentoDAS(hoje);
  const diasDAS = diasEntre(hoje, proxDAS);
  const prazo = prazoDASN(ano - 1);
  const prazoPassou = hoje > prazo;

  return (
    <>
      <h1 className="text-lg font-bold">Módulo MEI</h1>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="card">
          <p className="text-xs text-slate-500">Próximo DAS</p>
          <p className="mt-1 text-xl font-bold">{dataBR(proxDAS)}</p>
          <p className={`text-xs ${diasDAS <= 3 ? 'text-amber-600' : 'text-slate-500'}`}>
            {diasDAS === 0 ? 'vence hoje' : `em ${diasDAS} dia(s)`} · estimado {brl(valorDAS(atividade))}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">Faturamento em {ano}</p>
          <p className="mt-1 text-xl font-bold">{brl(faturamento)}</p>
          <p className="text-xs text-slate-500">{pct.toFixed(1)}% do limite de {brl(LIMITE_MEI)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">Declaração anual (DASN-SIMEI)</p>
          <p className="mt-1 text-xl font-bold">{dataBR(prazo)}</p>
          <p className="text-xs text-slate-500">referente a {ano - 1}{prazoPassou ? ' · prazo já passou neste ano' : ''}</p>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold">Limite anual de faturamento</h2>
        <Barra valor={faturamento} limite={LIMITE_MEI} />
        {pct >= 100 ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Você passou do limite de {brl(LIMITE_MEI)}. Procure um contador para entender as regras de excesso e de desenquadramento.
          </p>
        ) : pct >= 80 ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Atenção: você já usou {pct.toFixed(0)}% do limite. Restam {brl(LIMITE_MEI - faturamento)} até o fim de {ano}.
          </p>
        ) : (
          <p className="text-sm text-slate-600">Restam {brl(LIMITE_MEI - faturamento)} até o limite.</p>
        )}
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
          {porMes.map((v, i) => (
            <div key={i} className="text-center">
              <div className="mx-auto flex h-16 w-full items-end rounded bg-slate-100">
                <div className="w-full rounded bg-brand-500" style={{ height: `${Math.min((v / Math.max(...porMes, 1)) * 100, 100)}%` }} title={brl(v)} />
              </div>
              <p className="mt-1 text-[10px] uppercase text-slate-500">{MESES[i]}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Só entradas marcadas como <b>venda</b> contam no faturamento. Se você abriu o MEI neste ano, o limite é proporcional aos meses de atividade — confira no Portal do Empreendedor.
        </p>
      </section>

      <section className="card space-y-2">
        <h2 className="text-sm font-semibold">Tipo de atividade (define o valor estimado do DAS)</h2>
        <form action={salvarAtividade} className="flex flex-wrap items-center gap-2">
          <select name="atividade" defaultValue={atividade} className="input w-auto" disabled={role !== 'admin'}>
            <option value="comercio">Comércio / indústria</option>
            <option value="servico">Prestação de serviços</option>
            <option value="ambos">Comércio e serviços</option>
          </select>
          {role === 'admin' && <button className="btn">Salvar</button>}
        </form>
        <p className="text-xs text-slate-500">
          Estimativa = 5% do salário mínimo (R$ {SALARIO_MINIMO.toLocaleString('pt-BR')}) + R$ 1 (ICMS) e/ou R$ 5 (ISS). Confirme o valor exato no app MEI ou no Portal do Empreendedor antes de pagar.
          O boleto "DAS MEI" já foi criado como recorrente no dia 20 — ajuste o valor na tela Boletos se precisar.
        </p>
      </section>
    </>
  );
}

import { brl } from '@/lib/format';

export type FatiaPizza = { name: string; value: number; color: string };

// círculo com perímetro 100: cada fatia ocupa no traço exatamente a sua porcentagem
const RAIO = 15.9155;

/** Gráfico de rosca em SVG (desenho, não fundo de CSS): aparece também ao imprimir ou salvar em PDF pelo navegador. */
export default function Pizza({ dados }: { dados: FatiaPizza[] }) {
  const total = dados.reduce((s, d) => s + d.value, 0);
  if (!total) {
    return <p className="py-10 text-center text-sm text-slate-500">Sem gastos neste mês ainda.</p>;
  }
  let acumulado = 0;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg viewBox="0 0 42 42" className="h-52 w-52 shrink-0 -rotate-90" role="img" aria-label={dados.map((d) => `${d.name}: ${brl(d.value)}`).join('; ')}>
        {dados.map((d) => {
          const pct = (d.value / total) * 100;
          const offset = -acumulado;
          acumulado += pct;
          return (
            <circle key={d.name} cx="21" cy="21" r={RAIO} fill="none" stroke={d.color} strokeWidth="9.1" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={offset} />
          );
        })}
      </svg>
      <ul className="w-full space-y-1.5 text-sm">
        {dados.map((d) => (
          <li key={d.name} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" aria-hidden="true">
                <circle cx="6" cy="6" r="6" fill={d.color} />
              </svg>
              {d.name}
            </span>
            <span className="tabular-nums text-slate-600">
              {brl(d.value)} <span className="text-xs text-slate-400">({Math.round((d.value / total) * 100)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

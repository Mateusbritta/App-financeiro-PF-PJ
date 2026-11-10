/** Barra de progresso: verde até 80%, amarela até 100%, vermelha acima. */
export default function Barra({ valor, limite }: { valor: number; limite: number }) {
  const pct = limite > 0 ? (valor / limite) * 100 : 0;
  const cor = pct > 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-brand-500';
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full ${cor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

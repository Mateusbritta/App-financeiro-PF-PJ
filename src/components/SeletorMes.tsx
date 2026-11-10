/** Escolha de mês por formulário GET (funciona sem JavaScript). */
export default function SeletorMes({ mes, extra }: { mes: string; extra?: Record<string, string> }) {
  return (
    <form method="get" className="flex items-center gap-2 print:hidden">
      {Object.entries(extra ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="month" name="mes" defaultValue={mes} className="input w-auto" />
      <button className="btn" type="submit">
        Ver
      </button>
    </form>
  );
}

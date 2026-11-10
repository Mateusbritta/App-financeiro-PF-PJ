import FormImportar from '@/components/FormImportar';

export default function Importar() {
  return (
    <>
      <h1 className="text-lg font-bold">Importar extrato do banco</h1>
      <p className="text-sm text-slate-600">
        Em vez de digitar tudo, baixe o extrato no app ou site do seu banco e envie aqui. Cada linha é
        categorizada automaticamente e você corrige o que precisar na tela Lançamentos — o app aprende com as correções.
      </p>
      <FormImportar />
      <section className="card space-y-2 text-sm text-slate-600">
        <h2 className="font-semibold text-slate-800">Formatos aceitos</h2>
        <p><b>OFX</b>: a maioria dos bancos oferece em "Exportar extrato". Valores negativos viram gastos e positivos viram entradas.</p>
        <p>
          <b>CSV</b>: precisa de uma linha de cabeçalho com colunas parecidas com <code className="rounded bg-slate-100 px-1">data</code>,{' '}
          <code className="rounded bg-slate-100 px-1">descrição</code> e <code className="rounded bg-slate-100 px-1">valor</code> (separador vírgula ou ponto e vírgula).
        </p>
        <p>Lançamentos com mesma data, valor e tipo de algo já cadastrado são ignorados para evitar duplicidade (inclusive boletos que você já marcou como pagos).</p>
      </section>
    </>
  );
}

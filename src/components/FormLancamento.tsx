'use client';

import { useEffect, useRef, useState } from 'react';
import { salvarLancamento } from '@/app/actions';
import type { Row } from '@/lib/types';
import Enviar from './Enviar';
import Mensagem from './Mensagem';
import { useFormulario } from './useFormulario';

type Tipo = 'despesa' | 'receita';
const LEMBRAR_TIPO = 'lancamento-tipo';

export default function FormLancamento({ categorias, mei, hoje }: { categorias: Row[]; mei: boolean; hoje: string }) {
  const { estado, enviar, pendente } = useFormulario(salvarLancamento);
  const form = useRef<HTMLFormElement>(null);
  const [tipo, setTipoEstado] = useState<Tipo>('despesa');

  // lembra neste aparelho a última aba escolhida (Gasto ou Entrada): só muda quando a pessoa tocar na outra
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(LEMBRAR_TIPO);
      if (salvo === 'despesa' || salvo === 'receita') setTipoEstado(salvo);
    } catch {}
  }, []);
  function setTipo(t: Tipo) {
    setTipoEstado(t);
    try {
      localStorage.setItem(LEMBRAR_TIPO, t);
    } catch {}
  }

  useEffect(() => {
    if (estado.ok) form.current?.reset();
  }, [estado]);

  return (
    <form ref={form} onSubmit={enviar} className="card space-y-3">
      <h2 className="text-sm font-semibold">Lançamento rápido</h2>
      {/* o tipo vai num campo oculto: limpar o formulário depois de salvar não o volta para "Gasto" escondido */}
      <input type="hidden" name="tipo" value={tipo} />
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label="Tipo de lançamento">
        {(['despesa', 'receita'] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tipo === t}
            onClick={() => setTipo(t)}
            className={`rounded-md py-1.5 text-center text-sm font-medium ${
              tipo === t ? (t === 'despesa' ? 'bg-white text-red-600 shadow-sm' : 'bg-white text-brand-700 shadow-sm') : 'text-slate-500'
            }`}
          >
            {t === 'despesa' ? 'Gasto' : 'Entrada'}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className="label" htmlFor="l-valor">Valor (R$)</label>
          <input id="l-valor" name="valor" className="input" inputMode="decimal" placeholder="0,00" required autoFocus />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="l-desc">Descrição</label>
          <input id="l-desc" name="descricao" className="input" placeholder={tipo === 'despesa' ? 'Ex.: mercado' : 'Ex.: venda para cliente'} required />
        </div>
        <div>
          <label className="label" htmlFor="l-data">Data</label>
          <input id="l-data" name="data" type="date" className="input" defaultValue={hoje} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="l-cat">Categoria</label>
          {/* recriada ao trocar o tipo, para nunca ficar marcada uma categoria do outro tipo */}
          <select key={tipo} id="l-cat" name="categoria" className="input" defaultValue="">
            <option value="">Sugerir automaticamente</option>
            {categorias.filter((c) => c.kind === tipo).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        {mei && tipo === 'receita' && (
          <label className="flex items-center gap-2 self-end pb-2 text-sm sm:col-span-2">
            <input type="checkbox" name="venda" defaultChecked /> É venda (conta no faturamento do MEI)
          </label>
        )}
      </div>
      <Mensagem estado={estado} />
      <Enviar pendente={pendente}>Salvar</Enviar>
    </form>
  );
}

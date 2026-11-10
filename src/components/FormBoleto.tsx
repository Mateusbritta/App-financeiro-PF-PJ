'use client';

import { useEffect, useRef, useState } from 'react';
import { salvarBoleto } from '@/app/actions';
import { lerLinhaDigitavel } from '@/lib/boleto';
import type { Row } from '@/lib/types';
import Enviar from './Enviar';
import EscanearBoleto from './EscanearBoleto';
import Mensagem from './Mensagem';
import { useFormulario } from './useFormulario';

export default function FormBoleto({ categorias }: { categorias: Row[] }) {
  const { estado, enviar, pendente } = useFormulario(salvarBoleto);
  const form = useRef<HTMLFormElement>(null);
  const [linha, setLinha] = useState('');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [lido, setLido] = useState('');

  useEffect(() => {
    if (estado.ok) {
      form.current?.reset();
      setLinha('');
      setValor('');
      setVencimento('');
      setLido('');
    }
  }, [estado]);

  function aoDigitarLinha(v: string) {
    setLinha(v);
    const r = lerLinhaDigitavel(v);
    if (!r) {
      setLido('');
      return;
    }
    if (r.valor) setValor(r.valor.toFixed(2).replace('.', ','));
    if (r.vencimento) setVencimento(r.vencimento);
    setLido(
      r.valor || r.vencimento
        ? `Li da linha digitável${r.valor ? `: valor ${r.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}${r.vencimento ? `, vencimento ${r.vencimento.split('-').reverse().join('/')}` : ''}. Confira antes de salvar.`
        : 'Linha reconhecida, mas sem valor/vencimento embutidos: preencha à mão.',
    );
  }

  return (
    <form ref={form} onSubmit={enviar} className="card space-y-3">
      <h2 className="text-sm font-semibold">Novo boleto</h2>
      <div>
        <label className="label" htmlFor="linha">Linha digitável (opcional — preenche valor e vencimento sozinha)</label>
        <input id="linha" name="linha" className="input" inputMode="numeric" placeholder="Cole aqui os 47 ou 48 números" value={linha} onChange={(e) => aoDigitarLinha(e.target.value)} />
        <EscanearBoleto onLido={aoDigitarLinha} />
        {lido && <p className="mt-1 text-xs text-brand-700">{lido}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="descricao">Descrição</label>
          <input id="descricao" name="descricao" className="input" placeholder="Ex.: Conta de luz" required />
        </div>
        <div>
          <label className="label" htmlFor="valor">Valor (R$)</label>
          <input id="valor" name="valor" className="input" inputMode="decimal" placeholder="0,00" required value={valor} onChange={(e) => setValor(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="vencimento">Vencimento</label>
          <input id="vencimento" name="vencimento" type="date" className="input" required value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="categoria">Categoria</label>
          <select id="categoria" name="categoria" className="input" defaultValue="">
            <option value="">Sugerir automaticamente</option>
            {categorias.filter((c) => c.kind === 'despesa').map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" name="recorrente" /> Repetir todo mês
        </label>
      </div>
      {estado.duplicate && (
        <label className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <input type="checkbox" name="forcar" /> Cadastrar mesmo assim
        </label>
      )}
      <Mensagem estado={estado} />
      <Enviar pendente={pendente}>Cadastrar boleto</Enviar>
    </form>
  );
}

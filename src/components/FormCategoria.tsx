'use client';

import { useEffect, useRef } from 'react';
import { criarCategoria } from '@/app/actions';
import Enviar from './Enviar';
import Mensagem from './Mensagem';
import { useFormulario } from './useFormulario';

export default function FormCategoria() {
  const { estado, enviar, pendente } = useFormulario(criarCategoria);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado.ok) form.current?.reset();
  }, [estado]);
  return (
    <form ref={form} onSubmit={enviar} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input name="nome" required placeholder="Nome da categoria" className="input w-56" aria-label="Nome da categoria" />
        <select name="tipo" className="input w-auto" defaultValue="despesa" aria-label="Tipo">
          <option value="despesa">Despesa</option>
          <option value="receita">Receita</option>
        </select>
        <input name="cor" type="color" defaultValue="#6366f1" className="h-9 w-12 cursor-pointer rounded border border-slate-300" aria-label="Cor" />
        <Enviar pendente={pendente} className="btn">Criar</Enviar>
      </div>
      <Mensagem estado={estado} />
    </form>
  );
}

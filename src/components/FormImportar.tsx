'use client';

import { importarExtrato } from '@/app/actions';
import Enviar from './Enviar';
import Mensagem from './Mensagem';
import { useFormulario } from './useFormulario';

export default function FormImportar() {
  const { estado, enviar, pendente } = useFormulario(importarExtrato);
  return (
    <form onSubmit={enviar} className="card space-y-3">
      <div>
        <label className="label" htmlFor="arquivo">Arquivo do extrato (.ofx ou .csv)</label>
        <input id="arquivo" name="arquivo" type="file" accept=".ofx,.csv,.txt" required className="input" />
      </div>
      <Mensagem estado={estado} />
      <Enviar pendente={pendente}>Importar</Enviar>
    </form>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import { convidar } from '@/app/actions';
import Enviar from './Enviar';
import Mensagem from './Mensagem';
import { useFormulario } from './useFormulario';

export default function FormConvite() {
  const { estado, enviar, pendente } = useFormulario(convidar);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado.ok) form.current?.reset();
  }, [estado]);
  return (
    <form ref={form} onSubmit={enviar} className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input name="email" type="email" required placeholder="email@exemplo.com" className="input w-64" aria-label="E-mail do convidado" />
        <select name="papel" className="input w-auto" defaultValue="colaborador" aria-label="Papel">
          <option value="colaborador">Colaborador (cadastra e consulta)</option>
          <option value="admin">Administrador (tudo)</option>
        </select>
        <Enviar pendente={pendente} className="btn">Convidar</Enviar>
      </div>
      <Mensagem estado={estado} />
    </form>
  );
}

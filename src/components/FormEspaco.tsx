'use client';

import { criarEspaco } from '@/app/actions';
import Enviar from './Enviar';
import Mensagem from './Mensagem';
import { useFormulario } from './useFormulario';

export default function FormEspaco() {
  const { estado, enviar, pendente } = useFormulario(criarEspaco);
  return (
    <form onSubmit={enviar} className="card space-y-4">
      <div>
        <label className="label" htmlFor="nome">Nome do espaço</label>
        <input id="nome" name="nome" className="input" placeholder="Ex.: Minhas finanças ou Meu MEI" required />
      </div>
      <fieldset className="space-y-2">
        <legend className="label">Tipo</legend>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
          <input type="radio" name="modo" value="pessoal" defaultChecked className="mt-1" />
          <span>
            <b className="block text-sm">Pessoal</b>
            <span className="text-xs text-slate-500">Gastos, limites por categoria, boletos e metas.</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
          <input type="radio" name="modo" value="mei" className="mt-1" />
          <span>
            <b className="block text-sm">MEI</b>
            <span className="text-xs text-slate-500">Tudo do pessoal + DAS todo dia 20, faturamento contra o limite anual e relatório de receitas.</span>
          </span>
        </label>
      </fieldset>
      <Mensagem estado={estado} />
      <Enviar pendente={pendente}>Criar espaço</Enviar>
    </form>
  );
}

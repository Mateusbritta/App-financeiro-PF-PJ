'use client';

import { startTransition, useActionState, type FormEvent } from 'react';
import type { Estado } from '@/lib/types';

/**
 * Como useActionState, mas envia pelo onSubmit: com `<form action>` o React 19 limpa todos os campos
 * depois de cada envio, até quando a ação devolve erro (e a pessoa teria de digitar tudo de novo).
 * Quem quiser limpar no sucesso continua fazendo `form.reset()` ao ver `estado.ok`.
 */
export function useFormulario(acao: (estado: Estado, fd: FormData) => Promise<Estado>) {
  const [estado, executar, pendente] = useActionState(acao, {});
  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => executar(fd));
  }
  return { estado, enviar, pendente };
}

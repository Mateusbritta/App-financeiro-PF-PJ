import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Row } from '@/lib/types';

export type Espaco = { id: string; name: string; mode: 'pessoal' | 'mei'; mei_activity: string };

/**
 * Usuário logado + espaço (pessoal/MEI) ativo. Redireciona para login ou criação do espaço quando necessário.
 * Convites são aceitos em /comecar, por onde o login passa.
 */
export const getContext = cache(async () => {
  const supabase = await createClient();
  // getClaims valida o JWT localmente (sem ir ao Supabase a cada tela); o proxy já renovou a sessão
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) redirect('/login');
  const user = { id: claims.claims.sub, email: claims.claims.email as string | undefined };

  const { data } = await supabase
    .from('members')
    .select('role, notify_days, notify_email, notify_push, organizations(id, name, mode, mei_activity)')
    .eq('user_id', user.id)
    .order('created_at');

  const todos = ((data ?? []) as Row[])
    .filter((m) => m.organizations)
    .map((m) => ({
      role: m.role as 'admin' | 'colaborador',
      member: m,
      org: m.organizations as Espaco,
    }));

  if (!todos.length) redirect('/comecar');

  const escolhido = (await cookies()).get('org_id')?.value;
  const atual = todos.find((t) => t.org.id === escolhido) ?? todos[0];

  return {
    supabase,
    user,
    org: atual.org,
    role: atual.role,
    member: atual.member as Row,
    espacos: todos.map((t) => t.org),
  };
});

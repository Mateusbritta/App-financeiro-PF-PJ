import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import FormEspaco from '@/components/FormEspaco';

/** O login passa por aqui: aceita convites pendentes e segue para o painel quando a pessoa já tem espaço. */
export default async function Comecar({ searchParams }: { searchParams: Promise<{ novo?: string }> }) {
  const { novo } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await supabase.rpc('accept_invites');

  const { count } = await supabase.from('members').select('org_id', { count: 'exact', head: true }).eq('user_id', user.id);
  if ((count ?? 0) > 0 && !novo) redirect('/');

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="mb-1 text-xl font-bold">{novo ? 'Novo espaço' : 'Vamos começar'}</h1>
      <p className="mb-4 text-sm text-slate-500">
        Você pode ter um espaço pessoal e outro para o MEI, mantendo as finanças separadas.
      </p>
      <FormEspaco />
    </main>
  );
}

import { getContext } from '@/lib/context';
import { removerConvite, removerMembro, salvarPreferencias } from '@/app/actions';
import type { Row } from '@/lib/types';
import FormConvite from '@/components/FormConvite';
import FormCategoria from '@/components/FormCategoria';
import AtivarAvisos from '@/components/AtivarAvisos';

const OPCOES_DIAS = [
  { v: 7, r: '7 dias antes' },
  { v: 3, r: '3 dias antes' },
  { v: 1, r: '1 dia antes' },
  { v: 0, r: 'No dia' },
];

export default async function Configuracoes() {
  const { supabase, org, role, member, user } = await getContext();
  const admin = role === 'admin';

  const [membros, convites, cats] = await Promise.all([
    supabase.from('members').select('user_id, role, email').eq('org_id', org.id).order('created_at'),
    admin ? supabase.from('invites').select('*').eq('org_id', org.id) : Promise.resolve({ data: [] as Row[] }),
    supabase.from('categories').select('*').eq('org_id', org.id).order('kind').order('name'),
  ]);
  const dias: number[] = member.notify_days ?? [];

  return (
    <>
      <h1 className="text-lg font-bold">Configurações</h1>

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold">Meus avisos de vencimento</h2>
        <form action={salvarPreferencias} className="space-y-3">
          <div className="flex flex-wrap gap-4">
            {OPCOES_DIAS.map((o) => (
              <label key={o.v} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="dias" value={o.v} defaultChecked={dias.includes(o.v)} /> {o.r}
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="email" defaultChecked={member.notify_email} /> Receber por e-mail ({user.email})
          </label>
          <button className="btn">Salvar preferências</button>
        </form>
        <p className="text-xs text-slate-500">Boletos vencidos continuam sendo avisados diariamente por até 5 dias. Quando um sócio marca o boleto como pago, os avisos param para todos.</p>
        <div className="border-t border-slate-100 pt-3">
          <AtivarAvisos ativo={!!member.notify_push} chavePublica={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''} />
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold">Quem tem acesso a “{org.name}”</h2>
        <ul className="divide-y divide-slate-100 text-sm">
          {((membros.data ?? []) as Row[]).map((m) => (
            <li key={m.user_id} className="flex items-center justify-between py-2">
              <span>
                {m.email ?? 'sem e-mail'} <span className="badge ml-1 bg-slate-100 text-slate-600">{m.role === 'admin' ? 'administrador' : 'colaborador'}</span>
              </span>
              {admin && m.user_id !== user.id && (
                <form action={removerMembro}>
                  <input type="hidden" name="user_id" value={m.user_id} />
                  <button className="btn-danger">Remover</button>
                </form>
              )}
            </li>
          ))}
          {((convites.data ?? []) as Row[]).map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2 text-slate-500">
              <span>{c.email} <span className="badge ml-1 bg-amber-100 text-amber-800">convite pendente</span></span>
              <form action={removerConvite}>
                <input type="hidden" name="id" value={c.id} />
                <button className="btn-danger">Cancelar</button>
              </form>
            </li>
          ))}
        </ul>
        {admin ? <FormConvite /> : <p className="text-xs text-slate-500">Só administradores podem convidar pessoas.</p>}
        <p className="text-xs text-slate-500">
          Quem for convidado vê os mesmos boletos e lançamentos, em tempo real, em qualquer aparelho. Colaboradores cadastram e consultam, mas não excluem registros.
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold">Categorias</h2>
        <div className="flex flex-wrap gap-2">
          {((cats.data ?? []) as Row[]).map((c) => (
            <span key={c.id} className="badge" style={{ background: `${c.color}22`, color: c.color }}>
              {c.name} · {c.kind === 'receita' ? 'receita' : 'despesa'}
            </span>
          ))}
        </div>
        <FormCategoria />
      </section>
    </>
  );
}

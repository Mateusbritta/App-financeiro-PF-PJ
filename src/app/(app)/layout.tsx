import Link from 'next/link';
import { getContext } from '@/lib/context';
import { sair, trocarEspaco } from '@/app/actions';
import Nav from '@/components/Nav';
import AoVivo from '@/components/AoVivo';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { org, espacos, user } = await getContext();

  const itens = [
    { href: '/', rotulo: 'Painel' },
    { href: '/boletos', rotulo: 'Boletos' },
    { href: '/lancamentos', rotulo: 'Lançamentos' },
    { href: '/limites', rotulo: 'Limites' },
    { href: '/relatorio', rotulo: 'Relatório' },
    { href: '/importar', rotulo: 'Importar' },
    ...(org.mode === 'mei' ? [{ href: '/mei', rotulo: 'MEI' }] : []),
    { href: '/configuracoes', rotulo: 'Configurações' },
  ];

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pb-16">
      <AoVivo orgId={org.id} />
      {/* no celular: nome do espaço com "Novo espaço" e "Sair" numa linha, e a troca de espaço na linha de baixo */}
      <header className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">◔</span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-bold">{org.name}</p>
              <p className="text-xs text-slate-500">{org.mode === 'mei' ? 'MEI' : 'Pessoal'}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 whitespace-nowrap text-xs text-slate-500 sm:hidden">
            <Link href="/comecar?novo=1" className="hover:underline">+ Novo espaço</Link>
            <form action={sair}>
              <button className="hover:underline">Sair</button>
            </form>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {espacos.length > 1 && (
            <form action={trocarEspaco} className="flex flex-1 gap-1 sm:flex-none">
              <select name="id" defaultValue={org.id} className="input min-w-0 flex-1 py-1 text-xs sm:w-auto sm:flex-none" aria-label="Espaço">
                {espacos.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.mode === 'mei' ? 'MEI' : 'pessoal'})
                  </option>
                ))}
              </select>
              <button className="btn btn-sm">Trocar</button>
            </form>
          )}
          <span className="hidden items-center gap-2 whitespace-nowrap sm:flex">
            <Link href="/comecar?novo=1" className="hover:underline">+ Novo espaço</Link>
            <span>· {user.email}</span>
            <form action={sair}>
              <button className="hover:underline">Sair</button>
            </form>
          </span>
        </div>
      </header>
      <Nav itens={itens} />
      <main className="mt-5 space-y-5">{children}</main>
    </div>
  );
}

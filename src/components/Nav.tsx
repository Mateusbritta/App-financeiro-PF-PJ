'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type ItemNav = { href: string; rotulo: string };

export default function Nav({ itens }: { itens: ItemNav[] }) {
  const caminho = usePathname();
  return (
    // quebra em linhas no celular: todos os itens ficam à vista, sem precisar deslizar para os lados
    <nav className="flex flex-wrap gap-1 print:hidden">
      {itens.map((i) => {
        const ativo = i.href === '/' ? caminho === '/' : caminho.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
              ativo ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {i.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}

import { getContext } from '@/lib/context';
import { faixaDoMes, normalizarMes } from '@/lib/format';
import type { Row } from '@/lib/types';

export async function GET(req: Request) {
  const { supabase, org } = await getContext();
  const mes = normalizarMes(new URL(req.url).searchParams.get('mes') ?? undefined);
  const { inicio, fim } = faixaDoMes(mes);

  const [tx, cats] = await Promise.all([
    supabase.from('transactions').select('*').eq('org_id', org.id).gte('date', inicio).lt('date', fim).order('date'),
    supabase.from('categories').select('id, name').eq('org_id', org.id),
  ]);
  const nomes = new Map(((cats.data ?? []) as Row[]).map((c) => [c.id, c.name]));

  const escapar = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  // Evita que o Excel interprete texto como fórmula
  const seguro = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
  const linhas = [['Data', 'Tipo', 'Descrição', 'Categoria', 'Valor', 'Venda (MEI)'].join(';')];
  for (const t of (tx.data ?? []) as Row[]) {
    linhas.push(
      [
        t.date.split('-').reverse().join('/'),
        t.type === 'receita' ? 'Receita' : 'Despesa',
        escapar(seguro(t.description)),
        escapar(seguro(nomes.get(t.category_id) ?? '')),
        Number(t.amount).toFixed(2).replace('.', ','),
        t.is_sale ? 'Sim' : '',
      ].join(';'),
    );
  }

  return new Response('﻿' + linhas.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="relatorio-${mes}.csv"`,
    },
  });
}

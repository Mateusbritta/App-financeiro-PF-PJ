'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** Atualiza as telas assim que outro aparelho (ou sócio) cadastra algo. */
export default function AoVivo({ orgId }: { orgId: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    // importar um extrato gera um evento por linha: junta os eventos próximos numa única recarga
    let espera: ReturnType<typeof setTimeout> | undefined;
    const recarregar = () => {
      clearTimeout(espera);
      espera = setTimeout(() => router.refresh(), 500);
    };
    const canal = supabase
      .channel(`org-${orgId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bills', filter: `org_id=eq.${orgId}` }, recarregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `org_id=eq.${orgId}` }, recarregar)
      .subscribe();
    return () => {
      clearTimeout(espera);
      supabase.removeChannel(canal);
    };
  }, [orgId, router]);
  return null;
}

import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin';
import { brl, dataBR, hojeSP } from '@/lib/format';
import type { Row } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Rotina diária (Vercel Cron, ver vercel.json). Para cada boleto pendente que vence em um dos
 * dias escolhidos por cada pessoa (ou que está vencido há até 5 dias), envia e-mail e/ou push.
 * Quem é avisado de quê é decidido no banco (função avisos_de_hoje), para não carregar todos os boletos.
 * Protegida por CRON_SECRET: a Vercel envia "Authorization: Bearer <CRON_SECRET>".
 */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }

  const admin = createAdminClient();
  const hoje = hojeSP();
  // na Vercel, sem NEXT_PUBLIC_APP_URL, os links do e-mail usam o endereço de produção do projeto
  const producao = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const base = process.env.NEXT_PUBLIC_APP_URL || (producao ? `https://${producao}` : '');

  const { data: avisos, error } = await admin.rpc('avisos_de_hoje', { hoje });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!avisos?.length) return NextResponse.json({ avisos: 0, emails: 0, pushes: 0 });

  // um grupo por pessoa em cada espaço, como antes: quem está em dois espaços recebe um aviso de cada
  const membros = new Map<string, Row & { relevantes: Row[] }>();
  for (const a of avisos as Row[]) {
    const chave = `${a.org_id}|${a.user_id}`;
    if (!membros.has(chave)) membros.set(chave, { ...a, relevantes: [] });
    membros.get(chave)!.relevantes.push(a);
  }

  const usuariosPush = [...new Set([...membros.values()].filter((m) => m.notify_push).map((m) => m.user_id))];
  const { data: assinaturas } = usuariosPush.length
    ? await admin.from('push_subscriptions').select('*').in('user_id', usuariosPush)
    : { data: [] as Row[] };

  const temPush = !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  if (temPush) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? 'mailto:contato@exemplo.com',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
  }

  let emails = 0;
  let pushes = 0;

  for (const m of membros.values()) {
    const { relevantes } = m;
    const linhas = relevantes.map((b) => {
      const quando = b.faltam < 0 ? `venceu há ${-b.faltam} dia(s)` : b.faltam === 0 ? 'vence HOJE' : b.faltam === 1 ? 'vence amanhã' : `vence em ${b.faltam} dias`;
      return `${b.description} — ${brl(b.amount)} — ${dataBR(b.due_date)} (${quando})`;
    });

    if (m.notify_email && m.email && process.env.RESEND_API_KEY) {
      const resposta = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? 'App Financeiro <onboarding@resend.dev>',
          to: [m.email],
          subject: relevantes.length === 1 ? `Boleto: ${linhas[0]}` : `${relevantes.length} boletos precisam de atenção`,
          text: `${linhas.join('\n')}\n\nAbra o app: ${base}/boletos`,
        }),
      });
      if (resposta.ok) emails++;
    }

    if (temPush && m.notify_push) {
      const payload = JSON.stringify({
        title: relevantes.length === 1 ? 'Boleto perto de vencer' : `${relevantes.length} boletos precisam de atenção`,
        body: linhas.slice(0, 3).join('\n'),
        url: '/boletos',
      });
      for (const s of (assinaturas ?? []).filter((a) => a.user_id === m.user_id)) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
          pushes++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('id', s.id);
        }
      }
    }
  }

  return NextResponse.json({ avisos: avisos.length, emails, pushes });
}

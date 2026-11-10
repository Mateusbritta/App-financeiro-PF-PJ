'use client';

import { useEffect, useState } from 'react';
import { desativarPush, salvarPush } from '@/app/actions';

function paraUint8(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function AtivarAvisos({ ativo, chavePublica }: { ativo: boolean; chavePublica: string }) {
  const [suportado, setSuportado] = useState(true);
  const [ligado, setLigado] = useState(false);
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);

  // o estado vale para este aparelho: ligado só se este navegador tem assinatura e o espaço manda push
  useEffect(() => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setSuportado(ok);
    if (!ok) return;
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setLigado(!!sub && ativo))
      .catch(() => {});
  }, [ativo]);

  if (!chavePublica) {
    return <p className="text-xs text-slate-500">Avisos no celular ainda não foram configurados neste servidor (veja o README, seção "Avisos push").</p>;
  }
  if (!suportado) {
    return <p className="text-xs text-slate-500">Este navegador não suporta avisos push. No iPhone, instale o app na tela inicial primeiro.</p>;
  }

  async function ativar() {
    setOcupado(true);
    setMsg('');
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== 'granted') {
        setMsg('Permissão negada. Libere as notificações nas configurações do navegador.');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: paraUint8(chavePublica) }));
      const r = await salvarPush(JSON.stringify(sub.toJSON()));
      if (r.error) setMsg(r.error);
      else setLigado(true);
    } catch {
      setMsg('Não foi possível ativar os avisos neste aparelho.');
    } finally {
      setOcupado(false);
    }
  }

  async function desativar() {
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await desativarPush(sub.endpoint);
        await sub.unsubscribe();
      }
      setLigado(false);
    } catch {
      setMsg('Não foi possível desativar os avisos neste aparelho.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-1">
      {ligado ? (
        <button type="button" className="btn" onClick={desativar} disabled={ocupado}>Desativar avisos neste aparelho</button>
      ) : (
        <button type="button" className="btn-primary" onClick={ativar} disabled={ocupado}>Ativar avisos neste aparelho</button>
      )}
      {msg && <p className="text-xs text-red-600">{msg}</p>}
    </div>
  );
}

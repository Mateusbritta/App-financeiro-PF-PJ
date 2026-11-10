'use client';

import { useEffect, useRef, useState } from 'react';
import type { DecodeHintType as Dica } from '@zxing/library';
import { codigoParaLinha } from '@/lib/boleto';

/**
 * Abre a câmera traseira, lê o código de barras do boleto e devolve a linha digitável.
 * A leitura acontece no próprio aparelho: nenhuma imagem é enviada ou guardada.
 */
export default function EscanearBoleto({ onLido }: { onLido: (linha: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const aoLer = useRef(onLido);
  useEffect(() => {
    aoLer.current = onLido;
  });

  function abrir() {
    setErro('');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setErro('A câmera só funciona com o app aberto em endereço seguro (https). Digite ou cole a linha.');
      return;
    }
    setAberto(true);
  }

  useEffect(() => {
    if (!aberto || !video.current) return;
    let controles: { stop: () => void } | undefined;
    let fechado = false;
    (async () => {
      try {
        // a biblioteca só é baixada quando alguém abre a câmera
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ]);
        // só o código de barras de boleto (ITF com 44 números): QR Codes e outros códigos são ignorados
        const dicas = new Map<Dica, unknown>([
          [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.ITF]],
          [DecodeHintType.ALLOWED_LENGTHS, [44]],
          [DecodeHintType.TRY_HARDER, true],
        ]);
        const c = await new BrowserMultiFormatReader(dicas).decodeFromConstraints(
          { video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } },
          video.current!,
          (resultado, _erro, ctrl) => {
            const linha = resultado ? codigoParaLinha(resultado.getText()) : null;
            if (!linha) return; // leitura incompleta ou errada: continua tentando
            ctrl.stop();
            navigator.vibrate?.(80);
            aoLer.current(linha);
            setAberto(false);
          },
        );
        if (fechado) c.stop();
        else controles = c;
      } catch (e) {
        const nome = (e as Error).name;
        setErro(
          nome === 'NotAllowedError'
            ? 'Permissão da câmera negada. Libere a câmera para este site nas configurações do navegador.'
            : nome === 'NotFoundError' || nome === 'OverconstrainedError'
              ? 'Nenhuma câmera encontrada neste aparelho.'
              : 'Não foi possível abrir a câmera.',
        );
        setAberto(false);
      }
    })();
    // fechar a janela (ou sair da tela) desliga a câmera
    return () => {
      fechado = true;
      controles?.stop();
    };
  }, [aberto]);

  return (
    <>
      <button type="button" className="btn btn-sm mt-2" onClick={abrir}>
        Escanear com a câmera
      </button>
      {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
      {aberto && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/90 p-4" role="dialog" aria-modal="true" aria-label="Escanear código de barras">
          <div className="relative w-full max-w-lg overflow-hidden rounded-xl bg-black">
            <video ref={video} className="w-full" playsInline muted />
            {/* borda verde e o resto escurecido: o retângulo aparece mesmo sobre o papel branco do boleto */}
            <div className="pointer-events-none absolute inset-x-4 top-1/2 h-1/3 -translate-y-1/2 rounded-lg border-2 border-brand-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
          </div>
          <p className="max-w-sm text-center text-sm text-white">
            Deite o celular e enquadre o código de barras dentro do retângulo. A leitura é feita no aparelho; nenhuma imagem é enviada.
          </p>
          <button type="button" className="btn" onClick={() => setAberto(false)}>
            Cancelar
          </button>
        </div>
      )}
    </>
  );
}

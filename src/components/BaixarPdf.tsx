'use client';

import { useState } from 'react';
import type { DadosRelatorio } from '@/lib/relatorioPdf';

function baixar(arquivo: File) {
  const url = URL.createObjectURL(arquivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = arquivo.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Gera o PDF do relatório no aparelho. No celular abre o menu de compartilhar (salvar em Arquivos, imprimir, WhatsApp);
 * no computador baixa o arquivo.
 */
export default function BaixarPdf({ dados, nomeArquivo }: { dados: DadosRelatorio; nomeArquivo: string }) {
  const [gerando, setGerando] = useState(false);
  const [pronto, setPronto] = useState<File | null>(null);
  const [erro, setErro] = useState('');

  async function gerar() {
    setErro('');
    setGerando(true);
    try {
      const { gerarRelatorioPdf } = await import('@/lib/relatorioPdf');
      const bytes = await gerarRelatorioPdf(dados);
      const arquivo = new File([bytes as Uint8Array<ArrayBuffer>], nomeArquivo, { type: 'application/pdf' });
      const celular = window.matchMedia('(pointer: coarse)').matches;
      // o menu de compartilhar só abre com um toque recente: depois de gerar, pede um segundo toque
      if (celular && navigator.canShare?.({ files: [arquivo] })) setPronto(arquivo);
      else baixar(arquivo);
    } catch {
      setErro('Não foi possível gerar o PDF.');
    } finally {
      setGerando(false);
    }
  }

  async function compartilhar() {
    if (!pronto) return;
    try {
      await navigator.share({ files: [pronto], title: pronto.name });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') baixar(pronto);
    }
    setPronto(null);
  }

  return (
    <span className="inline-flex flex-col print:hidden">
      {pronto ? (
        <button type="button" className="btn-primary" onClick={compartilhar}>
          PDF pronto: salvar ou compartilhar
        </button>
      ) : (
        <button type="button" className="btn" onClick={gerar} disabled={gerando}>
          {gerando ? 'Gerando PDF…' : 'Baixar PDF'}
        </button>
      )}
      {erro && <span className="mt-1 text-xs text-red-600">{erro}</span>}
    </span>
  );
}

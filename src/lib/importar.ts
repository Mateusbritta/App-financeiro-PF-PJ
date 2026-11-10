import { semAcento } from './categorize';
import { parseMoney } from './format';

export type LinhaImportada = { data: string; descricao: string; valor: number };

/** Decodifica o arquivo: tenta UTF-8 e, se houver caracteres inválidos, usa Windows-1252 (comum em OFX de bancos). */
export function decodificar(buf: ArrayBuffer) {
  const utf8 = new TextDecoder('utf-8').decode(buf);
  if (!utf8.includes('�')) return utf8;
  return new TextDecoder('windows-1252').decode(buf);
}

function dataISO(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{2})[\/.-](\d{2})[\/.-](\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = t.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

export function lerOFX(texto: string): LinhaImportada[] {
  const saida: LinhaImportada[] = [];
  const blocos = texto.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>|$)/gi) ?? [];
  for (const b of blocos) {
    const dt = b.match(/<DTPOSTED>\s*([0-9]{8})/i)?.[1];
    const amt = b.match(/<TRNAMT>\s*([-+0-9.,]+)/i)?.[1];
    const memo = b.match(/<MEMO>\s*([^<\r\n]*)/i)?.[1] ?? b.match(/<NAME>\s*([^<\r\n]*)/i)?.[1] ?? '';
    const data = dt ? dataISO(dt) : null;
    const valor = amt ? parseMoney(amt) : NaN;
    if (data && Number.isFinite(valor) && valor !== 0) {
      saida.push({ data, descricao: memo.trim() || 'Sem descrição', valor });
    }
  }
  return saida;
}

function dividirCSV(linha: string, sep: string) {
  const campos: string[] = [];
  let atual = '';
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (aspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else aspas = !aspas;
    } else if (c === sep && !aspas) {
      campos.push(atual);
      atual = '';
    } else atual += c;
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

export function lerCSV(texto: string): LinhaImportada[] {
  const linhas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!linhas.length) return [];
  const sep = (linhas[0].match(/;/g)?.length ?? 0) >= (linhas[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const cab = dividirCSV(linhas[0], sep).map(semAcento);
  const temCab = cab.some((c) => /data|date|valor|amount|descri|historico|memo/.test(c));
  const achar = (re: RegExp, padrao: number) => {
    const i = cab.findIndex((c) => re.test(c));
    return temCab ? i : padrao;
  };
  const iData = achar(/data|date/, 0);
  const iDesc = achar(/descri|historico|memo|lancamento|estabelecimento/, 1);
  const iValor = achar(/valor|amount/, 2);
  if (iData < 0 || iDesc < 0 || iValor < 0) return [];

  const saida: LinhaImportada[] = [];
  for (const l of linhas.slice(temCab ? 1 : 0)) {
    const c = dividirCSV(l, sep);
    const data = dataISO(c[iData] ?? '');
    const valor = parseMoney(c[iValor] ?? '');
    if (data && Number.isFinite(valor) && valor !== 0) {
      saida.push({ data, descricao: (c[iDesc] ?? '').trim() || 'Sem descrição', valor });
    }
  }
  return saida;
}

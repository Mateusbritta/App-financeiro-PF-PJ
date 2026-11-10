import { hojeSP, somarDias } from './format';

export type BoletoLido = { valor: number | null; vencimento: string | null; tipo: 'bancario' | 'convenio' };

/**
 * Fator de vencimento: dias desde 07/10/1997. Em 22/02/2025 o contador chegou a 9999 e
 * recomeçou em 1000, então o mesmo número pode significar duas datas; usamos a mais próxima de hoje.
 */
function dataDoFator(fator: number): string | null {
  if (fator <= 0) return null;
  const antiga = somarDias('1997-10-07', fator);
  if (fator < 1000) return antiga;
  const nova = somarDias('2025-02-22', fator - 1000);
  const hoje = Date.parse(hojeSP());
  return Math.abs(Date.parse(antiga) - hoje) < Math.abs(Date.parse(nova) - hoje) ? antiga : nova;
}

/** Dígito módulo 10 (pesos 2 e 1 da direita para a esquerda), usado nos campos da linha digitável. */
function mod10(n: string) {
  let soma = 0;
  for (let i = n.length - 1, peso = 2; i >= 0; i--, peso = peso === 2 ? 1 : 2) {
    const p = Number(n[i]) * peso;
    soma += p > 9 ? p - 9 : p;
  }
  return (10 - (soma % 10)) % 10;
}

/** Resto da soma com pesos 2 a 9 (da direita para a esquerda) dividida por 11. */
function resto11(n: string) {
  let soma = 0;
  for (let i = n.length - 1, peso = 2; i >= 0; i--, peso = peso === 9 ? 2 : peso + 1) soma += Number(n[i]) * peso;
  return soma % 11;
}

/**
 * Converte o código de barras (44 números, o que a câmera lê) na linha digitável (47 ou 48 números, a que os bancos pedem).
 * Devolve null quando o dígito verificador geral não bate: a câmera leu errado.
 */
export function codigoParaLinha(entrada: string): string | null {
  const c = (entrada ?? '').replace(/\D/g, '');
  if (c.length !== 44) return null;
  const semDV = (pos: number) => c.slice(0, pos) + c.slice(pos + 1);

  if (c[0] === '8') {
    // convênio (água, luz, tributos): o 3º número diz se os dígitos são módulo 10 (6, 7) ou 11 (8, 9)
    if (!'6789'.includes(c[2])) return null;
    const dv = (n: string) => {
      if (c[2] === '6' || c[2] === '7') return mod10(n);
      const r = resto11(n);
      return r <= 1 ? 0 : 11 - r;
    };
    if (dv(semDV(3)) !== Number(c[3])) return null;
    return [0, 11, 22, 33].map((i) => c.slice(i, i + 11) + dv(c.slice(i, i + 11))).join('');
  }

  // boleto bancário: banco+moeda, DV geral, fator+valor e 25 números do "campo livre"
  const r = 11 - resto11(semDV(4));
  if ((r >= 10 ? 1 : r) !== Number(c[4])) return null;
  const livre = c.slice(19);
  const campo1 = c.slice(0, 4) + livre.slice(0, 5);
  const campo2 = livre.slice(5, 15);
  const campo3 = livre.slice(15, 25);
  return `${campo1}${mod10(campo1)}${campo2}${mod10(campo2)}${campo3}${mod10(campo3)}${c[4]}${c.slice(5, 19)}`;
}

/** Lê valor e vencimento de uma linha digitável (47 dígitos de boleto bancário ou 48 de convênio). */
export function lerLinhaDigitavel(entrada: string): BoletoLido | null {
  const d = (entrada ?? '').replace(/\D/g, '');

  if (d.length === 47) {
    const fator = Number(d.slice(33, 37));
    const valor = Number(d.slice(37, 47)) / 100;
    return { tipo: 'bancario', valor: valor > 0 ? valor : null, vencimento: dataDoFator(fator) };
  }

  if (d.length === 48 && d[0] === '8') {
    // 4 blocos de 11 dígitos + 1 dígito verificador cada
    const codigo = [0, 12, 24, 36].map((i) => d.slice(i, i + 11)).join('');
    const identificadorValor = codigo[2];
    const valor = ['6', '7'].includes(identificadorValor) ? Number(codigo.slice(4, 15)) / 100 : null;
    return { tipo: 'convenio', valor: valor && valor > 0 ? valor : null, vencimento: null };
  }

  return null;
}

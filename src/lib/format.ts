export const brl = (n: number) =>
  Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Data de hoje (AAAA-MM-DD) no fuso de São Paulo. */
export const hojeSP = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

export const mesAtual = () => hojeSP().slice(0, 7);

export function normalizarMes(v?: string) {
  return /^\d{4}-\d{2}$/.test(v ?? '') ? (v as string) : mesAtual();
}

/** Início (inclusivo) e fim (exclusivo) de um mês AAAA-MM. */
export function faixaDoMes(mes: string) {
  const [y, m] = mes.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return { inicio: `${mes}-01`, fim: `${ny}-${String(nm).padStart(2, '0')}-01` };
}

export function nomeDoMes(mes: string) {
  const [y, m] = mes.split('-').map(Number);
  const nome = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

export function dataBR(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Diferença em dias (b - a) entre duas datas AAAA-MM-DD. */
export function diasEntre(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

/** Soma n dias a uma data AAAA-MM-DD. */
export function somarDias(iso: string, n: number) {
  return new Date(Date.parse(iso) + n * 86400000).toISOString().slice(0, 10);
}

/**
 * Soma n meses a uma data AAAA-MM-DD, ajustando o dia para o último do mês quando necessário.
 * `dia` é o dia desejado (ex.: 31), para que um vencimento ajustado em fevereiro volte ao 31 em março.
 */
export function somarMeses(iso: string, n: number, dia?: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const ultimo = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  const nd = Math.min(dia ?? d, ultimo);
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

/** Vencimento no sábado ou domingo pode ser pago na segunda-feira (feriados não considerados). */
export function vencimentoEfetivo(iso: string) {
  const dia = new Date(Date.parse(iso)).getUTCDay();
  return dia === 6 ? somarDias(iso, 2) : dia === 0 ? somarDias(iso, 1) : iso;
}

/** Converte "1.234,56", "45,90", "45.90" ou "1,234.56" em número. O separador decimal é o último que aparece. */
export function parseMoney(s: string) {
  let t = (s ?? '').toString().trim().replace(/[^\d,.\-]/g, '');
  if (!t) return NaN;
  if (t.lastIndexOf(',') > t.lastIndexOf('.')) t = t.replace(/\./g, '').replace(',', '.');
  else t = t.replace(/,/g, '');
  return Number.parseFloat(t);
}

export function soDigitos(s: string) {
  return (s ?? '').replace(/\D/g, '');
}

import { somarMeses, vencimentoEfetivo } from './format';

/**
 * ATENÇÃO: confira estes valores todo início de ano no Portal do Empreendedor (gov.br/mei).
 * O DAS é composto por 5% do salário mínimo (INSS) + R$ 1 (ICMS, comércio) e/ou R$ 5 (ISS, serviços).
 */
export const SALARIO_MINIMO = 1621;
export const LIMITE_MEI = 81000;

export type Atividade = 'comercio' | 'servico' | 'ambos';

export function valorDAS(atividade: Atividade) {
  const inss = SALARIO_MINIMO * 0.05;
  const adicional = atividade === 'comercio' ? 1 : atividade === 'servico' ? 5 : 6;
  return Math.round((inss + adicional) * 100) / 100;
}

/** Vencimento do DAS: dia 20; se cair no fim de semana, passa para a segunda-feira (feriados não considerados). */
export function vencimentoDAS(mes: string) {
  return vencimentoEfetivo(`${mes}-20`);
}

export function proximoVencimentoDAS(hoje: string) {
  const mesHoje = hoje.slice(0, 7);
  const dessemes = vencimentoDAS(mesHoje);
  if (dessemes >= hoje) return dessemes;
  return vencimentoDAS(somarMeses(`${mesHoje}-01`, 1).slice(0, 7));
}

/** Declaração anual (DASN-SIMEI): até 31 de maio do ano seguinte. */
export function prazoDASN(anoBase: number) {
  return `${anoBase + 1}-05-31`;
}

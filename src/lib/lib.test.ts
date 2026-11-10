import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { codigoParaLinha, lerLinhaDigitavel } from './boleto';
import { chaveDeAprendizado, sugerirCategoria } from './categorize';
import { vencimentoDAS } from './das';
import { parseMoney, somarMeses, vencimentoEfetivo } from './format';
import { lerCSV, lerOFX } from './importar';

// a leitura do fator de vencimento escolhe a data mais próxima de "hoje"
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-22T15:00:00Z'));
});
afterAll(() => vi.useRealTimers());

describe('parseMoney', () => {
  it.each([
    ['1.234,56', 1234.56],
    ['45,90', 45.9],
    ['45.90', 45.9],
    ['1,234.56', 1234.56],
    ['R$ -12,00', -12],
  ])('%s → %d', (entrada, esperado) => expect(parseMoney(entrada)).toBeCloseTo(esperado));
  it('vazio vira NaN', () => expect(parseMoney('')).toBeNaN());
});

describe('datas', () => {
  it('31/01 + 1 mês ajusta para o fim de fevereiro', () => expect(somarMeses('2026-01-31', 1)).toBe('2026-02-28'));
  it('recorrente do dia 31 volta ao 31 em março', () => expect(somarMeses('2026-02-28', 1, 31)).toBe('2026-03-31'));
  it('dezembro + 1 mês vira o ano', () => expect(somarMeses('2026-12-15', 1)).toBe('2027-01-15'));
  it('vencimento no fim de semana passa para segunda', () => {
    expect(vencimentoEfetivo('2026-09-19')).toBe('2026-09-21'); // sábado
    expect(vencimentoEfetivo('2026-09-20')).toBe('2026-09-21'); // domingo
    expect(vencimentoEfetivo('2026-09-18')).toBe('2026-09-18'); // sexta
  });
  it('DAS de setembro/2026 (dia 20 é domingo) vence na segunda', () => expect(vencimentoDAS('2026-09')).toBe('2026-09-21'));
});

describe('lerLinhaDigitavel', () => {
  it('boleto bancário depois da virada do fator (2025)', () => {
    const linha = '1'.repeat(33) + '1234' + '0000012345';
    expect(lerLinhaDigitavel(linha)).toEqual({ tipo: 'bancario', valor: 123.45, vencimento: '2025-10-14' });
  });
  it('fator 9999 é o último dia antes da virada', () => {
    const linha = '1'.repeat(33) + '9999' + '0000010000';
    expect(lerLinhaDigitavel(linha)?.vencimento).toBe('2025-02-21');
  });
  it('convênio com valor efetivo', () => {
    const codigo = '816' + '0' + '00000012345' + '0'.repeat(29); // 44 dígitos
    const linha = [0, 11, 22, 33].map((i) => codigo.slice(i, i + 11) + '0').join(''); // + 1 dígito verificador por bloco
    expect(lerLinhaDigitavel(linha)).toEqual({ tipo: 'convenio', valor: 123.45, vencimento: null });
  });
  it('tamanho errado não é boleto', () => expect(lerLinhaDigitavel('123')).toBeNull());
});

describe('codigoParaLinha (o que a câmera lê)', () => {
  // exemplo do Banco do Brasil: código de barras e a linha digitável impressa no mesmo boleto
  const BB_CODIGO = '00193373700000001000500940144816060680935031';
  const BB_LINHA = '00190500954014481606906809350314337370000000100';
  it('converte o código de barras de um boleto bancário real', () => expect(codigoParaLinha(BB_CODIGO)).toBe(BB_LINHA));
  it('a linha convertida tem o valor do boleto', () => expect(lerLinhaDigitavel(codigoParaLinha(BB_CODIGO)!)?.valor).toBe(1));
  it('recusa leitura com um número trocado (o dígito verificador não bate)', () => {
    const errado = BB_CODIGO.slice(0, 20) + ((Number(BB_CODIGO[20]) + 1) % 10) + BB_CODIGO.slice(21);
    expect(codigoParaLinha(errado)).toBeNull();
  });
  it('recusa leitura incompleta', () => expect(codigoParaLinha(BB_CODIGO.slice(0, 40))).toBeNull());
  it('convênio: acrescenta um dígito a cada bloco de 11 e mantém o valor', () => {
    const sem = '8260' + '00000012345' + '1'.repeat(29); // 4º número é o DV geral, calculado abaixo
    const codigo = [...'0123456789'].map((d) => sem.slice(0, 3) + d + sem.slice(4)).find((c) => codigoParaLinha(c))!;
    const linha = codigoParaLinha(codigo)!;
    expect(linha).toHaveLength(48);
    expect([0, 12, 24, 36].map((i) => linha.slice(i, i + 11)).join('')).toBe(codigo);
    expect(lerLinhaDigitavel(linha)?.valor).toBe(123.45);
  });
});

describe('importação', () => {
  it('CSV brasileiro com ponto e vírgula', () => {
    const csv = 'Data;Descrição;Valor\n01/10/2026;Mercado;-45,90\n02/10/2026;Salário;1.500,00\n';
    expect(lerCSV(csv)).toEqual([
      { data: '2026-10-01', descricao: 'Mercado', valor: -45.9 },
      { data: '2026-10-02', descricao: 'Salário', valor: 1500 },
    ]);
  });
  it('OFX', () => {
    const ofx = '<OFX><BANKTRANLIST><STMTTRN><DTPOSTED>20261005<TRNAMT>-30.50<MEMO>PADARIA</STMTTRN></BANKTRANLIST>';
    expect(lerOFX(ofx)).toEqual([{ data: '2026-10-05', descricao: 'PADARIA', valor: -30.5 }]);
  });
});

describe('categorização', () => {
  const categorias = [
    { id: 'alim', name: 'Alimentação', kind: 'despesa' },
    { id: 'mor', name: 'Moradia', kind: 'despesa' },
    { id: 'out', name: 'Outros', kind: 'despesa' },
  ];
  it('sugere pela palavra-chave padrão', () => expect(sugerirCategoria('Compra no Supermercado X', 'despesa', categorias, [])).toBe('alim'));
  it('regra aprendida tem prioridade', () =>
    expect(sugerirCategoria('maria silva aluguel', 'despesa', categorias, [{ keyword: 'maria silva', category_id: 'mor' }])).toBe('mor'));
  it('sem palavra-chave vai para Outros', () => expect(sugerirCategoria('xyz', 'despesa', categorias, [])).toBe('out'));
  it('a chave aprendida ignora o começo genérico do extrato', () => expect(chaveDeAprendizado('PIX ENVIADO MARIA SILVA')).toBe('maria silva'));
});

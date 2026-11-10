import type { Row } from './types';

export const semAcento = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Palavras-chave padrão por nome de categoria. Regras aprendidas pelo usuário têm prioridade. */
const PADROES: Record<string, string[]> = {
  Alimentação: ['mercado', 'supermercado', 'padaria', 'restaurante', 'ifood', 'lanche', 'acougue', 'feira', 'hortifruti', 'pizza', 'cafe'],
  Moradia: ['aluguel', 'condominio', 'iptu', 'reforma'],
  'Contas fixas': ['energia', 'luz', 'agua', 'internet', 'telefone', 'celular', 'gas', 'enel', 'cpfl', 'sabesp', 'vivo', 'claro', 'tim', 'copel', 'sanepar'],
  Transporte: ['uber', '99', 'combustivel', 'gasolina', 'posto', 'estacionamento', 'pedagio', 'onibus', 'metro'],
  Saúde: ['farmacia', 'medico', 'consulta', 'plano de saude', 'dentista', 'exame', 'drogaria'],
  Lazer: ['cinema', 'netflix', 'spotify', 'viagem', 'show', 'streaming', 'jogo', 'bar'],
  Educação: ['curso', 'escola', 'faculdade', 'livro', 'mensalidade'],
  Impostos: ['das', 'darf', 'imposto', 'inss', 'iss', 'simples nacional'],
  Fornecedores: ['fornecedor', 'materia prima', 'atacado', 'insumo'],
  Marketing: ['anuncio', 'meta ads', 'google ads', 'impulsionar', 'trafego'],
  Equipamentos: ['equipamento', 'notebook', 'maquina', 'ferramenta'],
  Vendas: ['venda', 'cliente', 'pix recebido', 'recebimento'],
  Salário: ['salario', 'pagamento', 'holerite'],
};

function contem(texto: string, chave: string) {
  const k = semAcento(chave);
  if (k.length <= 3) return new RegExp(`(^|[^a-z0-9])${k}([^a-z0-9]|$)`).test(texto);
  return texto.includes(k);
}

/** Retorna o id da categoria sugerida (ou a categoria "Outros" / "Outras receitas"). */
export function sugerirCategoria(
  descricao: string,
  tipo: 'receita' | 'despesa',
  categorias: Row[],
  regras: Row[],
): string | null {
  const texto = semAcento(descricao);
  const doTipo = categorias.filter((c) => c.kind === tipo);

  for (const r of regras) {
    if (contem(texto, r.keyword) && doTipo.some((c) => c.id === r.category_id)) return r.category_id;
  }
  for (const c of doTipo) {
    const chaves = PADROES[c.name];
    if (chaves?.some((k) => contem(texto, k))) return c.id;
  }
  const padrao = tipo === 'despesa' ? 'Outros' : 'Outras receitas';
  return doTipo.find((c) => c.name === padrao)?.id ?? null;
}

/** Palavras que os bancos põem no começo de quase toda linha do extrato: não dizem nada sobre a categoria. */
const GENERICAS = new Set([
  'pix', 'enviado', 'recebido', 'compra', 'cartao', 'debito', 'credito', 'pagamento', 'pgto',
  'transferencia', 'ted', 'doc', 'boleto',
]);

/** Palavra-chave usada para aprender com a correção do usuário (duas primeiras palavras que não sejam genéricas). */
export function chaveDeAprendizado(descricao: string) {
  const palavras = semAcento(descricao)
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((p) => p && !GENERICAS.has(p));
  const chave = palavras.slice(0, 2).join(' ');
  return chave.length >= 3 ? chave : null;
}

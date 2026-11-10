import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { PDFArray, PDFDocument, type PDFRawStream } from 'pdf-lib';
import { gerarRelatorioPdf, type DadosRelatorio } from './relatorioPdf';

/** Comandos de desenho da página (o PDF guarda compactado). */
function comandos(pdf: PDFDocument, pagina: number) {
  const c = pdf.getPage(pagina).node.Contents();
  const partes = c instanceof PDFArray ? c.asArray().map((r) => pdf.context.lookup(r)) : [c];
  return partes
    .map((s) => {
      const b = Buffer.from((s as PDFRawStream).getContents());
      try {
        return zlib.inflateSync(b).toString('latin1');
      } catch {
        return b.toString('latin1');
      }
    })
    .join('\n');
}

const base: DadosRelatorio = {
  espaco: 'Finanças pessoais',
  titulo: 'Outubro de 2026',
  mei: false,
  despesas: [
    { name: 'Moradia', value: 1763, color: '#6366f1' },
    { name: 'Alimentação', value: 550, color: '#f97316' },
  ],
  receitas: [{ name: 'Salário', value: 7100, color: '#10b981' }],
  vendas: [],
};
const abrir = async (d: DadosRelatorio) => PDFDocument.load(await gerarRelatorioPdf(d));

describe('gerarRelatorioPdf', () => {
  it('gera um PDF de uma página A4 com acentos', async () => {
    const pdf = await abrir(base);
    expect(pdf.getPageCount()).toBe(1);
    expect(Math.round(pdf.getPage(0).getWidth())).toBe(595);
    expect(pdf.getTitle()).toContain('Relatório de Outubro de 2026');
  });

  it('desenha cada fatia do gráfico de pizza, com a cor da categoria, dentro do arquivo', async () => {
    const ops = comandos(await abrir(base), 0);
    // cor de preenchimento da fatia ("rg") e, logo depois, as curvas do arco ("c")
    for (const corDaFatia of ['0.38823529411764707 0.4 0.9450980392156862 rg', '0.9764705882352941 0.45098039215686275 0.08627450980392157 rg']) {
      const i = ops.indexOf(corDaFatia);
      expect(i).toBeGreaterThan(-1);
      expect(ops.slice(i, i + 400)).toMatch(/ c\n/);
    }
  });

  it('não quebra com emoji no nome da categoria, uma categoria só ou mês vazio', async () => {
    await expect(abrir({ ...base, despesas: [{ name: 'Lazer 🎉', value: 10, color: '#ec4899' }] })).resolves.toBeDefined();
    await expect(abrir({ ...base, despesas: [], receitas: [] })).resolves.toBeDefined();
    await expect(abrir({ ...base, despesas: [{ name: 'X', value: 5, color: 'cor-invalida' }] })).resolves.toBeDefined();
  });

  it('MEI com muitas vendas continua em outras páginas', async () => {
    const vendas = Array.from({ length: 120 }, (_, i) => ({ data: '05/10/2026', descricao: `Venda ${i + 1} para cliente com nome bem comprido que não cabe na linha`, valor: 100 + i }));
    const pdf = await abrir({ ...base, mei: true, vendas });
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });
});

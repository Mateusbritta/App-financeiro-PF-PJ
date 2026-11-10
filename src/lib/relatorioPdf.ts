import type { PDFFont, PDFPage, RGB } from 'pdf-lib';
import { brl, dataBR, hojeSP } from './format';

export type Fatia = { name: string; value: number; color: string };
export type DadosRelatorio = {
  espaco: string;
  titulo: string; // ex.: "Outubro de 2026"
  mei: boolean;
  despesas: Fatia[];
  receitas: Fatia[];
  vendas: { data: string; descricao: string; valor: number }[];
};

const LARGURA = 595.28; // A4 em pontos
const ALTURA = 841.89;
const MARGEM = 40;

/** As fontes padrão do PDF só têm o alfabeto latino: tira o que não dá para escrever (ex.: emoji no nome de uma categoria). */
const limpa = (s: string) => s.replace(/[  ]/g, ' ').replace(/[^\x20-\x7E\xA0-\xFF]/g, '').trim();

/**
 * Monta o PDF do relatório do mês com o gráfico de pizza desenhado no próprio arquivo.
 * Feito no aparelho: funciona também no app instalado no iPhone, onde o "imprimir" do navegador não abre.
 */
export async function gerarRelatorioPdf(d: DadosRelatorio): Promise<Uint8Array> {
  // a biblioteca só é baixada quando alguém pede o PDF
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  doc.setTitle(limpa(`Relatório de ${d.titulo} - ${d.espaco}`));
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);

  const CINZA = rgb(0.39, 0.45, 0.55);
  const ESCURO = rgb(0.12, 0.16, 0.23);
  const VERDE = rgb(0.02, 0.47, 0.34);
  const VERMELHO = rgb(0.86, 0.15, 0.15);
  const BRANCO = rgb(1, 1, 1);
  const cor = (hex: string): RGB => {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    return m ? rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255) : CINZA;
  };

  let pagina: PDFPage = doc.addPage([LARGURA, ALTURA]);
  let y = ALTURA - MARGEM;
  const espaco = (altura: number) => {
    if (y - altura < MARGEM + 24) {
      pagina = doc.addPage([LARGURA, ALTURA]);
      y = ALTURA - MARGEM;
    }
  };
  const escrever = (s: string, x: number, tamanho: number, fonte: PDFFont = normal, c: RGB = ESCURO) =>
    pagina.drawText(limpa(s), { x, y, size: tamanho, font: fonte, color: c });
  const escreverDireita = (s: string, xFim: number, tamanho: number, fonte: PDFFont = normal, c: RGB = ESCURO) => {
    const t = limpa(s);
    pagina.drawText(t, { x: xFim - fonte.widthOfTextAtSize(t, tamanho), y, size: tamanho, font: fonte, color: c });
  };
  const caber = (s: string, largura: number, tamanho: number) => {
    let t = limpa(s);
    if (normal.widthOfTextAtSize(t, tamanho) <= largura) return t;
    while (t && normal.widthOfTextAtSize(`${t}...`, tamanho) > largura) t = t.slice(0, -1);
    return `${t}...`;
  };
  const secao = (titulo: string) => {
    espaco(40);
    y -= 8;
    escrever(titulo, MARGEM, 12, negrito);
    y -= 20;
  };

  // título e totais
  escrever(`Relatório de ${d.titulo}`, MARGEM, 18, negrito);
  y -= 20;
  escrever(d.espaco, MARGEM, 11, normal, CINZA);
  y -= 34;
  const totalRec = d.receitas.reduce((s, f) => s + f.value, 0);
  const totalDesp = d.despesas.reduce((s, f) => s + f.value, 0);
  const resultado = totalRec - totalDesp;
  const colunas: [string, number, RGB][] = [
    ['Receitas', totalRec, VERDE],
    ['Despesas', totalDesp, VERMELHO],
    ['Resultado', resultado, resultado >= 0 ? VERDE : VERMELHO],
  ];
  colunas.forEach(([rotulo], i) => escrever(rotulo, MARGEM + i * 175, 9, normal, CINZA));
  y -= 18;
  colunas.forEach(([, valor, c], i) => escrever(brl(valor), MARGEM + i * 175, 15, negrito, c));
  y -= 22;

  // gráfico de pizza das despesas, desenhado como vetor (sai em qualquer leitor ou impressora)
  secao('Despesas por categoria');
  if (!totalDesp) {
    escrever('Sem despesas no mês.', MARGEM, 10, normal, CINZA);
    y -= 16;
  } else {
    espaco(160);
    const raio = 70;
    const cx = MARGEM + raio;
    const cy = y - raio;
    let inicio = -Math.PI / 2; // começa no topo e gira no sentido do relógio
    for (const f of d.despesas) {
      const fracao = f.value / totalDesp;
      if (fracao <= 0) continue;
      if (fracao > 0.9999) {
        pagina.drawCircle({ x: cx, y: cy, size: raio, color: cor(f.color) });
        break;
      }
      const fim = inicio + fracao * 2 * Math.PI;
      // caminho em coordenadas de SVG (y para baixo) a partir do centro
      const ponto = (a: number) => `${(raio * Math.cos(a)).toFixed(2)} ${(raio * Math.sin(a)).toFixed(2)}`;
      const caminho = `M 0 0 L ${ponto(inicio)} A ${raio} ${raio} 0 ${fracao > 0.5 ? 1 : 0} 1 ${ponto(fim)} Z`;
      pagina.drawSvgPath(caminho, { x: cx, y: cy, color: cor(f.color), borderColor: BRANCO, borderWidth: 1 });
      inicio = fim;
    }
    pagina.drawCircle({ x: cx, y: cy, size: raio * 0.56, color: BRANCO });

    // legenda ao lado do gráfico
    const xLegenda = MARGEM + 2 * raio + 30;
    const topo = y;
    y -= 10;
    for (const f of d.despesas) {
      espaco(16);
      pagina.drawRectangle({ x: xLegenda, y: y - 1, width: 9, height: 9, color: cor(f.color) });
      escrever(caber(f.name, 170, 10), xLegenda + 16, 10);
      escreverDireita(brl(f.value), LARGURA - MARGEM - 45, 10);
      escreverDireita(`${Math.round((f.value / totalDesp) * 100)}%`, LARGURA - MARGEM, 10, normal, CINZA);
      y -= 16;
    }
    y = Math.min(y, topo - 2 * raio) - 16;
  }

  secao('Receitas por categoria');
  if (!d.receitas.length) {
    escrever('Sem receitas no mês.', MARGEM, 10, normal, CINZA);
    y -= 16;
  }
  for (const f of d.receitas) {
    espaco(16);
    escrever(caber(f.name, 300, 10), MARGEM, 10);
    escreverDireita(brl(f.value), LARGURA - MARGEM - 45, 10);
    escreverDireita(`${Math.round((f.value / totalRec) * 100)}%`, LARGURA - MARGEM, 10, normal, CINZA);
    y -= 16;
  }

  if (d.mei) {
    secao('Relatório mensal de receitas brutas (vendas)');
    escrever(`Total de receitas brutas: ${brl(d.vendas.reduce((s, v) => s + v.valor, 0))}`, MARGEM, 10, negrito);
    y -= 18;
    if (!d.vendas.length) {
      escrever('Nenhuma venda registrada no mês.', MARGEM, 10, normal, CINZA);
      y -= 16;
    }
    for (const v of d.vendas) {
      espaco(15);
      escrever(v.data, MARGEM, 9);
      escrever(caber(v.descricao, 330, 9), MARGEM + 70, 9);
      escreverDireita(brl(v.valor), LARGURA - MARGEM, 9);
      y -= 15;
    }
  }

  // rodapé em todas as páginas
  const paginas = doc.getPages();
  paginas.forEach((p, i) => {
    p.drawText(limpa(`App Financeiro · gerado em ${dataBR(hojeSP())}`), { x: MARGEM, y: MARGEM - 10, size: 8, font: normal, color: CINZA });
    const n = `${i + 1}/${paginas.length}`;
    p.drawText(n, { x: LARGURA - MARGEM - normal.widthOfTextAtSize(n, 8), y: MARGEM - 10, size: 8, font: normal, color: CINZA });
  });

  return doc.save();
}

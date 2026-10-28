// Geração de Word (.docx) editável no navegador, no formato dos laudos da veterinária: logotipos no topo,
// faixas cinza, identificação em 3 colunas, texto justificado com destaques, conclusão em lista e imagens em grade.
import { dataUrlToBytes } from './utils.js';
import { parseRich, sectionRich, stripRich } from './richtext.js';

const PX_PER_MM = 96 / 25.4;
const CONTENT_MM = 180; // A4 com margens de 15 mm
const GRAY = '606060', BOX = 'F0F0F0';

export async function buildDocx(report, lib) {
  const d = lib || globalThis.docx;
  if (!d) throw new Error('Biblioteca docx não carregada.');
  const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle, Header, Footer,
    AlignmentType, PageNumber, TabStopType, ShadingType } = d;
  const font = report.font === 'serif' ? 'Times New Roman' : 'Arial';
  const size = report.fontSize * 2; // meios-pontos
  const run = (text, o = {}) => new TextRun({ text, font, size, ...o });
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
  const thin = { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' };
  const richRuns = (text, o = {}) => parseRich(text).map((r) => run(r.text, { ...o, bold: r.bold || o.bold, italics: r.italic || o.italics }));
  const shade = (fill) => ({ type: ShadingType.CLEAR, fill, color: 'auto' });

  async function logoRun(url, heightMm, maxWmm = 70) {
    const dim = await imageSize(url);
    let h = Math.round(heightMm * PX_PER_MM), w = Math.round(h * dim.w / dim.h);
    const maxW = Math.round(maxWmm * PX_PER_MM);
    if (w > maxW) { w = maxW; h = Math.round(w * dim.h / dim.w); }
    return new ImageRun({ data: dataUrlToBytes(url), transformation: { width: w, height: h } });
  }
  async function logosTable(heightMm) {
    // Um logotipo só: centralizado e maior. Dois: um de cada lado.
    const only = [report.logo, report.logo2].filter(Boolean);
    if (only.length === 1) {
      try { return new Paragraph({ alignment: AlignmentType.CENTER, children: [await logoRun(only[0], heightMm * 1.4, 95)] }); } catch { return new Paragraph(''); }
    }
    const cell = async (url, right) => {
      let kids = [new Paragraph('')];
      if (url) { try { kids = [new Paragraph({ alignment: right ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [await logoRun(url, heightMm)] })]; } catch { /* logotipo inválido */ } }
      return new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: noBorders, children: kids });
    };
    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, rows: [new TableRow({ children: [await cell(report.logo, false), await cell(report.logo2, true)] })] });
  }

  // Cabeçalho: logotipos só na primeira página; nas seguintes, uma linha de identificação.
  const hasLogos = !!(report.logo || report.logo2);
  const firstHeader = new Header({ children: hasLogos ? [await logosTable(18)] : report.headerLines.length ? report.headerLines.map((l) => new Paragraph({ children: [run(l, { size: 18, color: '444444' })] })) : [new Paragraph('')] });
  const nextHeader = new Header({ children: [new Paragraph({ children: [run([report.idShort, report.dateText, report.title].filter(Boolean).join(' — '), { size: 15, color: '777777' })] })] });

  const footer = new Footer({
    children: [new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: 10206 }],
      border: { top: thin },
      children: [
        run(report.footerText || '', { size: 16, color: '666666' }),
        new TextRun({ children: ['\tPágina ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], font, size: 16, color: '666666' }),
      ],
    })],
  });

  const banner = (text) => new Paragraph({ keepNext: true, shading: shade(GRAY), spacing: { before: 160, after: 120 }, indent: { left: 60, right: 60 },
    children: [run(` ${text}`, { bold: true, color: 'FFFFFF', size: size + 2 })] });
  const body = [];

  // Identificação em 3 colunas
  if (report.patientRows.length) {
    body.push(banner('Identificação'));
    const rows = [];
    for (let i = 0; i < report.patientRows.length; i += 3) {
      const trio = report.patientRows.slice(i, i + 3);
      while (trio.length < 3) trio.push(['', '']);
      rows.push(new TableRow({
        cantSplit: true,
        children: trio.map(([k, v]) => new TableCell({
          width: { size: 100 / 3, type: WidthType.PERCENTAGE }, borders: noBorders, shading: shade(BOX),
          margins: { top: 50, bottom: 50, left: 100, right: 60 },
          children: [new Paragraph({ children: k ? [run(`${k}: `, { bold: true, size: size - 1 }), run(v, { size: size - 1 })] : [run('')] })],
        })),
      }));
    }
    body.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, rows }));
  }

  body.push(banner(report.title));
  if (report.statusNote) body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [run(report.statusNote, { bold: true, color: 'B43C00' })] }));

  const justified = (text, o = {}) => new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 140 }, ...o, children: richRuns(text) });
  for (const b of report.blocks) {
    if (b.kind === 'h') body.push(banner(b.text));
    else if (b.kind === 'p') body.push(...String(b.text).split(/\r?\n/).map((ln) => justified(ln)));
    else if (b.kind === 'kv') body.push(justified(`**${b.label}**: ${b.text}`));
    else if (b.kind === 'section') body.push(justified(sectionRich(b), { keepLines: true }));
    else if (b.kind === 'list') for (const it of b.items) body.push(new Paragraph({ indent: { left: 360, hanging: 240 }, spacing: { after: 40 }, children: [run('•  '), run(stripRich(it), { bold: true })] }));
    else if (b.kind === 'note') body.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { before: 160, after: 140 }, children: [run(stripRich(b.text), { italics: true, size: size - 3, color: '555555' })] }));
  }

  const imgs = report.images.items;
  if (imgs.length) {
    body.push(banner('Imagens'));
    const n = report.images.perRow;
    const cellMm = (CONTENT_MM - 2 * (n - 1)) / n - 2;
    const rows = [];
    for (let i = 0; i < imgs.length; i += n) {
      const cells = [];
      for (let j = 0; j < n; j++) {
        const im = imgs[i + j];
        if (!im) { cells.push(new TableCell({ borders: noBorders, children: [new Paragraph('')] })); continue; }
        let wMm = cellMm * Math.min(1, Math.max(0.3, im.scale));
        let hMm = wMm * im.h / im.w;
        const maxH = 200;
        if (hMm > maxH) { hMm = maxH; wMm = hMm * im.w / im.h; }
        const kids = [new Paragraph({ alignment: AlignmentType.CENTER, keepNext: !!im.caption, keepLines: true,
          children: [new ImageRun({ data: dataUrlToBytes(im.dataUrl), transformation: { width: Math.round(wMm * PX_PER_MM), height: Math.round(hMm * PX_PER_MM) } })] })];
        if (im.caption) kids.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [run(stripRich(im.caption), { italics: true, size: size - 4, color: '444444' })] }));
        cells.push(new TableCell({ width: { size: 100 / n, type: WidthType.PERCENTAGE }, borders: noBorders, margins: { left: 30, right: 30 }, children: kids }));
      }
      rows.push(new TableRow({ cantSplit: true, children: cells }));
    }
    body.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, rows }));
  }

  if (report.signature) {
    const sg = report.signature, final = !!sg.stamp;
    if (hasLogos) body.push(new Paragraph({ spacing: { before: 240 }, keepNext: true, children: [] }), await logosTable(14));
    const lines = final
      ? [[run('Assinado eletronicamente por: ', { bold: true }), run(sg.name || '(nome não informado)')], sg.crmv && [run(sg.crmv, { bold: true })], [run(`Código identificador: ${sg.code}`)], [run(sg.stamp, { size: size - 4, color: '555555' })]]
      : [[run('Documento não finalizado: sem assinatura eletrônica.', { bold: true })], sg.name && [run(`Responsável: ${sg.name}${sg.crmv ? ' — ' + sg.crmv : ''}`)], [run(`Código identificador: ${sg.code}`)]];
    body.push(new Paragraph({ spacing: { before: 200 }, children: [] }));
    if (sg.image) { try { body.push(new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, children: [await logoRun(sg.image, 18)] })); } catch { /* imagem inválida */ } }
    if (final) {
      // Assinatura no estilo clássico: linha, nome e CRMV centralizados; dados de verificação menores.
      const c = (children, extra = {}) => new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { after: 20 }, children, ...extra });
      body.push(c([run(sg.name || '(nome não informado)', { bold: true, size: size + 1 })], { border: { top: { style: BorderStyle.SINGLE, size: 6, color: '777777', space: 4 } }, indent: { left: 2600, right: 2600 } }));
      if (sg.crmv) body.push(c([run(sg.crmv)]));
      body.push(c([run(`Assinado eletronicamente · Código identificador: ${sg.code}`, { size: size - 5, color: '555555' })], { spacing: { before: 60, after: 20 } }));
      body.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [run(sg.stamp, { size: size - 5, color: '666666' })] }));
    } else {
      body.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, rows: [new TableRow({ cantSplit: true, children: [new TableCell({
        borders: noBorders, shading: shade(BOX), margins: { top: 100, bottom: 100, left: 160, right: 160 },
        children: lines.filter(Boolean).map((children) => new Paragraph({ keepNext: true, spacing: { after: 20 }, children })),
      })] })] }));
    }
  }

  // O Word grava a data de criação nos dados internos do arquivo: usa a data do exame (nunca o dia em que o laudo foi feito).
  const RealDate = Date, day = (() => { const d = report.fileDate ? new RealDate(`${report.fileDate}T00:00:00`) : new RealDate(2000, 0, 1); return isNaN(d) ? new RealDate(2000, 0, 1) : d; })();
  globalThis.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(day.getTime()); } };
  let doc;
  try {
    doc = new Document({
      creator: 'VetLaudo', title: report.title,
      styles: { default: { document: { run: { font, size } } } },
      sections: [{
        properties: { titlePage: true, page: { size: { width: 11906, height: 16838 }, margin: { top: 850, bottom: 850, left: 850, right: 850, header: 450, footer: 450 } } },
        headers: { first: firstHeader, default: nextHeader }, footers: { first: footer, default: footer }, children: body,
      }],
    });
  } finally { globalThis.Date = RealDate; }
  return Packer.toBlob ? Packer.toBlob(doc) : Packer.toBuffer(doc);
}

function imageSize(dataUrl) {
  if (typeof Image === 'undefined') return Promise.resolve({ w: 3, h: 1 });
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

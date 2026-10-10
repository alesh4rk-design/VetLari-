// Geração de Word (.docx) editável no navegador com a biblioteca docx.
import { dataUrlToBytes } from './utils.js';

const PX_PER_MM = 96 / 25.4;
const CONTENT_MM = 170; // A4 com margens de 20 mm

export async function buildDocx(report, lib) {
  const d = lib || globalThis.docx;
  if (!d) throw new Error('Biblioteca docx não carregada.');
  const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle,
    Header, Footer, AlignmentType, PageNumber, TabStopType } = d;
  const font = report.font === 'serif' ? 'Times New Roman' : 'Arial';
  const size = report.fontSize * 2; // meios-pontos
  const run = (text, o = {}) => new TextRun({ text, font, size, ...o });
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
  const thin = { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' };

  // Cabeçalho
  const headerChildren = [];
  if (report.logo) {
    try {
      const bytes = dataUrlToBytes(report.logo);
      const dim = await imageSize(report.logo);
      const h = 55, w = Math.min(150, Math.round(h * dim.w / dim.h));
      headerChildren.push(new Paragraph({ children: [new ImageRun({ data: bytes, transformation: { width: w, height: h } })] }));
    } catch { /* logotipo inválido: segue sem ele */ }
  }
  for (const line of report.headerLines) headerChildren.push(new Paragraph({ children: [run(line, { size: 18, color: '444444' })] }));
  const header = new Header({ children: headerChildren.length ? headerChildren : [new Paragraph('')] });

  const footer = new Footer({
    children: [new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: 9638 }],
      border: { top: thin },
      children: [
        run(report.footerText || '', { size: 16, color: '666666' }),
        new TextRun({ children: ['\tPágina ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], font, size: 16, color: '666666' }),
      ],
    })],
  });

  const body = [];
  body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 200 },
    children: [run(report.title.toUpperCase(), { bold: true, size: size + 6 })] }));

  if (report.patientRows.length) {
    const rows = [];
    for (let i = 0; i < report.patientRows.length; i += 2) {
      const pair = report.patientRows.slice(i, i + 2);
      while (pair.length < 2) pair.push(['', '']);
      rows.push(new TableRow({
        cantSplit: true,
        children: pair.map(([k, v]) => new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          borders: { top: none, left: none, right: none, bottom: thin },
          margins: { top: 40, bottom: 40, left: 60, right: 60 },
          children: [new Paragraph({ children: k ? [run(`${k}: `, { bold: true, size: size - 2 }), run(v, { size: size - 2 })] : [run('')] })],
        })),
      }));
    }
    body.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, rows }));
    body.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
  }

  for (const b of report.blocks) {
    if (b.kind === 'h') body.push(new Paragraph({ keepNext: true, spacing: { before: 200, after: 80 }, children: [run(b.text, { bold: true, size: size + 2 })] }));
    else if (b.kind === 'p') body.push(...lines(b.text, { spacing: { after: 120 } }));
    else if (b.kind === 'kv') body.push(new Paragraph({ spacing: { after: 60 }, children: [run(`${b.label}: `, { bold: true }), run(b.text)] }));
    else if (b.kind === 'section') {
      body.push(new Paragraph({ keepNext: true, spacing: { before: 160, after: 40 }, children: [run(b.title, { bold: true })] }));
      for (const it of b.items) {
        if (it.label) body.push(new Paragraph({ spacing: { after: 60 }, children: [run(`${it.label}: `, { bold: true }), run(it.text)] }));
        else body.push(...lines(it.text, { spacing: { after: 60 } }));
      }
    }
  }

  const imgs = report.images.items;
  if (imgs.length) {
    body.push(new Paragraph({ keepNext: true, spacing: { before: 240, after: 120 }, children: [run('Imagens', { bold: true, size: size + 2 })] }));
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
          children: [new ImageRun({ data: dataUrlToBytes(im.dataUrl),
            transformation: { width: Math.round(wMm * PX_PER_MM), height: Math.round(hMm * PX_PER_MM) } })] })];
        if (im.caption) kids.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
          children: [run(im.caption, { italics: true, size: size - 4, color: '444444' })] }));
        cells.push(new TableCell({ width: { size: 100 / n, type: WidthType.PERCENTAGE }, borders: noBorders, children: kids }));
      }
      rows.push(new TableRow({ cantSplit: true, children: cells }));
    }
    body.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, rows }));
  }

  if (report.signature) {
    body.push(new Paragraph({ spacing: { before: 700 }, alignment: AlignmentType.CENTER, keepNext: true,
      children: [run('______________________________________')] }));
    const l = [report.signature.name, report.signature.crmv].filter(Boolean);
    if (!l.length) l.push('Assinatura do médico-veterinário');
    l.forEach((t, k) => body.push(new Paragraph({ alignment: AlignmentType.CENTER, keepNext: k < l.length - 1, children: [run(t)] })));
  }

  const doc = new Document({
    creator: 'VetLaudo', title: report.title,
    styles: { default: { document: { run: { font, size } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134, header: 567, footer: 567 } } },
      headers: { default: header }, footers: { default: footer }, children: body,
    }],
  });
  return Packer.toBlob ? Packer.toBlob(doc) : Packer.toBuffer(doc);

  function lines(text, opts) {
    return String(text).split(/\r?\n/).map((ln) => new Paragraph({ ...opts, children: [run(ln)] }));
  }
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

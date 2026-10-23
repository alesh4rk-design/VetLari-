// Geração de PDF no navegador com jsPDF, no formato dos laudos da veterinária: logotipos no topo, faixas
// cinza (Identificação, título, Impressão Diagnóstica, Imagens), identificação em 3 colunas, texto
// justificado com nome do órgão em negrito na mesma linha, conclusão em lista e imagens em grade.
// Texto selecionável; imagens embutidas; paginação controlada.
import { parseRich, toWords, sectionRich, stripRich } from './richtext.js';

const PAGE_W = 210, PAGE_H = 297, MARGIN = 15, CONTENT_W = PAGE_W - 2 * MARGIN, BOTTOM = PAGE_H - 18;
const GRAY = [96, 96, 96], BOX = [240, 240, 240];

export function buildPdf(report, jsPDFCtor) {
  const JsPDF = jsPDFCtor || (globalThis.jspdf && globalThis.jspdf.jsPDF);
  if (!JsPDF) throw new Error('Biblioteca jsPDF não carregada.');
  const doc = new JsPDF({ unit: 'mm', format: 'a4', compress: true });
  const family = report.font === 'serif' ? 'times' : 'helvetica';
  const fs = report.fontSize;
  const lh = (size) => size * 0.3528 * 1.38;
  const styleOf = (s) => (s.bold && s.italic ? 'bolditalic' : s.bold ? 'bold' : s.italic ? 'italic' : 'normal');
  let y = MARGIN;

  const width = (text, st, size) => { doc.setFont(family, st).setFontSize(size); return doc.getTextWidth(text); };
  const newPage = () => { doc.addPage(); y = MARGIN; };
  const ensure = (h) => { if (y + h > BOTTOM) newPage(); };

  /** Quebra o texto rico em linhas que cabem na largura. */
  function layout(text, w, size) {
    const words = toWords(parseRich(text)).map((wd) => ({ ...wd, w: wd.segs.reduce((s, sg) => s + width(sg.text, styleOf(sg), size), 0) }));
    const sp = width(' ', 'normal', size);
    const lines = [];
    let cur = [], curW = 0;
    for (const wd of words) {
      const add = cur.length ? sp + wd.w : wd.w;
      if (cur.length && curW + add > w) { lines.push(cur); cur = [wd]; curW = wd.w; } else { cur.push(wd); curW += add; }
    }
    if (cur.length) lines.push(cur);
    return { lines, sp };
  }

  function drawLine(words, x, yy, w, size, sp, justify) {
    let gap = sp;
    if (justify && words.length > 1) gap = (w - words.reduce((s, wd) => s + wd.w, 0)) / (words.length - 1);
    let cx = x;
    for (const wd of words) {
      for (const sg of wd.segs) { doc.setFont(family, styleOf(sg)).setFontSize(size).text(sg.text, cx, yy, { baseline: 'top' }); cx += width(sg.text, styleOf(sg), size); }
      cx += gap;
    }
  }

  /** Parágrafo justificado (a última linha fica à esquerda). */
  function paragraph(text, { size = fs, gap = 3, x = MARGIN, w = CONTENT_W, justify = true, color = 0 } = {}) {
    const { lines, sp } = layout(text, w, size);
    doc.setTextColor(color);
    lines.forEach((ln, i) => { ensure(lh(size)); drawLine(ln, x, y, w, size, sp, justify && i < lines.length - 1); y += lh(size); });
    y += gap;
  }

  function banner(text) {
    ensure(8 + 4 + lh(fs) * 2);
    y += 1;
    doc.setFillColor(...GRAY).roundedRect(MARGIN, y, CONTENT_W, 8, 2, 2, 'F');
    doc.setFont(family, 'bold').setFontSize(fs + 1).setTextColor(255).text(text, MARGIN + 3, y + 2.1, { baseline: 'top' });
    doc.setTextColor(0);
    y += 8 + 3.5;
  }

  function logos(height) {
    const put = (url, atRight) => {
      if (!url) return 0;
      try {
        const pr = doc.getImageProperties(url);
        const h = height, w = Math.min(60, h * pr.width / pr.height);
        doc.addImage(url, pr.fileType, atRight ? PAGE_W - MARGIN - w : MARGIN, y, w, h);
        return h;
      } catch { return 0; } // logotipo inválido: segue sem ele
    };
    return Math.max(put(report.logo, false), put(report.logo2, true));
  }

  // ----- Topo: logotipos (ou texto de cabeçalho, se não houver logotipos) -----
  const lh0 = logos(16);
  if (lh0) y += lh0 + 4;
  else if (report.headerLines.length) {
    doc.setFont(family, 'normal').setFontSize(9).setTextColor(70);
    report.headerLines.forEach((l) => { doc.text(l, MARGIN, y, { baseline: 'top' }); y += lh(9); });
    doc.setTextColor(0); y += 3;
  }

  // ----- Identificação em 3 colunas -----
  if (report.patientRows.length) {
    banner('Identificação');
    const colW = CONTENT_W / 3, size = fs - 0.5;
    const rows = [];
    for (let i = 0; i < report.patientRows.length; i += 3) rows.push(report.patientRows.slice(i, i + 3));
    const laid = rows.map((r) => r.map(([k, v]) => layout(`**${k}:** ${v}`, colW - 4, size)));
    const heights = laid.map((r) => Math.max(...r.map((c) => c.lines.length)) * lh(size) + 2.4);
    const boxH = heights.reduce((a, b) => a + b, 0) + 3;
    ensure(boxH);
    doc.setFillColor(...BOX).roundedRect(MARGIN, y, CONTENT_W, boxH, 2.5, 2.5, 'F');
    let yy = y + 2;
    laid.forEach((r, ri) => {
      r.forEach((c, ci) => c.lines.forEach((ln, li) => { doc.setTextColor(0); drawLine(ln, MARGIN + 3 + ci * colW, yy + li * lh(size), colW, size, c.sp, false); }));
      yy += heights[ri];
    });
    y += boxH + 3;
  }

  // ----- Título -----
  banner(report.title);
  if (report.statusNote) {
    doc.setFont(family, 'bold').setFontSize(fs).setTextColor(180, 60, 0);
    ensure(lh(fs) + 2);
    doc.text(report.statusNote, PAGE_W / 2, y, { align: 'center', baseline: 'top' });
    doc.setTextColor(0); y += lh(fs) + 3;
  }

  // ----- Conteúdo -----
  for (const b of report.blocks) {
    if (b.kind === 'h') banner(b.text);
    else if (b.kind === 'p') paragraph(b.text);
    else if (b.kind === 'kv') paragraph(`**${b.label}**: ${b.text}`);
    else if (b.kind === 'section') paragraph(sectionRich(b), { gap: 3.2 });
    else if (b.kind === 'list') { for (const it of b.items) paragraph(`•  **${stripRich(it)}**`, { x: MARGIN + 5, w: CONTENT_W - 5, justify: false, gap: 0.8 }); y += 3; }
    else if (b.kind === 'note') paragraph(`__${stripRich(b.text)}__`, { size: fs - 1.5, color: 90, justify: false, gap: 3 });
  }

  // ----- Imagens -----
  const imgs = report.images.items;
  if (imgs.length) {
    const n = report.images.perRow, gap = 3;
    const cellW = (CONTENT_W - gap * (n - 1)) / n;
    const rows = [];
    for (let i = 0; i < imgs.length; i += n) {
      const maxH = BOTTOM - MARGIN - 6;
      const laid = imgs.slice(i, i + n).map((im) => {
        let w = cellW * Math.min(1, Math.max(0.3, im.scale));
        let h = w * im.h / im.w;
        if (h > maxH) { h = maxH; w = h * im.w / im.h; }
        const cap = im.caption ? layout(`__${stripRich(im.caption)}__`, cellW, fs - 2) : { lines: [], sp: 0 };
        return { im, w, h, cap };
      });
      rows.push({ laid, h: Math.max(...laid.map((l) => l.h + (l.cap.lines.length ? l.cap.lines.length * lh(fs - 2) + 1.2 : 0))) + 3 });
    }
    ensure(8 + 4.5 + rows[0].h); // a faixa "Imagens" nunca fica sozinha no fim da página
    banner('Imagens');
    for (const row of rows) {
      ensure(row.h);
      row.laid.forEach((l, j) => {
        const x = MARGIN + j * (cellW + gap) + (cellW - l.w) / 2;
        doc.addImage(l.im.dataUrl, 'JPEG', x, y, l.w, l.h, undefined, 'FAST');
        l.cap.lines.forEach((ln, k) => { doc.setTextColor(70); drawLine(ln, MARGIN + j * (cellW + gap), y + l.h + 1.2 + k * lh(fs - 2), cellW, fs - 2, l.cap.sp, false); });
        doc.setTextColor(0);
      });
      y += row.h;
    }
  }

  // ----- Assinatura eletrônica (simples) -----
  if (report.signature) {
    const sg = report.signature;
    ensure(40);
    y += 4;
    const h0 = logos(11); if (h0) y += h0 + 3;
    const final = !!sg.stamp;
    const lines = final
      ? [`**Assinado eletronicamente por:** ${sg.name || '(nome não informado)'}`, sg.crmv && `**${sg.crmv}**`, `Código identificador: ${sg.code}`, sg.stamp]
      : ['**Documento não finalizado: sem assinatura eletrônica.**', sg.name && `Responsável: ${sg.name}${sg.crmv ? ' — ' + sg.crmv : ''}`, `Código identificador: ${sg.code}`];
    const size = fs - 0.5;
    const laid = lines.filter(Boolean).map((t, i) => layout(t, CONTENT_W - 8, i === 3 && final ? size - 2 : size));
    const boxH = laid.reduce((s, c, i) => s + c.lines.length * lh(i === 3 && final ? size - 2 : size), 0) + 6;
    ensure(boxH);
    doc.setFillColor(...BOX).roundedRect(MARGIN, y, CONTENT_W, boxH, 2.5, 2.5, 'F');
    let yy = y + 3;
    laid.forEach((c, i) => { const sz = i === 3 && final ? size - 2 : size; c.lines.forEach((ln) => { doc.setTextColor(i === 3 && final ? 90 : 0); drawLine(ln, MARGIN + 4, yy, CONTENT_W, sz, c.sp, false); yy += lh(sz); }); });
    doc.setTextColor(0);
    y += boxH;
  }

  // ----- Cabeçalho das páginas seguintes e rodapé com paginação -----
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    if (i > 1) { doc.setFont(family, 'normal').setFontSize(7.5).setTextColor(120).text(`${report.idShort} — ${report.dateText} — ${report.title}`, MARGIN, 8, { baseline: 'top' }); }
    doc.setFont(family, 'normal').setFontSize(8).setTextColor(100);
    doc.setDrawColor(190).setLineWidth(0.2).line(MARGIN, PAGE_H - 13, PAGE_W - MARGIN, PAGE_H - 13);
    if (report.footerText) doc.text(report.footerText, MARGIN, PAGE_H - 11, { baseline: 'top', maxWidth: CONTENT_W - 30 });
    doc.text(`Página ${i} de ${total}`, PAGE_W - MARGIN, PAGE_H - 11, { align: 'right', baseline: 'top' });
  }
  doc.setProperties({ title: report.title, creator: 'VetLaudo' });
  return doc;
}

export function pdfBlob(report) {
  return buildPdf(report).output('blob');
}

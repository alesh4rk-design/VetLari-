// Geração de PDF no navegador com jsPDF (texto selecionável, imagens embutidas, paginação controlada).
import { fmtDateBR } from './utils.js';

const PAGE_W = 210, PAGE_H = 297, MARGIN = 20, CONTENT_W = PAGE_W - 2 * MARGIN, FOOTER_H = 14;

export function buildPdf(report, jsPDFCtor) {
  const JsPDF = jsPDFCtor || (globalThis.jspdf && globalThis.jspdf.jsPDF);
  if (!JsPDF) throw new Error('Biblioteca jsPDF não carregada.');
  const doc = new JsPDF({ unit: 'mm', format: 'a4', compress: true });
  const family = report.font === 'serif' ? 'times' : 'helvetica';
  const fs = report.fontSize;
  const lh = (size) => size * 0.3528 * 1.4;
  const headerH = measureHeader();
  const top = MARGIN + headerH;
  const bottom = PAGE_H - MARGIN - FOOTER_H + 6;
  let y = top;

  function measureHeader() {
    const textH = report.headerLines.length * lh(9);
    return Math.max(report.logo ? 18 : 0, textH) + (report.headerLines.length || report.logo ? 6 : 0);
  }

  function drawHeader() {
    if (!report.headerLines.length && !report.logo) return;
    let x = MARGIN;
    if (report.logo) {
      try {
        const props = doc.getImageProperties(report.logo);
        const h = 16, w = Math.min(40, h * props.width / props.height);
        doc.addImage(report.logo, props.fileType, MARGIN, MARGIN - 4, w, h);
        x = MARGIN + w + 4;
      } catch { /* logotipo inválido: segue sem ele */ }
    }
    doc.setFont(family, 'normal').setFontSize(9).setTextColor(60);
    report.headerLines.forEach((line, i) => doc.text(line, x, MARGIN + i * lh(9), { baseline: 'top' }));
    doc.setDrawColor(150).setLineWidth(0.3).line(MARGIN, top - 3, PAGE_W - MARGIN, top - 3);
  }

  function newPage() { doc.addPage(); drawHeader(); y = top; }
  function ensure(h) { if (y + h > bottom) newPage(); }

  function paragraph(text, { bold = false, size = fs, gap = 1.5, indent = 0, color = 0 } = {}) {
    doc.setFont(family, bold ? 'bold' : 'normal').setFontSize(size).setTextColor(color);
    const lines = doc.splitTextToSize(text, CONTENT_W - indent);
    for (const line of lines) {
      ensure(lh(size));
      doc.text(line, MARGIN + indent, y, { baseline: 'top' });
      y += lh(size);
    }
    y += gap;
  }

  function labelled(label, text) {
    doc.setFont(family, 'bold').setFontSize(fs);
    const lw = doc.getTextWidth(`${label}: `);
    doc.setFont(family, 'normal');
    const lines = doc.splitTextToSize(text, CONTENT_W - lw);
    ensure(lh(fs));
    doc.setFont(family, 'bold').text(`${label}:`, MARGIN, y, { baseline: 'top' });
    doc.setFont(family, 'normal');
    lines.forEach((ln, i) => { if (i) ensure(lh(fs)); doc.text(ln, MARGIN + lw, y, { baseline: 'top' }); y += lh(fs); });
    y += 1;
  }

  drawHeader();

  // Título
  doc.setFont(family, 'bold').setFontSize(fs + 5).setTextColor(0);
  ensure(10);
  doc.text(report.title.toUpperCase(), PAGE_W / 2, y, { align: 'center', baseline: 'top' });
  y += report.statusNote ? 6 : 11;
  if (report.statusNote) {
    doc.setFont(family, 'bold').setFontSize(fs).setTextColor(180, 60, 0);
    doc.text(report.statusNote, PAGE_W / 2, y, { align: 'center', baseline: 'top' });
    doc.setTextColor(0);
    y += 9;
  }

  // Identificação do paciente (duas colunas)
  if (report.patientRows.length) {
    const colW = CONTENT_W / 2;
    doc.setDrawColor(190).setLineWidth(0.2);
    const rows = [];
    for (let i = 0; i < report.patientRows.length; i += 2) rows.push(report.patientRows.slice(i, i + 2));
    for (const row of rows) {
      const cells = row.map(([k, v]) => {
        doc.setFont(family, 'bold').setFontSize(fs - 1);
        const kw = doc.getTextWidth(`${k}: `);
        doc.setFont(family, 'normal');
        return { k, lines: doc.splitTextToSize(v, colW - kw - 4), kw };
      });
      const h = Math.max(...cells.map((c) => c.lines.length)) * lh(fs - 1) + 2.5;
      ensure(h);
      cells.forEach((c, i) => {
        const x = MARGIN + i * colW;
        doc.setFont(family, 'bold').setFontSize(fs - 1).text(`${c.k}:`, x + 1.5, y + 1.2, { baseline: 'top' });
        doc.setFont(family, 'normal');
        c.lines.forEach((ln, j) => doc.text(ln, x + 1.5 + c.kw, y + 1.2 + j * lh(fs - 1), { baseline: 'top' }));
      });
      y += h;
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    }
    y += 5;
  }

  // Conteúdo clínico
  for (const b of report.blocks) {
    if (b.kind === 'h') { ensure(lh(fs + 1) * 3); y += 2; paragraph(b.text, { bold: true, size: fs + 1, gap: 1 }); }
    else if (b.kind === 'p') paragraph(b.text, { gap: 3 });
    else if (b.kind === 'kv') labelled(b.label, b.text);
    else if (b.kind === 'section') {
      ensure(lh(fs) * 3);
      y += 1.5;
      paragraph(b.title, { bold: true, size: fs, gap: 0.5 });
      for (const it of b.items) {
        if (it.label) labelled(it.label, it.text); else paragraph(it.text, { gap: 1 });
      }
      y += 1.5;
    }
  }

  // Imagens
  const imgs = report.images.items;
  if (imgs.length) {
    ensure(lh(fs + 1) * 2 + 20);
    y += 3;
    paragraph('Imagens', { bold: true, size: fs + 1, gap: 2 });
    const n = report.images.perRow, gap = 5;
    const cellW = (CONTENT_W - gap * (n - 1)) / n;
    for (let i = 0; i < imgs.length; i += n) {
      const row = imgs.slice(i, i + n);
      const maxH = bottom - top - 12;
      const laid = row.map((im) => {
        let w = cellW * Math.min(1, Math.max(0.3, im.scale));
        let h = w * im.h / im.w;
        if (h > maxH) { h = maxH; w = h * im.w / im.h; }
        doc.setFont(family, 'italic').setFontSize(fs - 2);
        const cap = im.caption ? doc.splitTextToSize(im.caption, cellW) : [];
        return { im, w, h, cap };
      });
      const rowH = Math.max(...laid.map((l) => l.h + (l.cap.length ? l.cap.length * lh(fs - 2) + 1.5 : 0))) + 4;
      ensure(rowH);
      laid.forEach((l, j) => {
        const x = MARGIN + j * (cellW + gap) + (cellW - l.w) / 2;
        doc.addImage(l.im.dataUrl, 'JPEG', x, y, l.w, l.h, undefined, 'FAST');
        doc.setFont(family, 'italic').setFontSize(fs - 2).setTextColor(70);
        l.cap.forEach((ln, k) => doc.text(ln, MARGIN + j * (cellW + gap) + cellW / 2, y + l.h + 1.5 + k * lh(fs - 2),
          { align: 'center', baseline: 'top' }));
      });
      y += rowH;
    }
  }

  // Assinatura
  if (report.signature) {
    ensure(34);
    y += 14;
    doc.setDrawColor(0).setLineWidth(0.3).line(PAGE_W / 2 - 40, y, PAGE_W / 2 + 40, y);
    y += 1.5;
    doc.setFont(family, 'normal').setFontSize(fs).setTextColor(0);
    const lines = [report.signature.name, report.signature.crmv, report.signature.stamp].filter(Boolean);
    if (!lines.length) lines.push('Assinatura do médico-veterinário');
    lines.forEach((ln) => { doc.text(ln, PAGE_W / 2, y, { align: 'center', baseline: 'top' }); y += lh(fs); });
  }

  // Rodapé com paginação
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont(family, 'normal').setFontSize(8).setTextColor(100);
    doc.setDrawColor(190).setLineWidth(0.2).line(MARGIN, PAGE_H - MARGIN - 4, PAGE_W - MARGIN, PAGE_H - MARGIN - 4);
    if (report.footerText) doc.text(report.footerText, MARGIN, PAGE_H - MARGIN - 2, { baseline: 'top', maxWidth: CONTENT_W - 30 });
    doc.text(`Página ${i} de ${total}`, PAGE_W - MARGIN, PAGE_H - MARGIN - 2, { align: 'right', baseline: 'top' });
  }
  doc.setProperties({ title: report.title, creator: 'VetLaudo' });
  return doc;
}

export function pdfBlob(report) {
  return buildPdf(report).output('blob');
}

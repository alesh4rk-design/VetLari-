// Exportação do financeiro para Excel (.xlsx de verdade, gerado com SheetJS no próprio navegador).
// buildFinanceSheets é puro (testado); toWorkbook converte para o formato do SheetJS com moeda, datas,
// filtros e totais por fórmula (o valor calculado também vai junto, para conferir com o sistema).
import {
  FIN_STATUS, EXPENSE_USE, EXPENSE_STATUS, netOf, receivedOf, balanceOf, statusOf, summarize, forecastMonth, filterEntries,
  proValueOf, personalValueOf, proPercentOf, fuelConsumption, money, round2, monthRange, monthKey, inRange, isoOf, dateOf, priceOn,
} from './finance-logic.js';
import { download, todayISO } from './utils.js';

const BRL = '"R$" #,##0.00';
const DATE = 'dd/mm/yyyy', DATETIME = 'dd/mm/yyyy hh:mm', DUR = '[h]:mm:ss';
const excelDate = (d) => (d ? (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()) - Date.UTC(1899, 11, 30)) / 86400000 : null);
const D = (iso) => (iso ? { t: 'n', v: excelDate(dateOf(iso)), z: DATE } : '');
const DT = (ms) => (ms ? { t: 'n', v: excelDate(new Date(ms)), z: DATETIME } : '');
const $ = (n) => ({ t: 'n', v: round2(n), z: BRL });
const DURc = (ms) => ({ t: 'n', v: (ms || 0) / 86400000, z: DUR });
const code = (id) => String(id || '').slice(0, 8).toUpperCase();

/** Monta as 8 abas (sem dados pessoais de pacientes). */
export function buildFinanceSheets(d, f, prodRows) {
  const clinicName = (e) => (e.mode === 'home' ? 'Atendimento domiciliar' : (d.clinics.find((c) => c.id === e.clinicId) || {}).name || '(sem clínica)');
  const procName = (id) => (d.procedures.find((p) => p.id === id) || {}).name || '(sem tipo)';
  const catName = (id) => (d.categories.find((c) => c.id === id) || {}).name || '(sem categoria)';
  const examStatusOf = (e) => { const x = d.examOf(e); return x ? x.status : 'deleted'; };
  const entries = filterEntries(d.entries, f, d.today, examStatusOf).filter((e) => !e.cancelled || f.status === 'cancelado')
    .sort((a, b) => String(a.examDate).localeCompare(String(b.examDate)));
  const allNoPeriod = filterEntries(d.entries, { ...f, from: '', to: '' }, d.today, examStatusOf);
  const expenses = d.expenses.filter((x) => inRange(x.date, f)).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const linkedCost = (e) => round2(d.expenses.filter((x) => x.entryId === e.id).reduce((s, x) => s + proValueOf(x), 0));
  const sheets = [];

  // 1. Resumo mensal
  const months = [];
  if (f.from && f.to) for (let dt = dateOf(f.from.slice(0, 7) + '-01'); isoOf(dt) <= f.to && months.length < 36; dt.setMonth(dt.getMonth() + 1)) months.push(isoOf(dt).slice(0, 7));
  sheets.push({ name: 'Resumo mensal', headers: ['Mês de referência', 'Quantidade de exames', 'Faturamento bruto', 'Descontos', 'Despesas profissionais', 'Receita líquida estimada', 'Total recebido', 'Saldo pendente', 'Projeção mensal'],
    rows: months.map((m) => {
      const r = monthRange(m); const range = { from: r.from < f.from ? f.from : r.from, to: r.to > f.to ? f.to : r.to };
      const s = summarize(allNoPeriod, d.expenses, range, d.today);
      const fc = forecastMonth(allNoPeriod, m, d.today, { manual: (d.config.manualForecast || {})[m] });
      return [m.split('-').reverse().join('/'), s.count, $(s.gross), $(s.discounts), $(s.expensesPro), $(s.netExpected - s.expensesPro), $(s.received), $(s.pending), $(m >= monthKey(d.today) ? fc.total : s.netExpected)];
    }), totals: [1, 2, 3, 4, 5, 6, 7] });

  // 2. Lançamentos de exames
  sheets.push({ name: 'Lançamentos', headers: ['ID do exame', 'Data do exame', 'Finalização do laudo', 'Clínica ou modalidade', 'Tipo de ultrassonografia', 'Valor bruto', 'Descontos', 'Taxas adicionais', 'Despesas', 'Valor líquido previsto', 'Recebido', 'Saldo', 'Situação financeira'],
    rows: entries.map((e) => { const x = d.examOf(e); return [code(e.examId), D(e.examDate), DT(x && x.finalizedAt), clinicName(e), procName(e.procedureId), $(money(e.gross)), $(money(e.discount)), $(money(e.travelFee) + money(e.extraFees)), $(linkedCost(e)), $(netOf(e)), $(receivedOf(e)), $(balanceOf(e)), FIN_STATUS[statusOf(e, d.today)]]; }),
    totals: [5, 6, 7, 8, 9, 10, 11] });

  // 3. Recebimentos
  sheets.push({ name: 'Recebimentos', headers: ['Contratante', 'Identificador do lançamento', 'Data de vencimento', 'Data do último recebimento', 'Valor devido', 'Valor recebido', 'Saldo pendente', 'Forma de pagamento', 'Nota/documento', 'Situação'],
    rows: entries.map((e) => { const ps = (e.payments || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date))); return [clinicName(e), code(e.examId), D(e.dueDate), D(ps.length ? ps[ps.length - 1].date : ''), $(netOf(e)), $(receivedOf(e)), $(balanceOf(e)), [...new Set(ps.map((p) => p.method).filter(Boolean))].join(', '), e.invoiceNumber || '', FIN_STATUS[statusOf(e, d.today)]]; }),
    totals: [4, 5, 6] });

  // 4. Clínicas e preços
  const cp = [];
  for (const c of d.clinics) for (const p of (c.prices || []).slice().sort((a, b) => String(a.from).localeCompare(String(b.from)))) {
    const used = entries.filter((e) => e.clinicId === c.id && e.procedureId === p.procedureId && (!p.from || e.examDate >= p.from) && (!p.to || e.examDate <= p.to));
    const vigente = priceOn(c.prices, p.procedureId, d.today);
    cp.push([c.name + (c.active === false ? ' (inativa)' : ''), procName(p.procedureId), $(p.value), vigente && vigente.id === p.id ? 'Sim' : 'Não', D(p.from), D(p.to), used.length, $(used.reduce((s, e) => s + netOf(e), 0))]);
  }
  sheets.push({ name: 'Clínicas e preços', headers: ['Nome da clínica', 'Tipo de exame', 'Preço', 'Vigente hoje', 'Início da validade', 'Término da validade', 'Quantidade de exames', 'Faturamento por procedimento'], rows: cp, totals: [6, 7] });

  // 5. Atendimentos domiciliares
  sheets.push({ name: 'Atendimentos domiciliares', headers: ['Data', 'ID do exame', 'Tipo de exame', 'Região', 'Valor do exame', 'Taxa de deslocamento', 'Despesas', 'Descontos', 'Total previsto', 'Total recebido', 'Resultado estimado'],
    rows: entries.filter((e) => e.mode === 'home').map((e) => [D(e.examDate), code(e.examId), procName(e.procedureId), e.region || '', $(money(e.gross)), $(money(e.travelFee)), $(linkedCost(e)), $(money(e.discount)), $(netOf(e)), $(receivedOf(e)), $(netOf(e) - linkedCost(e))]),
    totals: [4, 5, 6, 7, 8, 9, 10] });

  // 6. Produtividade
  const label = (r) => (r.clinicKey === 'home' ? 'Atendimento domiciliar' : (d.clinics.find((c) => c.id === r.clinicKey) || {}).name || '');
  sheets.push({ name: 'Produtividade', headers: ['Identificador do laudo', 'Data do exame', 'Início da elaboração', 'Término', 'Tempo decorrido', 'Tempo efetivamente trabalhado', 'Clínica ou modalidade', 'Tipo de exame', 'Receita associada'],
    rows: prodRows.map((r) => [code(r.examId), D(r.examDate), DT(r.startedAt), DT(r.finishedAt), DURc(r.elapsedMs), DURc(r.workedMs), label(r), r.procedureId ? procName(r.procedureId) : '', $(r.net)]),
    totals: [4, 5, 8] });

  // 7. Gastos e despesas
  const related = (x) => (x.entryId ? `Atendimento ${code(x.entryId)}` : x.mode === 'clinic' ? (d.clinics.find((c) => c.id === x.clinicId) || {}).name || 'Clínica' : x.mode === 'home' ? 'Domiciliar (gasto geral)' : 'Despesa geral');
  sheets.push({ name: 'Gastos e Despesas', headers: ['Data', 'Categoria', 'Descrição', 'Tipo de gasto', 'Valor total', 'Percentual profissional', 'Valor profissional', 'Valor pessoal', 'Forma de pagamento', 'Status de pagamento', 'Atendimento ou clínica relacionada', 'Veículo', 'Observações'],
    rows: expenses.map((x) => [D(x.date), catName(x.categoryId), x.description || '', EXPENSE_USE[x.use] || '', $(money(x.amount)), { t: 'n', v: proPercentOf(x) / 100, z: '0%' }, $(proValueOf(x)), $(personalValueOf(x)), x.method || '', EXPENSE_STATUS[x.status] || '', related(x), (x.fuel && x.fuel.vehicle) || '', x.notes || '']),
    totals: [4, 6, 7] });

  // 8. Abastecimentos
  const cons = fuelConsumption(d.expenses.filter((x) => x.fuel));
  sheets.push({ name: 'Abastecimentos', headers: ['Data', 'Veículo', 'Tipo de combustível', 'Litros', 'Preço por litro', 'Valor total', 'Quilometragem', 'Distância desde o registro anterior (km)', 'Consumo estimado (km/L)', 'Percentual profissional', 'Custo profissional atribuído'],
    rows: expenses.filter((x) => x.fuel).map((x) => { const c = cons.get(x.id) || {}; return [D(x.date), x.fuel.vehicle || '', x.fuel.type || '', { t: 'n', v: money(x.fuel.liters), z: '0.00' }, { t: 'n', v: Number(x.fuel.pricePerLiter) || 0, z: '"R$" #,##0.000' }, $(money(x.amount)), x.fuel.km ? Number(x.fuel.km) : '', c.distance ?? '', c.kmPerL ?? '', { t: 'n', v: proPercentOf(x) / 100, z: '0%' }, $(proValueOf(x))]; }),
    totals: [3, 5, 10] });
  return sheets;
}

const colName = (i) => { let s = ''; i++; while (i) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; };

/** Converte para planilha SheetJS: título, período, data de exportação, cabeçalho com filtro e linha de totais (fórmula SOMA). */
export function toWorkbook(XLSX, sheets, { periodText, exportedAt }) {
  const wb = XLSX.utils.book_new();
  for (const sh of sheets) {
    const top = [[{ t: 's', v: `VetLaudo — ${sh.name}` }], [{ t: 's', v: `Período: ${periodText}` }], [{ t: 's', v: `Exportado em: ${exportedAt}` }], []];
    const head = 5, first = head + 1, last = head + sh.rows.length;
    const aoa = [...top, sh.headers, ...sh.rows];
    if (sh.rows.length && sh.totals && sh.totals.length) {
      const tot = sh.headers.map(() => '');
      tot[0] = 'TOTAL';
      for (const c of sh.totals) {
        const v = round2(sh.rows.reduce((s, r) => s + (typeof r[c] === 'object' && r[c] ? Number(r[c].v) || 0 : Number(r[c]) || 0), 0));
        const z = sh.rows.find((r) => r[c] && typeof r[c] === 'object')?.[c]?.z;
        tot[c] = { t: 'n', v, f: `SUM(${colName(c)}${first}:${colName(c)}${last})`, ...(z ? { z } : {}) };
      }
      aoa.push(tot);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!autofilter'] = { ref: `A${head}:${colName(sh.headers.length - 1)}${Math.max(head, last)}` };
    ws['!cols'] = sh.headers.map((h, i) => ({ wch: Math.min(40, Math.max(12, h.length + 2, ...sh.rows.slice(0, 200).map((r) => String(typeof r[i] === 'object' && r[i] ? '' : r[i] ?? '').length + 2))) }));
    XLSX.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31));
  }
  return wb;
}

export async function exportFinanceXlsx(d, f, prodRows) {
  const XLSX = globalThis.XLSX;
  if (!XLSX) throw new Error('Biblioteca de planilhas não carregada. Atualize a página.');
  const sheets = buildFinanceSheets(d, f, prodRows);
  const periodText = f.from || f.to ? `${f.from ? f.from.split('-').reverse().join('/') : '…'} a ${f.to ? f.to.split('-').reverse().join('/') : '…'}` : 'todos os períodos';
  const wb = toWorkbook(XLSX, sheets, { periodText, exportedAt: new Date().toLocaleString('pt-BR') });
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const name = `VetLaudo_Financeiro_${(f.month || `${f.from || ''}_${f.to || ''}`).replace(/[^0-9_-]/g, '')}_${todayISO()}.xlsx`;
  download(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
  return name;
}

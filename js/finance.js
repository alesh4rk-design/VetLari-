// Aba Financeiro: visão geral, clínicas e preços, procedimentos, lançamentos, recebimentos, domiciliar,
// gastos e despesas, produtividade e exportação para Excel. Usa só dados cadastrados pela profissional.
import { esc, toast, todayISO, fmtDateBR } from './utils.js';
import { openModal, confirmDialog } from './ui.js';
import { listExams } from './exams.js';
import {
  MODES, FIN_STATUS, PAY_METHODS, EXPENSE_USE, EXPENSE_STATUS, FUEL_TYPES, money, brl, round2, monthRange, monthKey, inRange,
  netOf, receivedOf, balanceOf, statusOf, changePrice, addPayment, summarize, forecastMonth, filterEntries, priceOn,
  proValueOf, personalValueOf, proPercentOf, paidOf, fuelFill, fuelConsumption, workedMs, elapsedMs, fmtDuration, productivity, isoOf, dateOf,
} from './finance-logic.js';
import {
  seedFinance, listClinics, listProcedures, listCategories, listEntries, listExpenses, saveClinic, saveProcedure, saveCategory,
  saveExpense, deleteExpense, saveEntry, getFinanceConfig, saveFinanceConfig, newId,
} from './finance-store.js';
import { exportFinanceXlsx } from './finance-export.js';

const TABS = [
  ['visao', 'Visão geral'], ['lancamentos', 'Lançamentos'], ['recebimentos', 'Recebimentos'], ['domiciliar', 'Domiciliar'],
  ['gastos', 'Gastos e despesas'], ['produtividade', 'Produtividade'], ['clinicas', 'Clínicas e preços'], ['procedimentos', 'Tipos de exame'], ['exportar', 'Exportar Excel'],
];
const EXAM_STATUS = { draft: 'Rascunho', preliminary: 'Preliminar', final: 'Finalizado', deleted: 'Laudo excluído' };

/** Carrega tudo o que as telas usam (dados reais do perfil). */
export async function loadFinanceData() {
  await seedFinance();
  const [clinics, procedures, entries, expenses, categories, exams, config] = await Promise.all([
    listClinics(), listProcedures(), listEntries(), listExpenses(), listCategories(), listExams(), getFinanceConfig()]);
  const examsById = Object.fromEntries(exams.map((x) => [x.id, x]));
  // Lançamento ↔ laudo: o lançamento guarda o id do laudo de origem; versões (retificação) apontam para ele.
  const examOf = (entry) => examsById[entry.examId] || exams.find((x) => x.finEntryId === entry.examId) || null;
  return { clinics, procedures, entries, expenses, categories, exams, examsById, examOf, config, today: todayISO() };
}

export const clinicName = (d, e) => (e.mode === 'home' ? 'Domiciliar' : (d.clinics.find((c) => c.id === e.clinicId) || {}).name || '(clínica não informada)');
export const procName = (d, id) => (d.procedures.find((p) => p.id === id) || {}).name || '(tipo não informado)';
const catName = (d, id) => (d.categories.find((c) => c.id === id) || {}).name || '(sem categoria)';
const opt = (v, t, sel) => `<option value="${esc(v)}" ${String(sel ?? '') === String(v) ? 'selected' : ''}>${esc(t)}</option>`;
const fdate = (iso) => (iso ? fmtDateBR(iso) : '—');
const thisMonth = () => todayISO().slice(0, 7);

function bars(rows, { fmt = brl } = {}) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return rows.length ? `<div class="fbars">${rows.map((r) => `<div class="fbar"><span class="fbar-l">${esc(r.label)}</span><span class="fbar-t"><span style="width:${Math.round((Math.abs(r.value) / max) * 100)}%"></span></span><span class="fbar-v">${fmt(r.value)}</span></div>`).join('')}</div>`
    : '<p class="muted small">Sem dados no período.</p>';
}
const kpi = (label, value, help, link = '') => `<div class="card kpi"><div class="kpi-l">${esc(label)}</div><div class="kpi-v">${value}</div><div class="kpi-h small muted">${esc(help)}</div>${link ? `<a class="small" href="${link}">Ver lançamentos</a>` : ''}</div>`;

// ---------- filtros (estado na URL) ----------
function readFilters(query) {
  const f = { clinic: query.clinica || '', procedure: query.tipo || '', mode: query.modo || '', status: query.situacao || '', examStatus: query.laudo || '' };
  if (query.de || query.ate) { f.from = query.de || ''; f.to = query.ate || ''; f.month = ''; } else { f.month = query.mes || thisMonth(); Object.assign(f, monthRange(f.month)); }
  return f;
}
function filterQS(f, extra = {}) {
  const q = { ...(f.month ? { mes: f.month } : { de: f.from, ate: f.to }), clinica: f.clinic, tipo: f.procedure, modo: f.mode, situacao: f.status, laudo: f.examStatus, ...extra };
  return Object.entries(q).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}
function filtersHtml(d, f, { status = true, exam = true } = {}) {
  return `<form class="card ffilters" id="ff"><div class="grid g4 keep2">
    <div class="field"><label for="ff-mes">Mês</label><input type="month" id="ff-mes" name="mes" value="${esc(f.month || '')}"></div>
    <div class="field"><label for="ff-de">ou de</label><input type="date" id="ff-de" name="de" value="${esc(f.month ? '' : f.from || '')}"></div>
    <div class="field"><label for="ff-ate">até</label><input type="date" id="ff-ate" name="ate" value="${esc(f.month ? '' : f.to || '')}"></div>
    <div class="field"><label for="ff-cl">Clínica</label><select id="ff-cl" name="clinica">${opt('', 'Todas')}${opt('home', 'Atendimento domiciliar', f.clinic)}${d.clinics.map((c) => opt(c.id, c.name + (c.active === false ? ' (inativa)' : ''), f.clinic)).join('')}</select></div>
    <div class="field"><label for="ff-tp">Tipo de exame</label><select id="ff-tp" name="tipo">${opt('', 'Todos')}${d.procedures.map((p) => opt(p.id, p.name, f.procedure)).join('')}</select></div>
    <div class="field"><label for="ff-md">Modalidade</label><select id="ff-md" name="modo">${opt('', 'Todas')}${Object.entries(MODES).map(([k, v]) => opt(k, v, f.mode)).join('')}</select></div>
    ${status ? `<div class="field"><label for="ff-st">Situação financeira</label><select id="ff-st" name="situacao">${opt('', 'Todas')}${Object.entries(FIN_STATUS).map(([k, v]) => opt(k, v, f.status)).join('')}</select></div>` : ''}
    ${exam ? `<div class="field"><label for="ff-lx">Situação do laudo</label><select id="ff-lx" name="laudo">${opt('', 'Todas')}${Object.entries(EXAM_STATUS).map(([k, v]) => opt(k, v, f.examStatus)).join('')}</select></div>` : ''}
  </div></form>`;
}
function bindFilters(view, tab) {
  const form = view.querySelector('#ff'); if (!form) return;
  form.addEventListener('change', (e) => {
    const fd = Object.fromEntries(new FormData(form));
    if (e.target.name === 'mes' && fd.mes) { fd.de = ''; fd.ate = ''; }
    if ((e.target.name === 'de' || e.target.name === 'ate') && (fd.de || fd.ate)) fd.mes = '';
    const qs = Object.entries({ aba: tab, ...fd }).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    location.hash = `#/financeiro?${qs}${!fd.mes && !fd.de && !fd.ate ? '&mes=' + thisMonth() : ''}`;
  });
}
const examStatusFn = (d) => (e) => { const x = d.examOf(e); return x ? x.status : 'deleted'; };

// ---------- tela ----------
export async function renderFinance(view, query, profile) {
  const tab = TABS.some(([k]) => k === query.aba) ? query.aba : 'visao';
  const d = await loadFinanceData();
  const f = readFilters(query);
  view.innerHTML = `<div class="page-head"><div><h1>Financeiro</h1><p class="muted small">Seus exames, recebimentos, gastos e tempo de laudo — só com os dados que você registra. Tudo fica neste aparelho.</p></div></div>
    <nav class="ftabs" aria-label="Áreas do financeiro">${TABS.map(([k, v]) => `<a href="#/financeiro?aba=${k}&${filterQS(f)}" ${k === tab ? 'aria-current="page"' : ''}>${v}</a>`).join('')}</nav>
    <div id="fbody"></div>`;
  const body = view.querySelector('#fbody');
  const rerender = () => renderFinance(view, query, profile);
  await ({ visao, lancamentos, recebimentos, domiciliar, gastos, produtividade, clinicas, procedimentos, exportar })[tab](body, d, f, rerender, query);
  bindFilters(body, tab);
}

// ----- visão geral -----
async function visao(body, d, f) {
  const list = filterEntries(d.entries, { ...f, from: '', to: '' }, d.today, examStatusFn(d));
  const s = summarize(list, filterExpenses(d.expenses, f), f, d.today);
  const ym = f.month || monthKey(f.to || d.today);
  const fc = forecastMonth(d.entries.filter((e) => list.includes(e)), ym, d.today, { manual: d.config.manualForecast[ym] });
  const link = (extra) => `#/financeiro?aba=lancamentos&${filterQS(f, extra)}`;
  const byClinic = Object.entries(s.byClinic).map(([k, v]) => ({ label: k === 'home' ? 'Domiciliar' : (d.clinics.find((c) => c.id === k) || {}).name || '(sem clínica)', value: v.total })).sort((a, b) => b.value - a.value);
  const byProc = Object.entries(s.byProcedure).map(([k, v]) => ({ label: procName(d, k), value: v.total })).sort((a, b) => b.value - a.value);
  const months = []; for (let i = 5; i >= 0; i--) { const dt = dateOf(`${ym}-01`); dt.setMonth(dt.getMonth() - i); months.push(isoOf(dt).slice(0, 7)); }
  const evo = months.map((m) => { const r = summarize(list, d.expenses, monthRange(m), d.today); return { m, net: r.netExpected, rec: r.received }; });
  const noData = !d.entries.length;
  body.innerHTML = `${filtersHtml(d, f)}
    ${noData ? '<div class="alert info">Ainda não há exames no financeiro. Ao criar um laudo, escolha a <strong>modalidade de atendimento</strong> (clínica ou domiciliar) e o tipo de exame: o lançamento é criado sozinho. Cadastre antes as <a href="#/financeiro?aba=clinicas">clínicas e os preços</a>.</div>' : ''}
    <div class="kpis">
      ${kpi('Faturamento bruto', brl(s.gross), 'Valor dos exames realizados no período (pela data do exame), antes de descontos.', link())}
      ${kpi('Receita líquida prevista', brl(s.netExpected), 'Bruto − descontos + taxas (ex.: deslocamento). É o que você deve receber.', link())}
      ${kpi('Total faturado', brl(s.invoiced), 'Lançamentos com data de faturamento (nota/cobrança) dentro do período.', link({ situacao: 'faturado' }))}
      ${kpi('Recebido no período', brl(s.received), 'Dinheiro que entrou, pela data do recebimento (pode ser de exames de outros meses).', '#/financeiro?aba=recebimentos&' + filterQS(f))}
      ${kpi('Pendente de recebimento', brl(s.pending), 'Saldo ainda não pago dos exames do período.', link())}
      ${kpi('Vencido', brl(s.overdue), 'Saldo com data de vencimento já passada.', link({ situacao: 'vencido' }))}
      ${kpi('Exames realizados', String(s.count), `Exames com data até hoje. ${s.scheduledCount ? s.scheduledCount + ' agendado(s) no período não entram aqui.' : ''}`, link())}
      ${kpi('Valor médio por exame', brl(s.avgPerExam), 'Receita líquida prevista ÷ número de exames.', link())}
      ${kpi('Domiciliar', brl(s.home), `${s.homeCount} atendimento(s) domiciliar(es) no período.`, link({ clinica: 'home' }))}
    </div>
    <div class="card"><h2>Previsão do mês (${esc(ym.split('-').reverse().join('/'))})</h2>
      <div class="kpis small-kpis">
        ${kpi('Realizado até hoje', brl(fc.realized), 'Exames com data até hoje no mês.')}
        ${kpi('Já realizados, ainda não faturados', brl(s.notInvoiced), 'Saldo de exames feitos sem data de faturamento.')}
        ${kpi('Estimativa dos dias que faltam', brl(fc.future), `${fc.remainingDays} dia(s) restantes. ${fc.scheduled ? 'Agendados: ' + brl(fc.scheduled) + ' (não garantidos).' : ''}`)}
        ${kpi('Recebido no mês', brl(summarize(list, [], monthRange(ym), d.today).received), 'Pela data do recebimento.')}
        ${kpi('Pendente', brl(summarize(list, [], monthRange(ym), d.today).pending), 'Saldo a receber dos exames do mês.')}
        ${kpi('Previsão total do mês', brl(fc.total), fc.manual ? 'Estimativa manual informada por você.' : `Realizado + estimativa${fc.uncertainty ? ` (± ${brl(fc.uncertainty)})` : ''}.`)}
      </div>
      <p class="small"><strong>Método:</strong> ${esc(fc.method)} ${fc.uncertainty ? `Incerteza aproximada: ± ${brl(fc.uncertainty)} (variação diária do histórico).` : ''} Previsão não é dinheiro recebido.</p>
      <form class="row" id="manualfc"><div class="field" style="margin:0"><label for="mfc">Estimativa manual para o mês (opcional)</label><input id="mfc" inputmode="decimal" value="${esc(d.config.manualForecast[ym] ?? '')}" placeholder="Ex.: 8000,00"></div><button class="btn sm">Salvar estimativa</button></form>
    </div>
    <div class="grid g2"><div class="card"><h2>Receita por clínica</h2>${bars(byClinic)}</div><div class="card"><h2>Receita por tipo de exame</h2>${bars(byProc)}</div></div>
    <div class="card"><h2>Evolução (6 meses): prevista × recebida</h2>${bars(evo.flatMap((r) => [{ label: `${r.m.slice(5)}/${r.m.slice(2, 4)} prevista`, value: r.net }, { label: `${r.m.slice(5)}/${r.m.slice(2, 4)} recebida`, value: r.rec }]))}</div>
    <div class="card"><h2>Resultado do período</h2><div class="kpis small-kpis">
      ${kpi('Receita prevista', brl(s.netExpected), 'Pelos exames do período.')}
      ${kpi('Receita recebida', brl(s.received), 'Dinheiro que entrou.')}
      ${kpi('Despesas profissionais pagas', brl(s.expensesProPaid), 'Só a parte profissional; gastos pessoais não entram.')}
      ${kpi('Despesas profissionais pendentes', brl(s.expensesProPending), 'Ainda não pagas (não saíram do caixa).')}
      ${kpi('Resultado de caixa', brl(s.cashResult), 'Recebido − despesas profissionais pagas.')}
      ${kpi('Resultado estimado da atividade', brl(s.estimatedResult), 'Receita prevista − despesas profissionais. Não é lucro contábil (faltam tributos e outras obrigações).')}
    </div></div>`;
  body.querySelector('#manualfc').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = body.querySelector('#mfc').value.trim();
    const cfg = { ...d.config, manualForecast: { ...d.config.manualForecast } };
    if (v) cfg.manualForecast[ym] = money(v); else delete cfg.manualForecast[ym];
    await saveFinanceConfig(cfg); toast('Estimativa salva.', 'success'); location.reload();
  });
}
function filterExpenses(list, f) { return list.filter((x) => inRange(x.date, f) && (!f.mode || f.mode === 'home' ? (!f.mode || x.mode === 'home') : true) && (!f.clinic || f.clinic === 'home' ? (!f.clinic || x.mode === 'home') : x.clinicId === f.clinic)); }

// ----- lançamentos -----
async function lancamentos(body, d, f, rerender, query) {
  const list = filterEntries(d.entries, f, d.today, examStatusFn(d)).sort((a, b) => String(b.examDate).localeCompare(String(a.examDate)));
  const tot = list.reduce((s, e) => ({ net: s.net + netOf(e), rec: s.rec + receivedOf(e), bal: s.bal + balanceOf(e) }), { net: 0, rec: 0, bal: 0 });
  body.innerHTML = `${filtersHtml(d, f)}<div class="card"><div class="row between"><h2>Lançamentos de exames (${list.length})</h2><span class="small">Previsto ${brl(tot.net)} · recebido ${brl(tot.rec)} · saldo ${brl(tot.bal)}</span></div>
    ${list.length ? `<div class="ftable"><table><thead><tr><th>Data</th><th>Paciente</th><th>Clínica / modalidade</th><th>Tipo</th><th class="num">Líquido</th><th class="num">Saldo</th><th>Situação</th><th></th></tr></thead><tbody>
    ${list.map((e) => { const x = d.examOf(e); return `<tr><td>${fdate(e.examDate)}</td><td>${esc(x ? x.patient.name || '—' : 'laudo excluído')}</td><td>${esc(clinicName(d, e))}</td><td>${esc(procName(d, e.procedureId))}</td><td class="num">${brl(netOf(e))}</td><td class="num">${brl(balanceOf(e))}</td><td><span class="fst ${statusOf(e, d.today)}">${FIN_STATUS[statusOf(e, d.today)]}</span></td><td><button class="btn sm" data-edit="${esc(e.id)}">Abrir</button></td></tr>`; }).join('')}
    </tbody></table></div>` : '<p class="muted">Nenhum lançamento com esses filtros.</p>'}</div>`;
  body.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = async () => { if (await entryDialog(d, d.entries.find((e) => e.id === b.dataset.edit))) rerender(); }; });
  if (query.id) { const e = d.entries.find((x) => x.id === query.id); if (e && await entryDialog(d, e)) rerender(); }
}

/** Janela de edição de um lançamento (valores, faturamento, recebimentos). Devolve true se salvou. */
export function entryDialog(d, entry) {
  const e = JSON.parse(JSON.stringify(entry));
  const x = d.examOf(e);
  const m = openModal(`<h2>Lançamento do exame</h2><p class="muted small">${esc(x ? x.patient.name || 'Paciente' : 'Laudo excluído')} · ${esc(clinicName(d, e))} · ${esc(procName(d, e.procedureId))}</p>
    <form id="ef" novalidate><div class="grid g2">
      <div class="field"><label>Modalidade</label><select name="mode">${Object.entries(MODES).map(([k, v]) => opt(k, v, e.mode)).join('')}</select></div>
      <div class="field"><label>Clínica</label><select name="clinicId">${opt('', '—')}${d.clinics.map((c) => opt(c.id, c.name, e.clinicId)).join('')}</select></div>
      <div class="field"><label>Tipo de exame</label><select name="procedureId">${d.procedures.map((p) => opt(p.id, p.name, e.procedureId)).join('')}</select></div>
      <div class="field"><label>Data do exame</label><input type="date" name="examDate" value="${esc(e.examDate || '')}"></div>
      <div class="field"><label>Valor do exame (bruto)</label><input name="gross" inputmode="decimal" value="${esc(String(e.gross ?? ''))}"></div>
      <div class="field"><label>Motivo, se mudar o valor</label><input name="reason" placeholder="Ex.: valor negociado"></div>
      <div class="field"><label>Desconto</label><input name="discount" inputmode="decimal" value="${esc(String(e.discount || ''))}"></div>
      <div class="field"><label>Taxa de deslocamento</label><input name="travelFee" inputmode="decimal" value="${esc(String(e.travelFee || ''))}"></div>
      <div class="field"><label>Outras taxas cobradas</label><input name="extraFees" inputmode="decimal" value="${esc(String(e.extraFees || ''))}"></div>
      <div class="field"><label>Região / endereço (domiciliar)</label><input name="region" value="${esc(e.region || '')}"></div>
      <div class="field"><label>Data de faturamento</label><input type="date" name="invoiceDate" value="${esc(e.invoiceDate || '')}"></div>
      <div class="field"><label>Nº nota fiscal / documento</label><input name="invoiceNumber" value="${esc(e.invoiceNumber || '')}"></div>
      <div class="field"><label>Vencimento (pagamento previsto)</label><input type="date" name="dueDate" value="${esc(e.dueDate || '')}"></div>
      <label class="check"><input type="checkbox" name="cancelled" ${e.cancelled ? 'checked' : ''}> Cancelado (não entra nos totais)</label>
    </div>
    <div class="field"><label>Observações</label><input name="notes" value="${esc(e.notes || '')}"></div>
    <p><strong>Líquido previsto:</strong> <span id="netv">${brl(netOf(e))}</span></p>
    ${(e.priceHistory || []).length ? `<details><summary class="small">Histórico do valor (${e.priceHistory.length})</summary><ul class="small">${e.priceHistory.map((h) => `<li>${new Date(h.ts).toLocaleDateString('pt-BR')}: ${brl(h.from)} → ${brl(h.to)} — ${esc(h.reason)}</li>`).join('')}</ul></details>` : ''}
    <h3>Recebimentos</h3><ul class="list" id="pays"></ul>
    <div class="grid g4 keep2"><div class="field"><label>Valor recebido</label><input id="pa" inputmode="decimal"></div><div class="field"><label>Data</label><input type="date" id="pd" value="${todayISO()}"></div>
      <div class="field"><label>Forma</label><select id="pm">${PAY_METHODS.map((p) => opt(p, p)).join('')}</select></div><div class="field"><label>&nbsp;</label><button type="button" class="btn" id="padd">Registrar recebimento</button></div></div>
    <div id="eerr"></div>
    <div class="row end"><button type="button" class="btn" data-x="cancel">Fechar</button><button class="btn primary">Salvar</button></div></form>`, { label: 'Lançamento', wide: true });
  const form = m.el.querySelector('#ef');
  const drawPays = () => {
    m.el.querySelector('#pays').innerHTML = (e.payments || []).map((p) => `<li><span>${fdate(p.date)} · ${brl(p.amount)} · ${esc(p.method || '')}</span><button type="button" class="btn sm danger" data-rm="${esc(p.id)}">Remover</button></li>`).join('')
      + `<li class="small"><span>Recebido ${brl(receivedOf(e))} · saldo ${brl(balanceOf({ ...e, ...readNums() }))}</span></li>`;
  };
  const readNums = () => { const fd = new FormData(form); return { gross: money(fd.get('gross')), discount: money(fd.get('discount')), travelFee: money(fd.get('travelFee')), extraFees: money(fd.get('extraFees')) }; };
  drawPays();
  form.addEventListener('input', () => { m.el.querySelector('#netv').textContent = brl(netOf({ ...e, ...readNums() })); drawPays(); });
  m.el.querySelector('#pays').addEventListener('click', (ev) => { const b = ev.target.closest('[data-rm]'); if (b) { e.payments = e.payments.filter((p) => p.id !== b.dataset.rm); drawPays(); } });
  m.el.querySelector('#padd').onclick = () => {
    try { addPayment(e, { amount: m.el.querySelector('#pa').value, date: m.el.querySelector('#pd').value, method: m.el.querySelector('#pm').value }, newId()); m.el.querySelector('#pa').value = ''; drawPays(); }
    catch (err) { m.el.querySelector('#eerr').innerHTML = `<div class="alert error">${esc(err.message)}</div>`; }
  };
  m.el.querySelector('[data-x=cancel]').onclick = () => m.close(false);
  return new Promise((resolve) => {
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      try {
        changePrice(e, fd.get('gross'), fd.get('reason'));
        Object.assign(e, { mode: fd.get('mode'), clinicId: fd.get('mode') === 'home' ? '' : fd.get('clinicId'), procedureId: fd.get('procedureId'), examDate: fd.get('examDate'),
          discount: money(fd.get('discount')), travelFee: money(fd.get('travelFee')), extraFees: money(fd.get('extraFees')), region: fd.get('region').trim(),
          invoiceDate: fd.get('invoiceDate'), invoiceNumber: fd.get('invoiceNumber').trim(), dueDate: fd.get('dueDate'), cancelled: fd.get('cancelled') === 'on', notes: fd.get('notes').trim() });
        if (e.mode === 'clinic' && !e.clinicId) throw new Error('Escolha a clínica (ou mude para atendimento domiciliar).');
        await saveEntry(e); toast('Lançamento salvo.', 'success'); m.close(true);
      } catch (err) { m.el.querySelector('#eerr').innerHTML = `<div class="alert error">${esc(err.message)}</div>`; }
    });
    m.closed.then((v) => resolve(!!v));
  });
}

// ----- recebimentos -----
async function recebimentos(body, d, f, rerender) {
  const rows = [];
  for (const e of d.entries) for (const p of e.payments || []) if (inRange(p.date, f)) rows.push({ e, p });
  rows.sort((a, b) => String(b.p.date).localeCompare(String(a.p.date)));
  const open = d.entries.filter((e) => balanceOf(e) > 0 && !e.cancelled && e.examDate <= d.today).sort((a, b) => String(a.dueDate || a.examDate).localeCompare(String(b.dueDate || b.examDate)));
  const total = round2(rows.reduce((s, r) => s + money(r.p.amount), 0));
  body.innerHTML = `${filtersHtml(d, f, { status: false, exam: false })}
    <div class="card"><h2>A receber (${open.length})</h2><p class="small muted">Saldos em aberto de todos os períodos. Pagamento parcial atualiza o saldo sozinho.</p>
    ${open.length ? `<div class="ftable"><table><thead><tr><th>Contratante</th><th>Exame</th><th>Vencimento</th><th class="num">Devido</th><th class="num">Recebido</th><th class="num">Saldo</th><th>Situação</th><th></th></tr></thead><tbody>
    ${open.map((e) => `<tr><td>${esc(clinicName(d, e))}</td><td>${fdate(e.examDate)} · ${esc(procName(d, e.procedureId))}</td><td>${fdate(e.dueDate)}</td><td class="num">${brl(netOf(e))}</td><td class="num">${brl(receivedOf(e))}</td><td class="num">${brl(balanceOf(e))}</td><td><span class="fst ${statusOf(e, d.today)}">${FIN_STATUS[statusOf(e, d.today)]}</span></td><td><button class="btn sm" data-edit="${esc(e.id)}">Receber</button></td></tr>`).join('')}
    </tbody></table></div>` : '<p class="muted">Nada em aberto.</p>'}</div>
    <div class="card"><div class="row between"><h2>Recebido no período</h2><strong>${brl(total)}</strong></div>
    ${rows.length ? `<ul class="list">${rows.map(({ e, p }) => `<li><span>${fdate(p.date)} · ${esc(clinicName(d, e))} · ${esc(procName(d, e.procedureId))}</span><span>${brl(p.amount)} · ${esc(p.method || '')}${p.doc ? ' · ' + esc(p.doc) : ''}</span></li>`).join('')}</ul>` : '<p class="muted">Nenhum recebimento no período.</p>'}</div>`;
  body.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = async () => { if (await entryDialog(d, d.entries.find((e) => e.id === b.dataset.edit))) rerender(); }; });
}

// ----- domiciliar -----
async function domiciliar(body, d, f, rerender) {
  const list = filterEntries(d.entries, { ...f, mode: 'home', clinic: '' }, d.today).filter((e) => !e.cancelled);
  const s = summarize(list, d.expenses, f, d.today);
  const general = d.expenses.filter((x) => inRange(x.date, f) && x.mode === 'home' && !x.entryId);
  const genPro = round2(general.reduce((t, x) => t + proValueOf(x), 0));
  body.innerHTML = `${filtersHtml(d, f, { exam: false })}
    <div class="kpis">${kpi('Atendimentos', String(s.homeCount), 'Exames domiciliares realizados no período.')}${kpi('Receita prevista', brl(s.home), 'Exame − desconto + deslocamento.')}
      ${kpi('Taxas de deslocamento', brl(round2(list.filter((e) => e.examDate <= d.today && inRange(e.examDate, f)).reduce((t, e) => t + money(e.travelFee), 0))), 'Separadas do valor do exame.')}
      ${kpi('Custos ligados aos atendimentos', brl(round2(s.homeDetail.reduce((t, r) => t + r.costs, 0))), 'Despesas profissionais associadas a um atendimento.')}
      ${kpi('Gastos gerais de deslocamento', brl(genPro), 'Despesas domiciliares sem atendimento específico (não rateadas).')}
      ${kpi('Resultado estimado', brl(round2(s.home - s.homeDetail.reduce((t, r) => t + r.costs, 0) - genPro)), 'Receita − custos ligados − gastos gerais. Não é lucro contábil.')}</div>
    <div class="card"><h2>Por atendimento</h2>${s.homeDetail.length ? `<div class="ftable"><table><thead><tr><th>Data</th><th>Tipo</th><th>Região</th><th class="num">Receita</th><th class="num">Custos ligados</th><th class="num">Resultado</th><th></th></tr></thead><tbody>
      ${s.homeDetail.map((r) => { const e = list.find((x) => x.id === r.id); return `<tr><td>${fdate(e.examDate)}</td><td>${esc(procName(d, e.procedureId))}</td><td>${esc(e.region || '')}</td><td class="num">${brl(r.net)}</td><td class="num">${brl(r.costs)}</td><td class="num">${brl(r.result)}</td><td><button class="btn sm" data-edit="${esc(e.id)}">Abrir</button></td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted">Nenhum atendimento domiciliar no período.</p>'}</div>
    <div class="card"><h2>Tabela de preços domiciliares</h2><p class="small muted">Valor por tipo de exame e, se quiser, por região. É sugerido ao criar o laudo; você pode ajustar em cada atendimento.</p>
      <ul class="list">${d.config.homePrices.map((hp) => `<li><span>${esc(procName(d, hp.procedureId))}${hp.region ? ' · ' + esc(hp.region) : ''} · ${brl(hp.value)} · desde ${fdate(hp.from)}${hp.to ? ' até ' + fdate(hp.to) : ''}</span><button class="btn sm danger" data-hprm="${esc(hp.id)}">Excluir</button></li>`).join('') || '<li class="muted small">Nenhum preço domiciliar cadastrado.</li>'}</ul>
      <form id="hpf" class="grid g4 keep2"><div class="field"><label>Tipo de exame</label><select name="procedureId">${d.procedures.filter((p) => p.active !== false).map((p) => opt(p.id, p.name)).join('')}</select></div>
        <div class="field"><label>Região (opcional)</label><input name="region"></div><div class="field"><label>Valor</label><input name="value" inputmode="decimal" required></div>
        <div class="field"><label>Válido desde</label><input type="date" name="from" value="${todayISO()}"></div><div class="field"><label>&nbsp;</label><button class="btn">Adicionar preço</button></div></form></div>`;
  body.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = async () => { if (await entryDialog(d, d.entries.find((e) => e.id === b.dataset.edit))) rerender(); }; });
  body.querySelectorAll('[data-hprm]').forEach((b) => { b.onclick = async () => { await saveFinanceConfig({ ...d.config, homePrices: d.config.homePrices.filter((h) => h.id !== b.dataset.hprm) }); rerender(); }; });
  body.querySelector('#hpf').addEventListener('submit', async (ev) => {
    ev.preventDefault(); const fd = Object.fromEntries(new FormData(ev.target));
    if (!money(fd.value)) return toast('Informe o valor.', 'error');
    await saveFinanceConfig({ ...d.config, homePrices: [...d.config.homePrices, { id: newId(), procedureId: fd.procedureId, region: fd.region.trim(), value: money(fd.value), from: fd.from, to: '' }] });
    toast('Preço domiciliar salvo.', 'success'); rerender();
  });
}

// ----- gastos e despesas -----
async function gastos(body, d, f, rerender, query) {
  const vf = query.veiculo || '', cf = query.categoria || '', pf = query.forma || '', mf = query.modo || '';
  const list = d.expenses.filter((x) => inRange(x.date, f) && (!cf || x.categoryId === cf) && (!pf || x.method === pf) && (!vf || (x.fuel && x.fuel.vehicle) === vf) && (!mf || x.mode === mf))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const sum = (l, fn) => round2(l.reduce((t, x) => t + fn(x), 0));
  const prevRange = (() => { const ym = f.month || monthKey(f.from || d.today); const dt = dateOf(`${ym}-01`); dt.setMonth(dt.getMonth() - 1); return monthRange(isoOf(dt).slice(0, 7)); })();
  const prevTotal = sum(d.expenses.filter((x) => inRange(x.date, prevRange)), (x) => money(x.amount));
  const total = sum(list, (x) => money(x.amount));
  const isFuel = (x) => !!x.fuel || (d.categories.find((c) => c.id === x.categoryId) || {}).fuel;
  const isMaint = (x) => /manuten/i.test(catName(d, x.categoryId));
  const byCat = {}; for (const x of list) byCat[x.categoryId] = round2((byCat[x.categoryId] || 0) + money(x.amount));
  const catRows = Object.entries(byCat).map(([k, v]) => ({ label: catName(d, k), value: v })).sort((a, b) => b.value - a.value);
  const days = f.from && f.to ? Math.round((dateOf(f.to < d.today ? f.to : d.today) - dateOf(f.from)) / 86400000) + 1 : 0;
  const months = []; for (let i = 5; i >= 0; i--) { const dt = dateOf(`${(f.month || monthKey(d.today))}-01`); dt.setMonth(dt.getMonth() - i); const m = isoOf(dt).slice(0, 7); months.push({ label: `${m.slice(5)}/${m.slice(2, 4)}`, value: sum(d.expenses.filter((x) => monthKey(x.date) === m), (x) => money(x.amount)) }); }
  const vehicles = [...new Set(d.expenses.map((x) => x.fuel && x.fuel.vehicle).filter(Boolean))];
  const cons = fuelConsumption(d.expenses.filter((x) => x.fuel));
  body.innerHTML = `${filtersHtml(d, f, { status: false, exam: false })}
    <form class="card" id="gf"><div class="grid g4 keep2">
      <div class="field"><label>Categoria</label><select name="categoria">${opt('', 'Todas')}${d.categories.map((c) => opt(c.id, c.name + (c.active === false ? ' (desativada)' : ''), cf)).join('')}</select></div>
      <div class="field"><label>Forma de pagamento</label><select name="forma">${opt('', 'Todas')}${PAY_METHODS.map((p) => opt(p, p, pf)).join('')}</select></div>
      <div class="field"><label>Veículo</label><select name="veiculo">${opt('', 'Todos')}${vehicles.map((v) => opt(v, v, vf)).join('')}</select></div>
      <div class="field"><label>Modalidade</label><select name="modo">${opt('', 'Todas')}${opt('clinic', 'Clínica', mf)}${opt('home', 'Atendimento domiciliar', mf)}${opt('general', 'Despesa geral', mf)}</select></div></div></form>
    <div class="row"><button class="btn primary" id="gnew">+ Nova despesa</button><button class="btn" id="gfuel">⛽ Novo abastecimento</button><button class="btn ghost" id="gcats">Categorias</button></div>
    <div class="kpis">
      ${kpi('Total de gastos', brl(total), 'Tudo o que foi registrado no período (pessoal + profissional).')}
      ${kpi('Profissionais', brl(sum(list, proValueOf)), 'Parte profissional (compartilhadas pelo percentual).')}
      ${kpi('Pessoais', brl(sum(list, personalValueOf)), 'Não entram no resultado profissional.')}
      ${kpi('Pendente de pagamento', brl(sum(list, (x) => money(x.amount) - paidOf(x))), 'Despesas ainda não pagas.')}
      ${kpi('Combustível', brl(sum(list.filter(isFuel), (x) => money(x.amount))), 'Abastecimentos e combustíveis.')}
      ${kpi('Manutenção', brl(sum(list.filter(isMaint), (x) => money(x.amount))), 'Veículo e equipamentos.')}
      ${kpi('Outras despesas', brl(sum(list.filter((x) => !isFuel(x) && !isMaint(x)), (x) => money(x.amount))), 'Demais categorias.')}
      ${kpi('Média diária', brl(days ? round2(total / days) : 0), days ? `Total ÷ ${days} dia(s) do período até hoje.` : '')}
      ${kpi('Mês anterior', brl(prevTotal), prevTotal ? `${total >= prevTotal ? '+' : ''}${Math.round(((total - prevTotal) / prevTotal) * 100)}% em relação ao mês anterior.` : 'Sem gastos no mês anterior.')}
      ${kpi('Categoria que mais consumiu', catRows[0] ? esc(catRows[0].label) : '—', catRows[0] ? brl(catRows[0].value) : '')}
    </div>
    <div class="grid g2"><div class="card"><h2>Por categoria</h2>${bars(catRows)}</div><div class="card"><h2>Evolução mensal</h2>${bars(months)}</div></div>
    <div class="card"><h2>Lançamentos de despesas (${list.length})</h2>${list.length ? `<div class="ftable"><table><thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Tipo</th><th class="num">Valor</th><th class="num">Profissional</th><th>Status</th><th></th></tr></thead><tbody>
      ${list.map((x) => { const c = x.fuel ? cons.get(x.id) : null; return `<tr><td>${fdate(x.date)}</td><td>${esc(catName(d, x.categoryId))}</td><td>${esc(x.description || '')}${x.fuel ? `<div class="small muted">${esc(x.fuel.vehicle || '')} · ${x.fuel.liters} L × ${brl(x.fuel.pricePerLiter)}${c && c.kmPerL ? ` · ~${String(c.kmPerL).replace('.', ',')} km/L (estimado)` : ''}</div>` : ''}</td><td>${EXPENSE_USE[x.use] || ''}${x.use === 'shared' ? ` ${proPercentOf(x)}%` : ''}</td><td class="num">${brl(x.amount)}</td><td class="num">${brl(proValueOf(x))}</td><td>${EXPENSE_STATUS[x.status] || ''}</td><td><button class="btn sm" data-xedit="${esc(x.id)}">Editar</button></td></tr>`; }).join('')}
    </tbody></table></div>` : '<p class="muted">Nenhuma despesa no período.</p>'}</div>`;
  body.querySelector('#gf').addEventListener('change', (ev) => {
    const fd = Object.fromEntries(new FormData(ev.currentTarget));
    location.hash = `#/financeiro?aba=gastos&${filterQS(f)}&${Object.entries(fd).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
  });
  body.querySelector('#gnew').onclick = async () => { if (await expenseDialog(d, {})) rerender(); };
  body.querySelector('#gfuel').onclick = async () => { if (await expenseDialog(d, { fuel: {} })) rerender(); };
  body.querySelector('#gcats').onclick = async () => { await categoriesDialog(d); rerender(); };
  body.querySelectorAll('[data-xedit]').forEach((b) => { b.onclick = async () => { if (await expenseDialog(d, d.expenses.find((x) => x.id === b.dataset.xedit))) rerender(); }; });
}

/** Cadastro/edição de despesa (inclui abastecimento). Devolve true se salvou. */
export function expenseDialog(d, base) {
  const x = { id: '', date: todayISO(), use: base.fuel ? 'shared' : 'professional', proPercent: base.fuel ? 100 : 100, status: 'pago', mode: 'general', ...JSON.parse(JSON.stringify(base)) };
  const fuel = !!x.fuel;
  const cats = d.categories.filter((c) => c.active !== false || c.id === x.categoryId);
  const fuelCat = cats.find((c) => c.fuel && (!x.fuel || !x.fuel.type || c.name === x.fuel.type)) || cats.find((c) => c.fuel);
  const homeEntries = d.entries.filter((e) => e.mode === 'home' && !e.cancelled).sort((a, b) => String(b.examDate).localeCompare(String(a.examDate))).slice(0, 60);
  const m = openModal(`<h2>${x.id ? 'Editar' : 'Nova'} ${fuel ? 'abastecimento' : 'despesa'}</h2><form id="xf" novalidate><div class="grid g2">
    <div class="field"><label>Data *</label><input type="date" name="date" value="${esc(x.date)}"></div>
    ${fuel ? `<div class="field"><label>Combustível</label><select name="ftype">${FUEL_TYPES.map((t) => opt(t, t, x.fuel.type)).join('')}</select></div>
      <div class="field"><label>Litros</label><input name="liters" inputmode="decimal" value="${esc(String(x.fuel.liters || ''))}"></div>
      <div class="field"><label>Preço por litro</label><input name="ppl" inputmode="decimal" value="${esc(String(x.fuel.pricePerLiter || ''))}"></div>
      <div class="field"><label>Quilometragem (opcional)</label><input name="km" inputmode="numeric" value="${esc(String(x.fuel.km || ''))}"></div>
      <div class="field"><label>Posto (opcional)</label><input name="station" value="${esc(x.fuel.station || '')}"></div>
      <div class="field"><label>Veículo</label><input name="vehicle" value="${esc(x.fuel.vehicle || '')}" placeholder="Ex.: Carro"></div>
      <div class="field"><label>Finalidade</label><select name="purpose">${['Atendimento domiciliar', 'Deslocamento para clínica', 'Uso misto'].map((t) => opt(t, t, x.fuel.purpose)).join('')}</select></div>`
      : `<div class="field"><label>Categoria *</label><select name="categoryId">${cats.map((c) => opt(c.id, `${c.name} — ${c.group || ''}`, x.categoryId)).join('')}</select></div>
      <div class="field"><label>Descrição</label><input name="description" value="${esc(x.description || '')}"></div>`}
    <div class="field"><label>Valor total *</label><input name="amount" inputmode="decimal" value="${esc(String(x.amount ?? ''))}">${fuel ? '<div class="hint">Com litros e preço por litro, o total é calculado sozinho.</div>' : ''}</div>
    <div class="field"><label>Forma de pagamento</label><select name="method">${PAY_METHODS.map((p) => opt(p, p, x.method)).join('')}</select></div>
    ${fuel ? '' : `<div class="field"><label>Estabelecimento / fornecedor</label><input name="supplier" value="${esc(x.supplier || '')}"></div>`}
    <div class="field"><label>Tipo de gasto</label><select name="use">${Object.entries(EXPENSE_USE).map(([k, v]) => opt(k, v, x.use)).join('')}</select></div>
    <div class="field" id="pctw"><label>% profissional</label><input name="proPercent" inputmode="numeric" value="${esc(String(x.proPercent ?? 100))}"></div>
    <div class="field"><label>Status</label><select name="status">${Object.entries(EXPENSE_STATUS).map(([k, v]) => opt(k, v, x.status)).join('')}</select></div>
    <div class="field" id="paidw"><label>Valor já pago</label><input name="paidAmount" inputmode="decimal" value="${esc(String(x.paidAmount || ''))}"></div>
    <div class="field"><label>Relacionada a</label><select name="mode">${opt('general', 'Despesa geral', x.mode)}${opt('clinic', 'Clínica', x.mode)}${opt('home', 'Atendimento domiciliar', x.mode)}</select></div>
    <div class="field" id="clw"><label>Clínica</label><select name="clinicId">${opt('', '—')}${d.clinics.map((c) => opt(c.id, c.name, x.clinicId)).join('')}</select></div>
    <div class="field" id="enw"><label>Atendimento (opcional)</label><select name="entryId">${opt('', 'Gasto geral de deslocamento (sem atendimento específico)')}${homeEntries.map((e) => { const ex = d.examOf(e); return opt(e.id, `${fdate(e.examDate)} · ${ex ? ex.patient.name : ''} · ${procName(d, e.procedureId)}`, x.entryId); }).join('')}</select><div class="hint">Associe a um só atendimento; despesas de vários atendimentos registre como gasto geral (não divida o mesmo gasto).</div></div>
    <div class="field"><label>Comprovante (foto, opcional)</label><input type="file" name="receiptFile" accept="image/*">${x.receipt ? '<div class="small">Comprovante anexado ✓</div>' : ''}</div>
    </div><div class="field"><label>Observações</label><input name="notes" value="${esc(x.notes || '')}"></div>
    <p class="small" id="xcalc"></p><div id="xerr"></div>
    <div class="row between">${x.id ? '<button type="button" class="btn danger" data-x="del">Excluir</button>' : '<span></span>'}<span class="row"><button type="button" class="btn" data-x="cancel">Cancelar</button><button class="btn primary">Salvar</button></span></div></form>`, { label: 'Despesa', wide: true });
  const form = m.el.querySelector('#xf');
  const sync = () => {
    const fd = Object.fromEntries(new FormData(form));
    m.el.querySelector('#pctw').hidden = fd.use !== 'shared';
    m.el.querySelector('#paidw').hidden = fd.status !== 'parcial';
    m.el.querySelector('#clw').hidden = fd.mode !== 'clinic';
    m.el.querySelector('#enw').hidden = fd.mode !== 'home';
    if (fuel) {
      const r = fuelFill({ liters: fd.liters, pricePerLiter: fd.ppl, total: '' });
      if (money(fd.liters) && Number(String(fd.ppl).replace(',', '.'))) form.elements.amount.value = String(r.total).replace('.', ',');
      else if (money(fd.liters) && money(fd.amount) && !fd.ppl) form.elements.ppl.placeholder = `≈ ${String(fuelFill({ liters: fd.liters, total: fd.amount }).pricePerLiter).replace('.', ',')}`;
    }
    const tmp = { amount: form.elements.amount.value, use: fd.use, proPercent: fd.proPercent };
    m.el.querySelector('#xcalc').textContent = `Profissional: ${brl(proValueOf(tmp))} · Pessoal: ${brl(personalValueOf(tmp))}`;
  };
  form.addEventListener('input', sync); sync();
  m.el.querySelector('[data-x=cancel]').onclick = () => m.close(false);
  const del = m.el.querySelector('[data-x=del]');
  if (del) del.onclick = async () => { if (await confirmDialog('Excluir esta despesa?', { ok: 'Excluir', danger: true })) { await deleteExpense(x.id); m.close(true); } };
  return new Promise((resolve) => {
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = Object.fromEntries(new FormData(form));
      const err = (t) => { m.el.querySelector('#xerr').innerHTML = `<div class="alert error">${esc(t)}</div>`; };
      const out = { ...x, id: x.id || newId(), date: fd.date, amount: money(fd.amount), method: fd.method, use: fd.use, proPercent: fd.use === 'shared' ? Math.min(100, Math.max(0, Number(fd.proPercent) || 0)) : proPercentOf({ use: fd.use }),
        status: fd.status, paidAmount: fd.status === 'parcial' ? money(fd.paidAmount) : 0, mode: fd.mode, clinicId: fd.mode === 'clinic' ? fd.clinicId : '', entryId: fd.mode === 'home' ? fd.entryId : '', notes: fd.notes.trim() };
      if (fuel) {
        const r = fuelFill({ liters: fd.liters, pricePerLiter: fd.ppl, total: fd.amount });
        const cat = d.categories.find((c) => c.fuel && c.name === fd.ftype) || fuelCat;
        Object.assign(out, { amount: r.total, categoryId: cat ? cat.id : '', description: `Abastecimento ${fd.ftype}`, fuel: { type: fd.ftype, liters: r.liters, pricePerLiter: r.pricePerLiter, km: Number(fd.km) || '', station: fd.station.trim(), vehicle: fd.vehicle.trim(), purpose: fd.purpose } });
      } else Object.assign(out, { categoryId: fd.categoryId, description: fd.description.trim(), supplier: fd.supplier.trim() });
      if (!out.date) return err('Informe a data.');
      if (!(out.amount > 0)) return err('Informe o valor.');
      const file = form.elements.receiptFile.files[0];
      if (file) { if (file.size > 5 * 1048576) return err('Comprovante até 5 MB.'); out.receipt = await shrinkImage(file); }
      const dup = d.expenses.find((y) => y.id !== out.id && y.date === out.date && money(y.amount) === out.amount && y.categoryId === out.categoryId && String(y.description || '') === String(out.description || ''));
      if (dup && !(await confirmDialog('Já existe uma despesa igual (mesma data, categoria, descrição e valor). Registrar mesmo assim?', { ok: 'Registrar' }))) return;
      await saveExpense(out); toast('Despesa salva.', 'success'); m.close(true);
    });
    m.closed.then((v) => resolve(!!v));
  });
}
function shrinkImage(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => { const k = Math.min(1, 1200 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); resolve(c.toDataURL('image/jpeg', 0.8)); }; img.onerror = () => resolve(''); img.src = r.result; };
    r.onerror = () => resolve(''); r.readAsDataURL(file);
  });
}
function categoriesDialog(d) {
  const m = openModal(`<h2>Categorias de gastos</h2><p class="muted small">Renomear, desativar ou mudar a ordem não altera despesas já lançadas.</p>
    <ul class="list">${d.categories.map((c, i) => `<li><span class="row" style="flex:1"><input data-cn="${esc(c.id)}" value="${esc(c.name)}" style="flex:1;min-width:0"><input data-cg="${esc(c.id)}" value="${esc(c.group || '')}" style="max-width:180px" aria-label="Grupo"></span>
      <span class="row"><button type="button" class="btn sm" data-up="${i}" aria-label="Subir">↑</button><label class="check"><input type="checkbox" data-ca="${esc(c.id)}" ${c.active !== false ? 'checked' : ''}> ativa</label></span></li>`).join('')}</ul>
    <div class="row"><input id="ncat" placeholder="Nova categoria"><input id="ngrp" placeholder="Grupo (ex.: Transporte e veículo)"><button type="button" class="btn" id="addcat">Adicionar</button></div>
    <div class="row end"><button class="btn primary" data-x="close">Concluir</button></div>`, { label: 'Categorias', wide: true });
  m.el.addEventListener('change', async (e) => {
    const t = e.target, c = d.categories.find((x) => x.id === (t.dataset.cn || t.dataset.cg || t.dataset.ca)); if (!c) return;
    if (t.dataset.cn) c.name = t.value.trim() || c.name; if (t.dataset.cg) c.group = t.value.trim(); if (t.dataset.ca) c.active = t.checked;
    await saveCategory(c);
  });
  m.el.addEventListener('click', async (e) => {
    const up = e.target.closest('[data-up]');
    if (up) { const i = Number(up.dataset.up); if (i > 0) { const [a, b] = [d.categories[i - 1], d.categories[i]]; d.categories.forEach((c, k) => { c.order = k; }); [a.order, b.order] = [b.order, a.order]; await saveCategory(a); await saveCategory(b); toast('Ordem alterada.', 'success'); } }
    if (e.target.id === 'addcat') { const n = m.el.querySelector('#ncat').value.trim(); if (!n) return; await saveCategory({ id: newId(), name: n, group: m.el.querySelector('#ngrp').value.trim(), active: true, order: d.categories.length }); toast('Categoria criada.', 'success'); m.close(true); }
    if (e.target.dataset.x === 'close') m.close(true);
  });
  return m.closed;
}

// ----- produtividade -----
export function productivityRows(d, f) {
  const list = filterEntries(d.entries, { ...f, from: '', to: '' }, d.today, examStatusFn(d));
  const entryOf = Object.fromEntries(list.map((e) => [e.id, e]));
  const rows = [];
  for (const x of d.exams) {
    if (x.status !== 'final' || !x.finalizedAt) continue;
    const finished = isoOf(new Date(x.finalizedAt));
    if (!inRange(finished, f)) continue;
    const e = entryOf[x.finEntryId || x.id];
    if ((f.clinic || f.mode || f.procedure || f.status || f.examStatus) && !e) continue;
    const sessions = (x.work && x.work.sessions) || [];
    rows.push({ examId: x.id, examDate: x.date || (e && e.examDate) || '', startedAt: sessions[0] ? sessions[0].start : null, finishedAt: x.finalizedAt, finishedDate: finished,
      workedMs: workedMs(sessions), elapsedMs: elapsedMs(sessions), clinicKey: e ? (e.mode === 'home' ? 'home' : e.clinicId) : '', procedureId: e ? e.procedureId : '',
      net: e ? netOf(e) : 0, invoiced: e && e.invoiceDate ? netOf(e) : 0, received: e ? receivedOf(e) : 0, mode: e ? e.mode : '' });
  }
  return rows;
}
async function produtividade(body, d, f) {
  const rows = productivityRows(d, f);
  const p = productivity(rows);
  const label = (k) => (k === 'home' ? 'Domiciliar' : (d.clinics.find((c) => c.id === k) || {}).name || '(sem lançamento)');
  const timeBars = (m, lab) => bars(Object.entries(m).map(([k, v]) => ({ label: `${lab(k)} (${v.count})`, value: v.avg })).sort((a, b) => b.value - a.value), { fmt: fmtDuration });
  const cnt = (m, lab = (k) => k) => bars(Object.entries(m).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([k, v]) => ({ label: lab(k), value: v })), { fmt: String });
  body.innerHTML = `${filtersHtml(d, f)}
    <div class="alert info small">O tempo vem do cronômetro do laudo (só o tempo efetivamente trabalhado, sem pausas). Laudo mais rápido não significa laudo melhor: use estes números para organizar a rotina, nunca para encurtar a avaliação clínica.</div>
    <div class="kpis">
      ${kpi('Laudos finalizados', String(p.count), `${p.timed} com tempo registrado pelo cronômetro.`)}
      ${kpi('Tempo médio por laudo', p.timed ? fmtDuration(p.avgMs) : '—', 'Soma do tempo trabalhado ÷ laudos com tempo.')}
      ${kpi('Tempo mediano', p.timed ? fmtDuration(p.medianMs) : '—', 'Metade dos laudos levou menos que isso.')}
      ${kpi('Tempo total de elaboração', fmtDuration(p.totalMs), 'Soma de todas as sessões de trabalho.')}
      ${kpi('Receita prevista por hora', p.perHour ? brl(p.perHour.expected) : '—', 'Receita líquida prevista dos laudos ÷ horas de elaboração.')}
      ${kpi('Receita faturada por hora', p.perHour ? brl(p.perHour.invoiced) : '—', 'Só lançamentos já faturados ÷ horas.')}
      ${kpi('Receita recebida por hora', p.perHour ? brl(p.perHour.received) : '—', 'Só o que já foi recebido ÷ horas.')}
    </div>
    <div class="grid g2"><div class="card"><h2>Tempo médio por tipo de exame</h2>${timeBars(p.byProcedure, (k) => procName(d, k))}</div><div class="card"><h2>Tempo médio por clínica</h2>${timeBars(p.byClinic, label)}</div></div>
    <div class="grid g2"><div class="card"><h2>Laudos por dia</h2>${cnt(p.perDay, fdate)}</div><div class="card"><h2>Laudos por semana</h2>${cnt(p.perWeek, (k) => 'semana de ' + fdate(k))}</div></div>
    <div class="card"><h2>Laudos por mês</h2>${cnt(p.perMonth, (k) => k.split('-').reverse().join('/'))}</div>
    <div class="row"><a class="btn primary" href="#/financeiro?aba=exportar&${filterQS(f)}">Exportar para Excel</a></div>`;
}

// ----- clínicas e preços -----
async function clinicas(body, d, f, rerender, query) {
  const editing = query.clinicaId ? d.clinics.find((c) => c.id === query.clinicaId) : null;
  const stats = (c) => { const l = d.entries.filter((e) => e.clinicId === c.id && !e.cancelled); return { n: l.length, net: round2(l.reduce((s, e) => s + netOf(e), 0)), rec: round2(l.reduce((s, e) => s + receivedOf(e), 0)) }; };
  body.innerHTML = `<div class="card"><div class="row between"><h2>Clínicas, hospitais e empresas</h2><button class="btn primary" id="cnew">+ Nova clínica</button></div>
    ${d.clinics.length ? `<ul class="list">${d.clinics.map((c) => { const s = stats(c); return `<li><span><strong>${esc(c.name)}</strong>${c.active === false ? ' <span class="badge">inativa</span>' : ''}<div class="small muted">${(c.prices || []).length} preço(s) · ${s.n} exame(s) · previsto ${brl(s.net)} · recebido ${brl(s.rec)}</div></span><span class="row"><a class="btn sm" href="#/financeiro?aba=lancamentos&clinica=${esc(c.id)}&de=2000-01-01&ate=2100-12-31">Histórico</a><button class="btn sm" data-cedit="${esc(c.id)}">Editar e preços</button></span></li>`; }).join('')}</ul>` : '<p class="muted">Nenhuma clínica cadastrada ainda.</p>'}</div>`;
  const open = async (c) => { if (await clinicDialog(d, c)) rerender(); };
  body.querySelector('#cnew').onclick = () => open(null);
  body.querySelectorAll('[data-cedit]').forEach((b) => { b.onclick = () => open(d.clinics.find((c) => c.id === b.dataset.cedit)); });
  if (editing) open(editing);
}
export function clinicDialog(d, base) {
  const c = base ? JSON.parse(JSON.stringify(base)) : { id: newId(), name: '', address: '', payment: 'Por exame', payTermDays: 30, notes: '', active: true, prices: [] };
  const procs = d.procedures;
  const m = openModal(`<h2>${base ? 'Editar clínica' : 'Nova clínica'}</h2><form id="cf" novalidate><div class="grid g2">
    <div class="field"><label>Nome *</label><input name="name" value="${esc(c.name)}"></div><div class="field"><label>Endereço (opcional)</label><input name="address" value="${esc(c.address || '')}"></div>
    <div class="field"><label>WhatsApp da clínica (opcional)</label><input name="phone" inputmode="tel" value="${esc(c.phone || '')}" placeholder="(21) 99999-8888"><div class="hint">Com o número, o botão "Enviar pelo WhatsApp" do laudo já abre a conversa com a clínica.</div></div>
    <div class="field"><label>E-mail da clínica (opcional)</label><input name="email" type="email" value="${esc(c.email || '')}" placeholder="laudos@clinica.com"></div>
    <div class="field"><label>Forma de remuneração</label><select name="payment">${['Por exame', 'Mensal (fechamento)', 'Percentual', 'Outra'].map((t) => opt(t, t, c.payment)).join('')}</select></div>
    <div class="field"><label>Prazo habitual de pagamento (dias)</label><input name="payTermDays" inputmode="numeric" value="${esc(String(c.payTermDays ?? ''))}"></div>
    <label class="check"><input type="checkbox" name="active" ${c.active !== false ? 'checked' : ''}> Ativa (inativas continuam nos relatórios)</label></div>
    <div class="field"><label>Observações</label><input name="notes" value="${esc(c.notes || '')}"></div>
    <h3>Tabela de preços</h3><p class="small muted">Cada exame guarda o preço do dia em que foi lançado. Para reajustar, adicione um novo preço com a data de início: os exames antigos não mudam.</p>
    <ul class="list" id="plist"></ul>
    <div class="grid g4 keep2"><div class="field"><label>Tipo de exame</label><select id="pp">${procs.filter((p) => p.active !== false).map((p) => opt(p.id, p.name)).join('')}</select></div>
      <div class="field"><label>Valor</label><input id="pv" inputmode="decimal"></div><div class="field"><label>Válido desde</label><input type="date" id="pf" value="${todayISO()}"></div>
      <div class="field"><label>Até (opcional)</label><input type="date" id="pt"></div><div class="field"><label>Condições especiais</label><input id="pc"></div>
      <div class="field"><label>Observações</label><input id="pn"></div><div class="field"><label>&nbsp;</label><button type="button" class="btn" id="padd">Adicionar preço</button></div></div>
    <div id="cerr"></div><div class="row end"><button type="button" class="btn" data-x="cancel">Cancelar</button><button class="btn primary">Salvar clínica</button></div></form>`, { label: 'Clínica', wide: true });
  const drawP = () => {
    m.el.querySelector('#plist').innerHTML = (c.prices || []).slice().sort((a, b) => procName(d, a.procedureId).localeCompare(procName(d, b.procedureId)) || String(b.from).localeCompare(String(a.from)))
      .map((p) => `<li><span>${esc(procName(d, p.procedureId))} · <strong>${brl(p.value)}</strong> · desde ${fdate(p.from)}${p.to ? ' até ' + fdate(p.to) : ''}${p.conditions ? ' · ' + esc(p.conditions) : ''}</span><span class="row"><button type="button" class="btn sm" data-pend="${esc(p.id)}">Encerrar validade hoje</button><button type="button" class="btn sm danger" data-prm="${esc(p.id)}">Excluir</button></span></li>`).join('')
      || '<li class="muted small">Nenhum preço cadastrado.</li>';
  };
  drawP();
  m.el.querySelector('#plist').addEventListener('click', (e) => {
    const rm = e.target.closest('[data-prm]'), end = e.target.closest('[data-pend]');
    if (rm) c.prices = c.prices.filter((p) => p.id !== rm.dataset.prm);
    if (end) { const p = c.prices.find((x) => x.id === end.dataset.pend); p.to = todayISO(); }
    drawP();
  });
  m.el.querySelector('#padd').onclick = () => {
    const v = money(m.el.querySelector('#pv').value), from = m.el.querySelector('#pf').value;
    if (!v || !from) { m.el.querySelector('#cerr').innerHTML = '<div class="alert error">Informe valor e data de início.</div>'; return; }
    const procedureId = m.el.querySelector('#pp').value;
    // Novo preço a partir de uma data: encerra o anterior em aberto na véspera (histórico preservado).
    for (const p of c.prices) if (p.procedureId === procedureId && !p.to && p.from < from) { const dt = dateOf(from); dt.setDate(dt.getDate() - 1); p.to = isoOf(dt); }
    c.prices.push({ id: newId(), procedureId, value: v, from, to: m.el.querySelector('#pt').value, conditions: m.el.querySelector('#pc').value.trim(), notes: m.el.querySelector('#pn').value.trim() });
    m.el.querySelector('#pv').value = ''; m.el.querySelector('#cerr').innerHTML = ''; drawP();
  };
  m.el.querySelector('[data-x=cancel]').onclick = () => m.close(false);
  return new Promise((resolve) => {
    m.el.querySelector('#cf').addEventListener('submit', async (ev) => {
      ev.preventDefault(); const fd = Object.fromEntries(new FormData(ev.target));
      if (!fd.name.trim()) { m.el.querySelector('#cerr').innerHTML = '<div class="alert error">Informe o nome.</div>'; return; }
      Object.assign(c, { name: fd.name.trim(), address: fd.address.trim(), phone: (fd.phone || '').trim(), email: (fd.email || '').trim(), payment: fd.payment, payTermDays: Number(fd.payTermDays) || 0, notes: fd.notes.trim(), active: fd.active === 'on' });
      await saveClinic(c); toast('Clínica salva.', 'success'); m.close(true);
    });
    m.closed.then((v) => resolve(!!v));
  });
}

// ----- procedimentos -----
async function procedimentos(body, d, f, rerender) {
  body.innerHTML = `<div class="card"><h2>Tipos de ultrassonografia</h2><p class="small muted">Lista editável: os exemplos iniciais são só sugestões. Desativar não apaga o histórico.</p>
    <div class="ftable"><table><thead><tr><th>Nome</th><th>Categoria</th><th>Descrição</th><th>Unidade de cobrança</th><th>Ativo</th></tr></thead><tbody>
    ${d.procedures.map((p) => `<tr><td><input data-pf="name" data-id="${esc(p.id)}" value="${esc(p.name)}"></td><td><input data-pf="category" data-id="${esc(p.id)}" value="${esc(p.category || '')}"></td>
      <td><input data-pf="description" data-id="${esc(p.id)}" value="${esc(p.description || '')}"></td><td><input data-pf="unit" data-id="${esc(p.id)}" value="${esc(p.unit || 'por exame')}"></td>
      <td><input type="checkbox" data-pf="active" data-id="${esc(p.id)}" ${p.active !== false ? 'checked' : ''}></td></tr>`).join('')}</tbody></table></div>
    <form class="row" id="npf"><input name="name" placeholder="Novo tipo de exame (ex.: Ecocardiograma)" style="flex:1"><input name="category" placeholder="Categoria"><button class="btn">Adicionar</button></form></div>`;
  body.addEventListener('change', async (e) => {
    const t = e.target; if (!t.dataset.pf) return;
    const p = d.procedures.find((x) => x.id === t.dataset.id);
    p[t.dataset.pf] = t.type === 'checkbox' ? t.checked : t.value.trim();
    await saveProcedure(p); toast('Tipo de exame salvo.', 'success');
  });
  body.querySelector('#npf').addEventListener('submit', async (e) => {
    e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target));
    if (!fd.name.trim()) return;
    await saveProcedure({ id: newId(), name: fd.name.trim(), category: fd.category.trim(), description: '', unit: 'por exame', active: true, order: d.procedures.length });
    rerender();
  });
}

// ----- exportação -----
async function exportar(body, d, f) {
  body.innerHTML = `${filtersHtml(d, f)}<div class="card"><h2>Exportar para Excel (.xlsx)</h2>
    <p>Gera uma planilha do Excel com as abas: Resumo mensal, Lançamentos, Recebimentos, Clínicas e preços, Atendimentos domiciliares, Produtividade, Gastos e Despesas e Abastecimentos — com os filtros acima.</p>
    <p class="small muted">Valores em reais e datas no formato do Excel, com totais por fórmula. Não inclui nomes de pacientes nem de tutores (apenas o código do laudo).</p>
    <button class="btn primary" id="xls">Exportar para Excel</button> <span id="xmsg" class="small"></span></div>`;
  body.querySelector('#xls').onclick = async () => {
    const msg = body.querySelector('#xmsg'); msg.textContent = 'Gerando…';
    try { const name = await exportFinanceXlsx(d, f, productivityRows(d, f)); msg.textContent = `Arquivo ${name} gerado com sucesso.`; toast(`Planilha ${name} gerada.`, 'success'); }
    catch (err) { msg.textContent = ''; toast(`Não foi possível gerar a planilha: ${err.message}`, 'error'); }
  };
}

// ---------- integração com o laudo ----------
/** Preço sugerido: tabela da clínica (ou domiciliar) vigente na data do exame. */
export function suggestPrice(d, { mode, clinicId, procedureId, examDate, region }) {
  const date = examDate || todayISO();
  if (mode === 'home') return priceOn(d.config.homePrices, procedureId, date, region);
  const c = d.clinics.find((x) => x.id === clinicId);
  return c ? priceOn(c.prices, procedureId, date) : null;
}
/** Vencimento padrão: data do exame + prazo habitual da clínica. */
export function defaultDue(d, clinicId, examDate) {
  const c = d.clinics.find((x) => x.id === clinicId);
  if (!c || !c.payTermDays || !examDate) return '';
  const dt = dateOf(examDate); dt.setDate(dt.getDate() + Number(c.payTermDays)); return isoOf(dt);
}

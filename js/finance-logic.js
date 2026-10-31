// Regras do módulo financeiro e de produtividade. Funções puras (sem tela e sem banco), testadas em
// tests/finance.test.js. Valores em reais (números com centavos); datas no formato AAAA-MM-DD.
//
// Princípios: receita prevista ≠ dinheiro recebido; o faturamento do mês conta pela DATA DO EXAME e o
// recebido pela DATA DO RECEBIMENTO; cada laudo tem um único lançamento (id = id do laudo); o preço
// aplicado fica gravado no lançamento (mudanças futuras na tabela não alteram exames antigos).

export const MODES = { clinic: 'Clínica ou empresa', home: 'Atendimento domiciliar' };
export const FIN_STATUS = {
  previsto: 'Previsto', aguardando: 'Aguardando faturamento', faturado: 'Faturado', parcial: 'Parcialmente recebido',
  recebido: 'Recebido', vencido: 'Vencido', cancelado: 'Cancelado',
};
export const PAY_METHODS = ['Pix', 'Transferência', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito', 'Boleto', 'Outro'];
export const EXPENSE_USE = { professional: 'Profissional', personal: 'Pessoal', shared: 'Compartilhada' };
export const EXPENSE_STATUS = { pago: 'Pago', pendente: 'Pendente', parcial: 'Parcialmente pago' };
export const FUEL_TYPES = ['Gasolina', 'Etanol', 'Diesel', 'GNV'];

export const DEFAULT_PROCEDURES = [
  ['Ultrassonografia abdominal completa', 'Abdominal'], ['Ultrassonografia abdominal direcionada', 'Abdominal'],
  ['Ultrassonografia gestacional', 'Reprodutiva'], ['Ultrassonografia reprodutiva', 'Reprodutiva'],
  ['Ultrassonografia de tecidos moles', 'Tecidos moles'], ['Ultrassonografia musculoesquelética', 'Musculoesquelética'],
  ['Ultrassonografia cervical', 'Cervical'],
];
export const DEFAULT_CATEGORIES = [
  ['Gasolina', 'Transporte e veículo', true], ['Etanol', 'Transporte e veículo', true], ['Diesel', 'Transporte e veículo', true], ['GNV', 'Transporte e veículo', true],
  ['Pedágio', 'Transporte e veículo'], ['Estacionamento', 'Transporte e veículo'], ['Manutenção do veículo', 'Transporte e veículo'],
  ['Troca de óleo', 'Transporte e veículo'], ['Pneus', 'Transporte e veículo'], ['Seguro e documentação do veículo', 'Transporte e veículo'],
  ['Aplicativos de transporte', 'Transporte e veículo'],
  ['Manutenção de equipamentos de ultrassonografia', 'Atividade profissional'], ['Materiais e insumos', 'Atividade profissional'],
  ['Cursos e capacitações', 'Atividade profissional'], ['Softwares e assinaturas', 'Atividade profissional'],
  ['Taxas bancárias', 'Atividade profissional'], ['Impostos e taxas profissionais', 'Atividade profissional'], ['Outras despesas', 'Atividade profissional'],
];

// ---------- números e datas ----------
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
/** Aceita "1.234,56", "1234,56", "1234.56" ou número. Vazio/ inválido → 0. */
export function money(v) {
  if (typeof v === 'number') return isFinite(v) ? round2(v) : 0;
  let s = String(v ?? '').trim().replace(/[R$\s]/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return isFinite(n) ? round2(n) : 0;
}
export const brl = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const p2 = (n) => String(n).padStart(2, '0');
export const isoOf = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const dateOf = (iso) => new Date(`${iso}T00:00:00`);
export const monthKey = (iso) => String(iso || '').slice(0, 7);
export function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  return { from: `${ym}-01`, to: isoOf(new Date(y, m, 0)) };
}
export const inRange = (iso, { from, to } = {}) => !!iso && (!from || iso >= from) && (!to || iso <= to);
export function weekKey(iso) {
  const d = dateOf(iso); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return isoOf(d); // segunda-feira da semana
}

// ---------- preços ----------
/** Preço vigente na data: a faixa de validade que contém a data; empate → a que começou mais tarde. */
export function priceOn(prices, procedureId, iso, region = '') {
  const ok = (prices || []).filter((p) => p.procedureId === procedureId && (!p.from || p.from <= iso) && (!p.to || p.to >= iso)
    && (!region || !p.region || norm(p.region) === norm(region)));
  ok.sort((a, b) => (norm(b.region || '') === norm(region) ? 1 : 0) - (norm(a.region || '') === norm(region) ? 1 : 0) || String(b.from || '').localeCompare(String(a.from || '')));
  return ok[0] || null;
}
const norm = (s) => String(s || '').trim().toLowerCase();

// ---------- lançamentos ----------
export function netOf(e) { return round2(money(e.gross) - money(e.discount) + money(e.travelFee) + money(e.extraFees)); }
export const receivedOf = (e) => round2((e.payments || []).reduce((s, p) => s + money(p.amount), 0));
export const balanceOf = (e) => (e.cancelled ? 0 : round2(Math.max(0, netOf(e) - receivedOf(e))));

/** Situação financeira (independente da situação do laudo). */
export function statusOf(e, today) {
  if (e.cancelled) return 'cancelado';
  const net = netOf(e), rec = receivedOf(e);
  if (net > 0 && rec >= net) return 'recebido';
  if (net === 0 && rec === 0 && e.examDate && e.examDate > today) return 'previsto';
  if (e.dueDate && e.dueDate < today && rec < net) return 'vencido';
  if (rec > 0) return 'parcial';
  if (e.invoiceDate) return 'faturado';
  if (e.examDate && e.examDate > today) return 'previsto';
  return 'aguardando';
}

/** Muda o preço de um lançamento registrando motivo e histórico (o preço sugerido original fica guardado). */
export function changePrice(e, newGross, reason, when = Date.now()) {
  const value = money(newGross);
  if (value === money(e.gross)) return e;
  if (!String(reason || '').trim()) throw new Error('Informe o motivo da alteração do valor.');
  e.priceHistory = [...(e.priceHistory || []), { ts: when, from: money(e.gross), to: value, reason: String(reason).trim() }];
  e.gross = value;
  return e;
}

export function addPayment(e, { amount, date, method = '', doc = '', notes = '' }, id) {
  const a = money(amount);
  if (a <= 0) throw new Error('Informe um valor recebido maior que zero.');
  if (!date) throw new Error('Informe a data do recebimento.');
  e.payments = [...(e.payments || []), { id, amount: a, date, method, doc, notes }];
  return e;
}

// ---------- despesas ----------
export function proPercentOf(x) { return x.use === 'personal' ? 0 : x.use === 'shared' ? Math.min(100, Math.max(0, Number(x.proPercent) || 0)) : 100; }
export const proValueOf = (x) => round2(money(x.amount) * proPercentOf(x) / 100);
export const personalValueOf = (x) => round2(money(x.amount) - proValueOf(x));
export const paidOf = (x) => (x.status === 'pago' ? money(x.amount) : x.status === 'parcial' ? Math.min(money(x.amount), money(x.paidAmount)) : 0);

/** Abastecimento: completa o valor que faltar (total = litros × preço; preço = total ÷ litros). */
export function fuelFill(f) {
  const liters = money(f.liters), ppl = Number(String(f.pricePerLiter ?? '').replace(',', '.')) || 0, total = money(f.total);
  if (liters > 0 && ppl > 0 && !total) return { liters, pricePerLiter: ppl, total: round2(liters * ppl) };
  if (liters > 0 && total > 0 && !ppl) return { liters, pricePerLiter: Math.round((total / liters) * 1000) / 1000, total };
  return { liters, pricePerLiter: ppl, total: total || round2(liters * ppl) };
}

/**
 * Consumo estimado entre abastecimentos do mesmo veículo, pela quilometragem: distância desde o registro
 * anterior ÷ litros deste abastecimento. É uma ESTIMATIVA (supõe tanque completado nos dois registros).
 */
export function fuelConsumption(records) {
  const out = new Map();
  const byVehicle = {};
  for (const r of records) (byVehicle[r.fuel?.vehicle || ''] ||= []).push(r);
  for (const list of Object.values(byVehicle)) {
    const withKm = list.filter((r) => Number(r.fuel?.km) > 0).sort((a, b) => Number(a.fuel.km) - Number(b.fuel.km) || String(a.date).localeCompare(String(b.date)));
    for (let i = 0; i < withKm.length; i++) {
      const r = withKm[i], prev = withKm[i - 1];
      if (!prev) { out.set(r.id, { distance: null, kmPerL: null, note: 'primeiro registro com km (sem base de comparação)' }); continue; }
      const distance = Number(r.fuel.km) - Number(prev.fuel.km), liters = money(r.fuel.liters);
      out.set(r.id, distance > 0 && liters > 0
        ? { distance, kmPerL: Math.round((distance / liters) * 100) / 100, note: 'estimativa entre abastecimentos' }
        : { distance: distance > 0 ? distance : null, kmPerL: null, note: 'dados insuficientes' });
    }
    for (const r of list) if (!out.has(r.id)) out.set(r.id, { distance: null, kmPerL: null, note: 'sem quilometragem' });
  }
  return out;
}

// ---------- resumo financeiro do período ----------
/**
 * entries: lançamentos; expenses: despesas; range: {from,to}; today: AAAA-MM-DD.
 * Faturamento/receita pela data do exame; recebido pela data do pagamento; despesas pela data da despesa.
 */
export function summarize(entries, expenses, range, today) {
  const live = entries.filter((e) => !e.cancelled);
  const inPeriod = live.filter((e) => inRange(e.examDate, range));
  const done = inPeriod.filter((e) => e.examDate <= today);
  const sum = (list, f) => round2(list.reduce((s, x) => s + f(x), 0));
  const exp = (expenses || []).filter((x) => inRange(x.date, range));
  const linkedExp = (e) => (expenses || []).filter((x) => x.entryId === e.id);
  const res = {
    count: done.length,
    scheduledCount: inPeriod.length - done.length,
    gross: sum(done, (e) => money(e.gross)),
    discounts: sum(done, (e) => money(e.discount)),
    fees: sum(done, (e) => money(e.travelFee) + money(e.extraFees)),
    netExpected: sum(done, netOf),
    scheduledNet: sum(inPeriod.filter((e) => e.examDate > today), netOf),
    invoiced: sum(live.filter((e) => inRange(e.invoiceDate, range)), netOf),
    received: round2(live.reduce((s, e) => s + (e.payments || []).filter((p) => inRange(p.date, range)).reduce((t, p) => t + money(p.amount), 0), 0)),
    pending: sum(done, balanceOf),
    overdue: sum(done.filter((e) => statusOf(e, today) === 'vencido'), balanceOf),
    notInvoiced: sum(done.filter((e) => !e.invoiceDate), balanceOf),
    home: sum(done.filter((e) => e.mode === 'home'), netOf),
    homeCount: done.filter((e) => e.mode === 'home').length,
    expensesTotal: sum(exp, (x) => money(x.amount)),
    expensesPro: sum(exp, proValueOf),
    expensesPersonal: sum(exp, personalValueOf),
    expensesProPaid: sum(exp, (x) => round2(paidOf(x) * proPercentOf(x) / 100)),
    expensesProPending: sum(exp, (x) => round2((money(x.amount) - paidOf(x)) * proPercentOf(x) / 100)),
  };
  res.avgPerExam = res.count ? round2(res.netExpected / res.count) : 0;
  res.cashResult = round2(res.received - res.expensesProPaid);           // caixa: o que entrou − o que saiu (profissional)
  res.estimatedResult = round2(res.netExpected - res.expensesPro);        // resultado estimado da atividade (não é lucro contábil)
  res.byClinic = groupSum(done, (e) => (e.mode === 'home' ? 'home' : e.clinicId || ''), netOf);
  res.byProcedure = groupSum(done, (e) => e.procedureId || '', netOf);
  res.homeDetail = done.filter((e) => e.mode === 'home').map((e) => {
    const ex = linkedExp(e); const costs = round2(ex.reduce((s, x) => s + proValueOf(x), 0));
    return { id: e.id, net: netOf(e), costs, result: round2(netOf(e) - costs) };
  });
  return res;
}
function groupSum(list, keyFn, valFn) {
  const m = {};
  for (const x of list) { const k = keyFn(x); m[k] ||= { total: 0, count: 0 }; m[k].total = round2(m[k].total + valFn(x)); m[k].count++; }
  return m;
}

// ---------- previsão do mês ----------
/**
 * Previsão do faturamento do mês: realizado (exames até hoje) + estimativa dos dias que faltam.
 * Taxa diária = valor dos exames ÷ dias do histórico (últimos `windowDays` dias até ontem), separada em
 * dias úteis e fins de semana quando há histórico suficiente (≥ 8 semanas). Exames agendados aparecem à parte
 * e nunca somam duas vezes: a estimativa usa o maior entre os agendados e a estimativa por histórico.
 */
export function forecastMonth(entries, ym, today, { windowDays = 90, manual = null } = {}) {
  const { from, to } = monthRange(ym);
  const live = entries.filter((e) => !e.cancelled && e.examDate);
  const realized = round2(live.filter((e) => inRange(e.examDate, { from, to: today < to ? today : to })).reduce((s, e) => s + netOf(e), 0));
  const scheduled = round2(live.filter((e) => e.examDate > today && inRange(e.examDate, { from, to })).reduce((s, e) => s + netOf(e), 0));
  const remainingDays = [];
  if (today < to) for (let d = dateOf(today > from ? today : from), first = true; isoOf(d) <= to; d.setDate(d.getDate() + 1), first = false) {
    if (first && today >= from) continue; // hoje já conta no realizado
    remainingDays.push(isoOf(d));
  }
  const histEnd = new Date(dateOf(today)); histEnd.setDate(histEnd.getDate() - 1);
  const histStart = new Date(histEnd); histStart.setDate(histStart.getDate() - windowDays + 1);
  const hist = live.filter((e) => inRange(e.examDate, { from: isoOf(histStart), to: isoOf(histEnd) }));
  const firstDay = hist.length ? hist.map((e) => e.examDate).sort()[0] : null;
  const span = firstDay ? Math.round((histEnd - dateOf(firstDay)) / 86400000) + 1 : 0;
  const weekend = (iso) => [0, 6].includes(dateOf(iso).getDay());
  const daily = {};
  for (const e of hist) daily[e.examDate] = round2((daily[e.examDate] || 0) + netOf(e));
  let method, estimate = 0, uncertainty = 0, limited = false;
  if (span >= 56) {
    const days = { wk: 0, we: 0 }, tot = { wk: 0, we: 0 };
    for (let d = dateOf(firstDay); d <= histEnd; d.setDate(d.getDate() + 1)) { const k = weekend(isoOf(d)) ? 'we' : 'wk'; days[k]++; tot[k] += daily[isoOf(d)] || 0; }
    const rate = { wk: days.wk ? tot.wk / days.wk : 0, we: days.we ? tot.we / days.we : 0 };
    estimate = remainingDays.reduce((s, d) => s + rate[weekend(d) ? 'we' : 'wk'], 0);
    method = `Média por dia útil (${brl(rate.wk)}) e por fim de semana (${brl(rate.we)}) dos últimos ${span} dias × dias restantes do mês.`;
  } else if (span >= 14) {
    const rate = hist.reduce((s, e) => s + netOf(e), 0) / span;
    estimate = rate * remainingDays.length;
    method = `Média diária dos últimos ${span} dias (${brl(rate)}) × ${remainingDays.length} dias restantes.`;
  } else {
    limited = true;
    const rate = span ? hist.reduce((s, e) => s + netOf(e), 0) / span : 0;
    estimate = rate * remainingDays.length;
    method = span ? `Projeção simples: apenas ${span} dia(s) de histórico. Pouco confiável — informe uma estimativa manual se quiser.` : 'Sem histórico para projetar. Informe uma estimativa manual se quiser.';
  }
  if (span >= 14 && remainingDays.length) {
    const vals = []; for (let d = dateOf(firstDay); d <= histEnd; d.setDate(d.getDate() + 1)) vals.push(daily[isoOf(d)] || 0);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, vals.length - 1));
    uncertainty = round2(sd * Math.sqrt(remainingDays.length));
  }
  estimate = round2(estimate);
  const future = round2(Math.max(estimate, scheduled));
  const total = manual != null && manual !== '' ? round2(money(manual)) : round2(realized + future);
  return { ym, realized, scheduled, estimate, future, total, uncertainty, method, limited, remainingDays: remainingDays.length, historyDays: span, manual: manual != null && manual !== '' };
}

// ---------- cronômetro ----------
/** Sessões: [{start, end|null, pauses:[{start,end|null}]}] (timestamps em ms). */
export function workedMs(sessions, now = Date.now()) {
  let total = 0;
  for (const s of sessions || []) {
    const end = s.end || now;
    let paused = 0;
    for (const p of s.pauses || []) paused += Math.max(0, Math.min(p.end || now, end) - Math.max(p.start, s.start));
    total += Math.max(0, end - s.start - paused);
  }
  return total;
}
export function elapsedMs(sessions, now = Date.now()) {
  if (!sessions || !sessions.length) return 0;
  return Math.max(0, (sessions[sessions.length - 1].end || now) - sessions[0].start);
}
export const timerState = (sessions) => {
  const s = (sessions || [])[sessions?.length - 1];
  if (!s || s.end) return 'parado';
  const p = (s.pauses || [])[s.pauses.length - 1];
  return p && !p.end ? 'pausado' : 'contando';
};
export function startSession(work, now = Date.now()) {
  work.sessions ||= [];
  if (timerState(work.sessions) !== 'parado') return work;
  work.sessions.push({ start: now, end: null, pauses: [] });
  return work;
}
export function pauseSession(work, now = Date.now()) {
  if (timerState(work.sessions) === 'contando') work.sessions[work.sessions.length - 1].pauses.push({ start: now, end: null });
  return work;
}
export function resumeSession(work, now = Date.now()) {
  if (timerState(work.sessions) === 'pausado') { const s = work.sessions[work.sessions.length - 1]; s.pauses[s.pauses.length - 1].end = now; }
  return work;
}
export function stopSession(work, now = Date.now()) {
  const st = timerState(work.sessions);
  if (st === 'parado') return work;
  const s = work.sessions[work.sessions.length - 1];
  if (st === 'pausado') s.pauses[s.pauses.length - 1].end = now;
  s.end = now;
  return work;
}
export function fmtDuration(ms) {
  const t = Math.floor(ms / 1000), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return h ? `${h}h ${p2(m)}min` : `${m}min ${p2(s)}s`;
}

// ---------- produtividade ----------
/** rows: [{examId, examDate, finishedDate, workedMs, elapsedMs, clinicKey, procedureId, net, invoiced, received}] */
export function productivity(rows) {
  const done = rows.filter((r) => r.workedMs > 0);
  const ws = done.map((r) => r.workedMs).sort((a, b) => a - b);
  const total = ws.reduce((a, b) => a + b, 0);
  const median = ws.length ? (ws.length % 2 ? ws[(ws.length - 1) / 2] : (ws[ws.length / 2 - 1] + ws[ws.length / 2]) / 2) : 0;
  const hours = total / 3600000;
  const by = (key) => {
    const m = {};
    for (const r of done) { const k = key(r); m[k] ||= { count: 0, total: 0 }; m[k].count++; m[k].total += r.workedMs; }
    for (const k of Object.keys(m)) m[k].avg = m[k].total / m[k].count;
    return m;
  };
  const counts = (key) => { const m = {}; for (const r of rows) { const k = key(r); if (k) m[k] = (m[k] || 0) + 1; } return m; };
  const sum = (f) => round2(done.reduce((s, r) => s + (Number(r[f]) || 0), 0));
  return {
    count: rows.length, timed: done.length, totalMs: total, avgMs: done.length ? total / done.length : 0, medianMs: median,
    byProcedure: by((r) => r.procedureId || ''), byClinic: by((r) => r.clinicKey || ''),
    perDay: counts((r) => r.finishedDate), perWeek: counts((r) => r.finishedDate && weekKey(r.finishedDate)), perMonth: counts((r) => monthKey(r.finishedDate)),
    perHour: hours > 0 ? { expected: round2(sum('net') / hours), invoiced: round2(sum('invoiced') / hours), received: round2(sum('received') / hours) } : null,
  };
}

// ---------- filtros ----------
/**
 * f: {from,to, clinic ('home' = domiciliar), procedure, mode, status (situação financeira), examStatus (situação do laudo)}.
 * examStatusOf(entry) devolve 'draft'|'preliminary'|'final'|'deleted'.
 */
export function filterEntries(entries, f, today, examStatusOf = () => '') {
  return entries.filter((e) => {
    if ((f.from || f.to) && !inRange(e.examDate, f)) return false;
    if (f.mode && e.mode !== f.mode) return false;
    if (f.clinic) { if (f.clinic === 'home' ? e.mode !== 'home' : e.clinicId !== f.clinic) return false; }
    if (f.procedure && e.procedureId !== f.procedure) return false;
    if (f.status && statusOf(e, today) !== f.status) return false;
    if (f.examStatus && examStatusOf(e) !== f.examStatus) return false;
    return true;
  });
}

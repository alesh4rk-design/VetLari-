import test from 'node:test';
import assert from 'node:assert/strict';
import {
  priceOn, netOf, receivedOf, balanceOf, statusOf, changePrice, addPayment, summarize, forecastMonth, money,
  proValueOf, personalValueOf, fuelFill, fuelConsumption, workedMs, elapsedMs, startSession, pauseSession, resumeSession, stopSession, timerState, productivity,
} from '../js/finance-logic.js';

const prices = [
  { procedureId: 'abd', value: 150, from: '2026-01-01', to: '2026-10-31' },
  { procedureId: 'abd', value: 180, from: '2026-11-01', to: '' },
];

test('1/2. preços por clínica e por data: mudança futura não altera exames anteriores', () => {
  const clinicA = prices, clinicB = [{ procedureId: 'abd', value: 200, from: '2026-01-01' }];
  assert.equal(priceOn(clinicA, 'abd', '2026-10-10').value, 150);
  assert.equal(priceOn(clinicA, 'abd', '2026-11-05').value, 180);
  assert.equal(priceOn(clinicB, 'abd', '2026-10-10').value, 200);
  assert.equal(priceOn(clinicA, 'outro', '2026-10-10'), null);
  // o lançamento guarda o valor aplicado: mudar a tabela depois não muda o lançamento
  const entry = { gross: priceOn(clinicA, 'abd', '2026-10-10').value };
  clinicA[0].value = 999;
  assert.equal(entry.gross, 150);
});

test('3/4. domiciliar sem clínica, com deslocamento, desconto e despesas separadas', () => {
  const e = { id: 'h1', mode: 'home', gross: 250, travelFee: 40, discount: 20, examDate: '2026-10-10' };
  assert.equal(netOf(e), 270);
  const exp = [{ id: 'x1', date: '2026-10-10', amount: 30, use: 'professional', entryId: 'h1', status: 'pago' }];
  const s = summarize([e], exp, { from: '2026-10-01', to: '2026-10-31' }, '2026-10-20');
  assert.equal(s.home, 270); assert.equal(s.homeCount, 1);
  assert.deepEqual(s.homeDetail[0], { id: 'h1', net: 270, costs: 30, result: 240 });
});

test('5/6. faturamento pela data do exame; recebido pela data do recebimento', () => {
  const e1 = { id: 'a', gross: 150, examDate: '2026-09-28', payments: [{ amount: 150, date: '2026-10-05' }] };
  const e2 = { id: 'b', gross: 200, examDate: '2026-10-10', payments: [] };
  const oct = summarize([e1, e2], [], { from: '2026-10-01', to: '2026-10-31' }, '2026-10-20');
  assert.equal(oct.netExpected, 200);
  assert.equal(oct.received, 150);
  assert.equal(oct.pending, 200);
  const sep = summarize([e1, e2], [], { from: '2026-09-01', to: '2026-09-30' }, '2026-10-20');
  assert.equal(sep.netExpected, 150); assert.equal(sep.received, 0);
});

test('7. pagamento parcial atualiza o saldo e a situação', () => {
  const e = { id: 'p', gross: 300, examDate: '2026-10-01', invoiceDate: '2026-10-02', dueDate: '2026-10-30', payments: [] };
  assert.equal(statusOf(e, '2026-10-10'), 'faturado');
  addPayment(e, { amount: '100,00', date: '2026-10-05', method: 'Pix' }, 'pg1');
  assert.equal(receivedOf(e), 100); assert.equal(balanceOf(e), 200); assert.equal(statusOf(e, '2026-10-10'), 'parcial');
  assert.equal(statusOf(e, '2026-11-02'), 'vencido');
  addPayment(e, { amount: 200, date: '2026-10-20' }, 'pg2');
  assert.equal(balanceOf(e), 0); assert.equal(statusOf(e, '2026-11-02'), 'recebido');
  assert.throws(() => addPayment(e, { amount: 0, date: '2026-10-20' }, 'x'));
  assert.equal(statusOf({ ...e, cancelled: true }, '2026-10-10'), 'cancelado');
  assert.equal(statusOf({ gross: 100, examDate: '2026-12-01' }, '2026-10-10'), 'previsto');
  assert.equal(statusOf({ gross: 100, examDate: '2026-10-01' }, '2026-10-10'), 'aguardando');
});

test('alteração de preço exige motivo e guarda histórico', () => {
  const e = { gross: 150 };
  assert.throws(() => changePrice(e, 120, ''));
  changePrice(e, 120, 'Negociado excepcionalmente', 1);
  assert.equal(e.gross, 120); assert.deepEqual(e.priceHistory, [{ ts: 1, from: 150, to: 120, reason: 'Negociado excepcionalmente' }]);
});

test('8. previsão do mês: realizado + estimativa, agendado sem somar duas vezes', () => {
  const entries = [];
  for (let d = 1; d <= 60; d++) { const dt = new Date(2026, 7, d + 10); entries.push({ id: 'h' + d, gross: 100, examDate: dt.toISOString().slice(0, 10) }); }
  const today = '2026-10-15';
  entries.push({ id: 'agendado', gross: 500, examDate: '2026-10-25' });
  const f = forecastMonth(entries, '2026-10', today);
  const realized = entries.filter((e) => e.examDate >= '2026-10-01' && e.examDate <= today).reduce((s, e) => s + netOf(e), 0);
  assert.equal(f.realized, realized);
  assert.equal(f.scheduled, 500);
  assert.equal(f.total, Math.round((f.realized + Math.max(f.estimate, f.scheduled)) * 100) / 100);
  assert.ok(f.estimate > 0 && f.historyDays >= 14 && !f.limited, f.method);
  const fewDays = forecastMonth([{ id: 'x', gross: 100, examDate: '2026-10-14' }], '2026-10', today);
  assert.ok(fewDays.limited && /Pouco confiável|Sem histórico/.test(fewDays.method));
  assert.equal(forecastMonth(entries, '2026-10', today, { manual: '9.000,00' }).total, 9000);
});

test('despesas: profissional, pessoal e compartilhada (R$ 250 com 60% = 150 + 100)', () => {
  assert.equal(proValueOf({ amount: 250, use: 'shared', proPercent: 60 }), 150);
  assert.equal(personalValueOf({ amount: 250, use: 'shared', proPercent: 60 }), 100);
  assert.equal(proValueOf({ amount: 80, use: 'personal' }), 0);
  assert.equal(proValueOf({ amount: 80, use: 'professional' }), 80);
  const s = summarize([], [{ date: '2026-10-02', amount: 250, use: 'shared', proPercent: 60, status: 'pendente' }, { date: '2026-10-03', amount: 50, use: 'personal', status: 'pago' }], { from: '2026-10-01', to: '2026-10-31' }, '2026-10-10');
  assert.equal(s.expensesPro, 150); assert.equal(s.expensesPersonal, 150); assert.equal(s.expensesProPaid, 0); assert.equal(s.expensesProPending, 150);
});

test('combustível: valor total, preço por litro e consumo estimado entre abastecimentos', () => {
  assert.deepEqual(fuelFill({ liters: '40', pricePerLiter: '6,19' }), { liters: 40, pricePerLiter: 6.19, total: 247.6 });
  assert.equal(fuelFill({ liters: 40, total: 250 }).pricePerLiter, 6.25);
  const recs = [
    { id: 'a', date: '2026-10-01', fuel: { vehicle: 'Carro', km: 10000, liters: 40 } },
    { id: 'b', date: '2026-10-10', fuel: { vehicle: 'Carro', km: 10480, liters: 40 } },
    { id: 'c', date: '2026-10-12', fuel: { vehicle: 'Carro', liters: 20 } },
  ];
  const c = fuelConsumption(recs);
  assert.equal(c.get('a').kmPerL, null); assert.deepEqual([c.get('b').distance, c.get('b').kmPerL], [480, 12]);
  assert.equal(c.get('c').note, 'sem quilometragem');
  assert.equal(money('1.234,56'), 1234.56);
});

test('cronômetro: tempo por timestamps, pausas, retomada e nova sessão após reabrir', () => {
  const w = {};
  startSession(w, 0); assert.equal(timerState(w.sessions), 'contando');
  pauseSession(w, 10 * 60000); resumeSession(w, 15 * 60000); stopSession(w, 40 * 60000);
  assert.equal(workedMs(w.sessions), 35 * 60000); assert.equal(elapsedMs(w.sessions), 40 * 60000);
  startSession(w, 100 * 60000); stopSession(w, 110 * 60000); // reaberto: nova sessão, tempo anterior preservado
  assert.equal(w.sessions.length, 2); assert.equal(workedMs(w.sessions), 45 * 60000);
  startSession(w, 200 * 60000); startSession(w, 201 * 60000); // não abre duas sessões ao mesmo tempo
  assert.equal(w.sessions.length, 3);
  assert.equal(workedMs(w.sessions, 205 * 60000), 50 * 60000);
});

test('produtividade: média, mediana, por procedimento e receita por hora', () => {
  const rows = [
    { workedMs: 20 * 60000, procedureId: 'abd', clinicKey: 'c1', finishedDate: '2026-10-01', net: 150, invoiced: 150, received: 0 },
    { workedMs: 40 * 60000, procedureId: 'abd', clinicKey: 'c1', finishedDate: '2026-10-01', net: 150, invoiced: 0, received: 0 },
    { workedMs: 60 * 60000, procedureId: 'rep', clinicKey: 'home', finishedDate: '2026-10-08', net: 300, invoiced: 0, received: 300 },
  ];
  const p = productivity(rows);
  assert.equal(p.avgMs, 40 * 60000); assert.equal(p.medianMs, 40 * 60000); assert.equal(p.totalMs, 120 * 60000);
  assert.equal(p.byProcedure.abd.avg, 30 * 60000); assert.equal(p.perDay['2026-10-01'], 2);
  assert.deepEqual(p.perHour, { expected: 300, invoiced: 75, received: 150 });
});

test('15. permissões: só o perfil veterinário acessa o financeiro', async () => {
  const { can } = await import('../js/profiles.js');
  assert.ok(can({ role: 'vet' }, 'finance'));
  assert.ok(!can({ role: 'assistant' }, 'finance'));
});

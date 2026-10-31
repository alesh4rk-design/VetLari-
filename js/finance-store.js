// Armazenamento do financeiro (IndexedDB do perfil ativo): clínicas com tabelas de preço, procedimentos,
// lançamentos (um por laudo, id = id do laudo), despesas e categorias. Configurações em settings "finance".
import { dbAll, dbGet, dbPut, dbDel, getSetting, setSetting } from './local-storage.js';
import { uid } from './utils.js';
import { DEFAULT_PROCEDURES, DEFAULT_CATEGORIES } from './finance-logic.js';

/** Cadastra os procedimentos e as categorias iniciais uma única vez (depois são editáveis). */
export async function seedFinance() {
  if (await getSetting('finance-seeded', false)) return;
  if (!(await dbAll('procedures')).length) {
    let i = 0;
    for (const [name, category] of DEFAULT_PROCEDURES) await dbPut('procedures', { id: uid(), name, category, description: '', unit: 'por exame', active: true, order: i++ });
  }
  if (!(await dbAll('expenseCategories')).length) {
    let i = 0;
    for (const [name, group, fuel] of DEFAULT_CATEGORIES) await dbPut('expenseCategories', { id: uid(), name, group, fuel: !!fuel, active: true, order: i++ });
  }
  await setSetting('finance-seeded', true);
}

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.name).localeCompare(String(b.name), 'pt-BR');
export const listClinics = async () => (await dbAll('clinics')).sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
export const listProcedures = async () => (await dbAll('procedures')).sort(byOrder);
export const listCategories = async () => (await dbAll('expenseCategories')).sort(byOrder);
export const listEntries = () => dbAll('finEntries');
export const listExpenses = () => dbAll('expenses');
export const getEntry = (examId) => dbGet('finEntries', examId);
export const saveClinic = (c) => dbPut('clinics', { ...c, updatedAt: Date.now() });
export const saveProcedure = (p) => dbPut('procedures', p);
export const saveCategory = (c) => dbPut('expenseCategories', c);
export const saveExpense = (x) => dbPut('expenses', { ...x, updatedAt: Date.now() });
export const deleteExpense = (id) => dbDel('expenses', id);

/** Um único lançamento por laudo: o id é o do laudo, então salvar de novo atualiza, nunca duplica. */
export function saveEntry(e) {
  if (!e.examId) throw new Error('Lançamento sem laudo.');
  return dbPut('finEntries', { ...e, id: e.examId, updatedAt: Date.now() });
}

export async function getFinanceConfig() {
  return { homePrices: [], manualForecast: {}, allowPause: true, ...(await getSetting('finance', {})) };
}
export const saveFinanceConfig = (c) => setSetting('finance', c);
export const newId = uid;

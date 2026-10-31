// Persistência local em IndexedDB (rascunhos, laudos, pacientes, frases, modelos e configurações).
import { BACKUP_STORES, validateBackup } from './validation.js';

let dbName = 'vetlaudo';
const DB_VERSION = 3; // v2: bases de referências e de cálculos; v3: financeiro (clínicas, procedimentos, lançamentos, despesas)
const KEYED = { settings: 'key' };
let dbPromise;

/** Seleciona o banco do perfil ativo (cada perfil tem seus dados separados neste aparelho). */
export function useDatabase(name) { dbName = name; dbPromise = null; }

export function deleteDatabase(name) {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return resolve();
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) return reject(new Error('IndexedDB indisponível neste navegador.'));
      const req = indexedDB.open(dbName, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of BACKUP_STORES) {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: KEYED[s] || 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Falha ao abrir o armazenamento local.'));
    });
  }
  return dbPromise;
}

async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const st = tx.objectStore(store);
    let result;
    const r = fn(st);
    if (r) r.onsuccess = () => { result = r.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Operação cancelada.'));
  });
}

export const dbGet = (store, id) => run(store, 'readonly', (s) => s.get(id));
export const dbAll = (store) => run(store, 'readonly', (s) => s.getAll());
export const dbPut = (store, value) => run(store, 'readwrite', (s) => s.put(value));
export const dbDel = (store, id) => run(store, 'readwrite', (s) => s.delete(id));
export const dbClear = (store) => run(store, 'readwrite', (s) => s.clear());

export async function getSetting(key, fallback) {
  const row = await dbGet('settings', key);
  return row ? row.value : fallback;
}
export const setSetting = (key, value) => dbPut('settings', { key, value });

export async function exportBackup() {
  const stores = {};
  for (const s of BACKUP_STORES) stores[s] = await dbAll(s);
  return { app: 'vetlaudo', version: 1, exportedAt: new Date().toISOString(), stores };
}

/** mode: 'merge' (mantém o que existe e atualiza por id) ou 'replace' (apaga tudo antes). */
export async function importBackup(backup, mode = 'merge') {
  const err = validateBackup(backup);
  if (err) throw new Error(err);
  if (mode === 'replace') for (const s of BACKUP_STORES) await dbClear(s);
  let count = 0;
  for (const s of BACKUP_STORES) {
    for (const row of backup.stores[s] || []) { await dbPut(s, row); count++; }
  }
  return count;
}

export async function wipeAll() {
  for (const s of BACKUP_STORES) await dbClear(s);
}

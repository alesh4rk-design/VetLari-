// Perfis locais: cada pessoa usa o próprio perfil neste aparelho, com dados e imagens separados.
// IMPORTANTE: perfis e permissões são controles de organização/uso no aparelho. Não são segurança
// contra quem tem acesso ao aparelho; sem login em servidor não há como impor regras de forma inviolável.
import { uid } from './utils.js';

const KEY = 'vetlaudo.profiles.v1';
export const ROLES = { vet: 'Médico(a)-veterinário(a)', assistant: 'Auxiliar (sem assinatura)' };
const PERMS = {
  vet: ['edit', 'prelim', 'finalize', 'revise', 'export'],
  assistant: ['edit', 'prelim', 'export'],
};

export const can = (profile, action) => !!profile && (PERMS[profile.role] || []).includes(action);

let memory = null; // reserva caso o armazenamento do navegador esteja bloqueado

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* usa memória */ }
  return memory;
}
function write(reg) {
  memory = reg;
  try { localStorage.setItem(KEY, JSON.stringify(reg)); } catch { /* mantém só em memória */ }
}

/** Garante ao menos um perfil. O perfil inicial reaproveita o banco "vetlaudo" criado na Fase 1. */
export function loadRegistry() {
  let reg = read();
  if (!reg || !Array.isArray(reg.profiles) || !reg.profiles.length) {
    reg = { profiles: [{ id: 'default', name: 'Meu perfil', role: 'vet', db: 'vetlaudo', createdAt: Date.now() }], active: 'default' };
    write(reg);
  }
  if (!reg.profiles.some((p) => p.id === reg.active)) reg.active = reg.profiles[0].id;
  return reg;
}

export const getActive = () => { const r = loadRegistry(); return r.profiles.find((p) => p.id === r.active); };
export const listProfiles = () => loadRegistry().profiles;

export function setActive(id) {
  const reg = loadRegistry();
  if (!reg.profiles.some((p) => p.id === id)) throw new Error('Perfil inexistente.');
  reg.active = id; write(reg);
}

export function createProfile({ name, role }) {
  const clean = String(name || '').trim();
  if (!clean) throw new Error('Informe o nome do perfil.');
  if (clean.length > 80) throw new Error('O nome do perfil é muito longo.');
  if (!ROLES[role]) throw new Error('Função inválida.');
  const reg = loadRegistry();
  if (reg.profiles.some((p) => p.name.toLowerCase() === clean.toLowerCase())) throw new Error('Já existe um perfil com esse nome.');
  const id = uid();
  const profile = { id, name: clean, role, db: `vetlaudo-${id}`, createdAt: Date.now() };
  reg.profiles.push(profile); write(reg);
  return profile;
}

export function removeProfile(id) {
  const reg = loadRegistry();
  if (reg.profiles.length <= 1) throw new Error('Não é possível excluir o único perfil.');
  const target = reg.profiles.find((p) => p.id === id);
  reg.profiles = reg.profiles.filter((p) => p.id !== id);
  if (reg.active === id) reg.active = reg.profiles[0].id;
  write(reg);
  return target;
}

// Marca, nesta sessão do navegador, que a pessoa já escolheu o perfil (evita perguntar a cada tela).
export const chosenThisSession = () => { try { return sessionStorage.getItem('vetlaudo.chosen') === '1'; } catch { return false; } };
export const markChosen = () => { try { sessionStorage.setItem('vetlaudo.chosen', '1'); } catch { /* ignora */ } };

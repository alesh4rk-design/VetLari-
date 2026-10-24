// Tela de perfis: cada pessoa escolhe (ou cria) o próprio perfil. Os dados ficam somente neste aparelho.
import { esc, toast } from './utils.js';
import { listProfiles, getActive, setActive, createProfile, removeProfile, markChosen, ROLES } from './profiles.js';
import { deleteDatabase } from './local-storage.js';
import { confirmDialog } from './ui.js';

export function renderProfilePicker(root, { onChosen }) {
  const draw = () => {
    const active = getActive();
    const profiles = listProfiles();
    root.innerHTML = `<div class="page-head"><div><h1>Quem está usando?</h1>
      <p class="muted">Cada perfil tem seus próprios pacientes, laudos, modelos, frases e imagens. </p></div></div>
      <div class="alert info">💾 <strong>O VetLaudo usa o armazenamento do próprio computador ou celular.</strong> Tudo fica salvo só neste navegador, neste aparelho: nada é enviado para a internet e os dados não aparecem em outro aparelho. Faça backups em Configurações.</div>
      <div class="grid g2">${profiles.map((p) => `<div class="card"><h2>${esc(p.name)}</h2><p class="muted small">${esc(ROLES[p.role])}${p.id === active.id ? ' · último usado' : ''}</p>
        <div class="row"><button class="btn primary" data-act="enter" data-id="${p.id}">Entrar</button>
        ${profiles.length > 1 ? `<button class="btn danger sm" data-act="del" data-id="${p.id}">Excluir perfil</button>` : ''}</div></div>`).join('')}</div>
      <form class="card" id="np" novalidate><h2>Novo perfil</h2><div class="grid g2">
        <div class="field"><label for="np-name">Nome *</label><input id="np-name" maxlength="80"></div>
        <div class="field"><label for="np-role">Função</label><select id="np-role">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></div></div>
      <p class="muted small">Atenção: os perfis organizam o uso neste aparelho, mas não protegem os dados de quem tiver acesso ao aparelho desbloqueado. Mantenha a tela bloqueada com senha.</p>
      <button class="btn primary" type="submit">Criar perfil</button></form>`;
  };
  draw();
  root.onclick = async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'enter') { setActive(b.dataset.id); markChosen(); onChosen(); }
    if (b.dataset.act === 'del') {
      const target = listProfiles().find((p) => p.id === b.dataset.id);
      if (await confirmDialog(`Excluir o perfil "${target.name}" e TODOS os dados dele (pacientes, laudos, imagens) deste aparelho? Não há como desfazer. Faça um backup antes, se precisar.`, { ok: 'Excluir perfil', danger: true })) {
        try { const removed = removeProfile(target.id); await deleteDatabase(removed.db); toast('Perfil excluído.'); draw(); }
        catch (err) { toast(err.message, 'error'); }
      }
    }
  };
  root.onsubmit = (e) => {
    e.preventDefault();
    try {
      const p = createProfile({ name: root.querySelector('#np-name').value, role: root.querySelector('#np-role').value });
      setActive(p.id); markChosen(); onChosen();
    } catch (err) { toast(err.message, 'error'); }
  };
}

// Configurações: dados profissionais, cabeçalho/rodapé, tipografia, imagens, tema, backup e dados locais.
import { esc, toast, download, todayISO, formatBytes } from './utils.js';
import { saveSettings } from './templates.js';
import { exportBackup, importBackup, wipeAll, dbAll, dbDel } from './local-storage.js';
import { confirmDialog } from './ui.js';

export function applyTheme(theme) { document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark'; }

function readLogo(file) {
  return new Promise((resolve, reject) => {
    if (!['image/png', 'image/jpeg'].includes(file.type)) return reject(new Error('O logotipo deve ser PNG ou JPEG.'));
    if (file.size > 2 * 1048576) return reject(new Error('O logotipo deve ter até 2 MB.'));
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 500 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Não foi possível ler o logotipo.'));
      img.src = r.result;
    };
    r.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
    r.readAsDataURL(file);
  });
}

export function renderSettings(view, settings, onChange) {
  const pr = settings.professional;
  const inp = (id, label, v, extra = '') => `<div class="field"><label for="${id}">${label}</label><input id="${id}" value="${esc(v)}" ${extra}></div>`;
  view.innerHTML = `<div class="page-head"><h1>Configurações</h1></div>
  <form class="card" id="sf"><h2>Identificação profissional</h2><div class="grid g2">
    ${inp('s-name', 'Nome do(a) médico(a)-veterinário(a)', pr.name)}${inp('s-service', 'Nome do serviço / clínica', pr.service)}
    ${inp('s-crmv', 'CRMV (número)', pr.crmv)}${inp('s-uf', 'UF do CRMV', pr.uf, 'maxlength="2" style="text-transform:uppercase"')}${inp('s-contact', 'Contato (telefone/e-mail)', pr.contact)}</div>
    <h2>Documento</h2><div class="grid g2">${inp('s-head', 'Texto adicional do cabeçalho', settings.headerText)}${inp('s-foot', 'Texto do rodapé', settings.footerText)}
    <div class="field"><label for="s-font">Tipografia</label><select id="s-font"><option value="sans" ${settings.font === 'sans' ? 'selected' : ''}>Sem serifa (Arial)</option><option value="serif" ${settings.font === 'serif' ? 'selected' : ''}>Com serifa (Times)</option></select></div>
    <div class="field"><label for="s-size">Tamanho da fonte (pt)</label><select id="s-size">${[10, 11, 12].map((n) => `<option ${Number(settings.fontSize) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
    <div class="field"><label for="s-logo">Logotipo (PNG ou JPEG, até 2 MB)</label><input id="s-logo" type="file" accept="image/png,image/jpeg">
      ${settings.logo ? `<div style="margin-top:8px"><img src="${esc(settings.logo)}" alt="Logotipo atual" style="max-height:60px;background:#fff;padding:4px;border-radius:6px"> <button type="button" class="btn sm" id="rmlogo">Remover</button></div>` : ''}</div>
    <h2>Imagens</h2><div class="grid g2"><label class="check"><input type="checkbox" id="s-comp" ${settings.compress ? 'checked' : ''}> Comprimir imagens ao importar</label>
    <div class="field"><label for="s-q">Qualidade JPEG (0,5 a 1)</label><input id="s-q" type="number" min="0.5" max="1" step="0.05" value="${settings.jpegQuality}"></div>
    <div class="field"><label for="s-px">Tamanho máximo (pixels do maior lado)</label><input id="s-px" type="number" min="800" max="4000" step="100" value="${settings.maxImagePx}"></div>
    <div class="field"><label for="s-mb">Limite por arquivo (MB)</label><input id="s-mb" type="number" min="1" max="50" value="${settings.maxImageMB}"></div></div>
    <h2>Aparência</h2><div class="field" style="max-width:260px"><label for="s-theme">Tema</label><select id="s-theme"><option value="dark" ${settings.theme !== 'light' ? 'selected' : ''}>Escuro</option><option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Claro</option></select></div>
    <button class="btn primary" type="submit">Salvar configurações</button></form>
  <div class="card"><h2>Backup e dados deste dispositivo</h2>
    <p class="muted small">Os dados ficam apenas neste navegador. Faça backups regulares: limpar os dados do navegador apaga tudo. O arquivo de backup contém dados clínicos e pessoais — guarde-o com cuidado.</p>
    <div class="row"><button class="btn" id="bk">Exportar backup</button><button class="btn" id="rs">Restaurar backup</button><input type="file" id="rsf" accept="application/json,.json" style="display:none"></div></div>
  <div class="card"><h2>Armazenamento neste aparelho</h2><p class="muted small" id="storinfo">Verificando…</p></div>
  <div class="card"><h2>Retenção e exclusão</h2><div class="grid g2"><div class="field"><label for="ret">Excluir laudos finalizados com mais de (dias)</label><input id="ret" type="number" min="1" placeholder="Ex.: 365"></div></div>
    <div class="row"><button class="btn danger" id="apply-ret">Aplicar política agora</button><button class="btn danger" id="wipe">Apagar todos os dados deste dispositivo</button></div></div>`;
  (async () => {
    const el = view.querySelector('#storinfo');
    try {
      const est = await navigator.storage.estimate();
      const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
      el.textContent = `Usado: ${formatBytes(est.usage || 0)} de ${formatBytes(est.quota || 0)} disponíveis. Armazenamento protegido contra limpeza automática: ${persisted ? 'sim' : 'não garantido (faça backups)'}.`;
    } catch { el.textContent = 'Não foi possível medir o armazenamento neste navegador.'; }
  })();
  view.querySelector('#sf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = (id) => view.querySelector('#' + id).value;
    const q = Number(v('s-q')), px = Number(v('s-px')), mb = Number(v('s-mb'));
    if (!(q >= 0.5 && q <= 1) || !(px >= 800 && px <= 4000) || !(mb >= 1 && mb <= 50)) return toast('Revise os valores de qualidade, tamanho e limite.', 'error');
    const next = { ...settings, professional: { name: v('s-name').trim(), service: v('s-service').trim(), crmv: v('s-crmv').trim(), uf: v('s-uf').trim().toUpperCase(), contact: v('s-contact').trim() },
      headerText: v('s-head').trim(), footerText: v('s-foot').trim(), font: v('s-font'), fontSize: Number(v('s-size')),
      compress: view.querySelector('#s-comp').checked, jpegQuality: q, maxImagePx: px, maxImageMB: mb, theme: v('s-theme') };
    try { await saveSettings(next); applyTheme(next.theme); onChange(next); toast('Configurações salvas.', 'success'); }
    catch { toast('Não foi possível salvar as configurações.', 'error'); }
  });
  view.querySelector('#s-logo').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const next = { ...settings, logo: await readLogo(f) }; await saveSettings(next); onChange(next); renderSettings(view, next, onChange); toast('Logotipo salvo.', 'success'); }
    catch (err) { toast(err.message, 'error'); }
  });
  const rm = view.querySelector('#rmlogo');
  if (rm) rm.onclick = async () => { const next = { ...settings, logo: '' }; await saveSettings(next); onChange(next); renderSettings(view, next, onChange); };
  view.querySelector('#bk').onclick = async () => {
    try { download(new Blob([JSON.stringify(await exportBackup())], { type: 'application/json' }), `VetLaudo_backup_${todayISO()}.json`); toast('Backup gerado.', 'success'); }
    catch (err) { toast(`Falha ao gerar backup: ${err.message}`, 'error'); }
  };
  view.querySelector('#rs').onclick = () => view.querySelector('#rsf').click();
  view.querySelector('#rsf').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const replace = await confirmDialog('Restaurar este backup SUBSTITUINDO todos os dados atuais? Escolha "Cancelar" para apenas mesclar (mantém o que já existe).', { ok: 'Substituir tudo', danger: true });
      const n = await importBackup(data, replace ? 'replace' : 'merge');
      toast(`${n} registros restaurados. Recarregando…`, 'success'); setTimeout(() => location.reload(), 900);
    } catch (err) { toast(err instanceof SyntaxError ? 'Arquivo de backup inválido.' : err.message, 'error'); }
  });
  view.querySelector('#apply-ret').onclick = async () => {
    const days = Number(view.querySelector('#ret').value);
    if (!(days >= 1)) return toast('Informe o número de dias.', 'error');
    const limit = Date.now() - days * 86400000;
    const old = (await dbAll('exams')).filter((x) => x.status === 'final' && (x.finalizedAt || x.updatedAt) < limit);
    if (!old.length) return toast('Nenhum laudo finalizado além do prazo.');
    if (await confirmDialog(`Excluir ${old.length} laudo(s) finalizado(s) com mais de ${days} dias? Faça um backup antes. Esta ação não pode ser desfeita.`, { ok: 'Excluir', danger: true })) {
      for (const x of old) await dbDel('exams', x.id);
      toast(`${old.length} laudo(s) excluído(s).`, 'success');
    }
  };
  view.querySelector('#wipe').onclick = async () => {
    if (await confirmDialog('Apagar TODOS os dados deste dispositivo (pacientes, laudos, frases, modelos e configurações)? Não há como desfazer.', { ok: 'Apagar tudo', danger: true })) {
      await wipeAll(); toast('Dados apagados. Recarregando…'); setTimeout(() => location.reload(), 800);
    }
  };
}

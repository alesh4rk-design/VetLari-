// Configurações: dados profissionais, cabeçalho/rodapé, tipografia, imagens, tema, backup e dados locais.
import { esc, toast, download, todayISO, formatBytes } from './utils.js';
import { APP_VERSION } from './version.js';
import { saveSettings } from './templates.js';
import { exportBackup, importBackup, wipeAll, dbAll, dbDel, setSetting } from './local-storage.js';
import { confirmDialog, openModal } from './ui.js';

/** Quadro para desenhar a assinatura com o dedo, caneta ou mouse. Devolve PNG com fundo transparente. */
function drawSignature() {
  const m = openModal(`<h2>Desenhar assinatura</h2><p class="muted small">Assine no quadro com o dedo, caneta ou mouse.</p>
    <canvas id="sigpad" width="600" height="200" style="width:100%;max-width:600px;background:#fff;border-radius:8px;touch-action:none;cursor:crosshair"></canvas>
    <div class="row end" style="margin-top:10px"><button type="button" class="btn" data-x="clear">Limpar</button><button type="button" class="btn" data-x="cancel">Cancelar</button><button type="button" class="btn primary" data-x="ok">Salvar assinatura</button></div>`, { label: 'Desenhar assinatura' });
  const c = m.el.querySelector('#sigpad'), g = c.getContext('2d');
  g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#111';
  let drawing = false, used = false;
  const pt = (e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
  c.addEventListener('pointerdown', (e) => { drawing = true; used = true; c.setPointerCapture(e.pointerId); g.beginPath(); g.moveTo(...pt(e)); });
  c.addEventListener('pointermove', (e) => { if (!drawing) return; g.lineTo(...pt(e)); g.stroke(); });
  ['pointerup', 'pointercancel'].forEach((ev) => c.addEventListener(ev, () => { drawing = false; }));
  m.el.querySelector('[data-x=clear]').onclick = () => { g.clearRect(0, 0, c.width, c.height); used = false; };
  m.el.querySelector('[data-x=cancel]').onclick = () => m.close(null);
  m.el.querySelector('[data-x=ok]').onclick = () => { if (!used) return toast('Assine no quadro antes de salvar.', 'error'); m.close(c.toDataURL('image/png')); };
  return m.closed.then((v) => v || null);
}

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
  const logoField = (key, label) => `<div class="field"><label for="s-${key}">${label}</label><input id="s-${key}" type="file" accept="image/png,image/jpeg">
      ${settings[key] ? `<div style="margin-top:8px"><img src="${esc(settings[key])}" alt="${esc(label)}" style="max-height:60px;background:#fff;padding:4px;border-radius:6px"> <button type="button" class="btn sm" data-rmlogo="${key}">Remover</button></div>` : ''}<div class="hint">PNG ou JPEG, até 2 MB.</div></div>`;
  const inp = (id, label, v, extra = '') => `<div class="field"><label for="${id}">${label}</label><input id="${id}" value="${esc(v)}" ${extra}></div>`;
  view.innerHTML = `<div class="page-head"><h1>Configurações</h1></div>
  <div class="card" id="logos"><h2>Logotipos do laudo</h2><p class="muted small">Escolha a imagem (PNG ou JPG): ela é salva na hora e aparece no topo do PDF e do Word.</p>
    <div class="grid g2">${logoField('logo', 'Logotipo 1 — serviço (aparece à esquerda no topo)')}${logoField('logo2', 'Logotipo 2 — clínica (aparece à direita no topo)')}</div></div>
  <div class="card" id="assinatura"><h2>Assinatura</h2>
    <p class="muted small">A imagem da sua assinatura aparece acima do quadro "Assinado eletronicamente por" <strong>somente nos laudos finalizados</strong> (rascunhos e preliminares nunca saem assinados). Use fundo branco ou transparente. Isto não substitui a assinatura digital com certificado ICP-Brasil.</p>
    ${settings.signatureImage ? `<div style="margin:8px 0"><img src="${esc(settings.signatureImage)}" alt="Sua assinatura" style="max-height:70px;background:#fff;padding:6px;border-radius:6px"></div>` : '<p class="small"><strong>Nenhuma assinatura cadastrada.</strong></p>'}
    <div class="row"><button type="button" class="btn" id="sig-draw">Desenhar assinatura</button><label class="btn" for="s-sig">Enviar imagem (PNG/JPG)</label><input id="s-sig" type="file" accept="image/png,image/jpeg" hidden>
    ${settings.signatureImage ? '<button type="button" class="btn danger sm" id="sig-rm">Remover</button>' : ''}</div></div>
  <form class="card" id="sf"><h2>Identificação profissional</h2><div class="grid g2">
    ${inp('s-name', 'Nome do(a) médico(a)-veterinário(a)', pr.name)}${inp('s-service', 'Nome do serviço / clínica', pr.service)}
    ${inp('s-crmv', 'CRMV (número)', pr.crmv)}${inp('s-uf', 'UF do CRMV', pr.uf, 'maxlength="2" style="text-transform:uppercase"')}${inp('s-contact', 'Contato (telefone/e-mail)', pr.contact)}</div>
    <h2>Documento</h2><div class="grid g2">${inp('s-head', 'Texto adicional do cabeçalho', settings.headerText)}${inp('s-foot', 'Texto do rodapé', settings.footerText)}
    <div class="field"><label for="s-font">Tipografia</label><select id="s-font"><option value="sans" ${settings.font === 'sans' ? 'selected' : ''}>Sem serifa (Arial)</option><option value="serif" ${settings.font === 'serif' ? 'selected' : ''}>Com serifa (Times)</option></select></div>
    <div class="field"><label for="s-size">Tamanho da fonte (pt)</label><select id="s-size">${[10, 11, 12].map((n) => `<option ${Number(settings.fontSize) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
    <div class="field"><label for="s-after">Texto fixo após a conclusão</label><textarea id="s-after" rows="3">${esc(settings.afterConclusion || '')}</textarea></div>
    <label class="check"><input type="checkbox" id="s-list" ${settings.impressionAsList !== false ? 'checked' : ''}> Conclusão em lista de itens (um por linha)</label>
    <h2>Imagens</h2><div class="grid g2"><label class="check"><input type="checkbox" id="s-comp" ${settings.compress ? 'checked' : ''}> Comprimir imagens ao importar</label>
    <div class="field"><label for="s-q">Qualidade JPEG (0,5 a 1)</label><input id="s-q" type="number" min="0.5" max="1" step="0.05" value="${settings.jpegQuality}"></div>
    <div class="field"><label for="s-px">Tamanho máximo (pixels do maior lado)</label><input id="s-px" type="number" min="800" max="4000" step="100" value="${settings.maxImagePx}"></div>
    <div class="field"><label for="s-mb">Limite por arquivo (MB)</label><input id="s-mb" type="number" min="1" max="50" value="${settings.maxImageMB}"></div></div>
    <h2>Aparência</h2><div class="field" style="max-width:260px"><label for="s-theme">Tema</label><select id="s-theme"><option value="dark" ${settings.theme !== 'light' ? 'selected' : ''}>Escuro</option><option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Claro</option></select></div>
    <button class="btn primary" type="submit">Salvar configurações</button></form>
  <div class="card" id="backup"><h2>Backup e dados deste dispositivo</h2>
    <div class="alert info">💾 <strong>O VetLaudo usa o armazenamento do próprio computador ou celular.</strong> Laudos, pacientes, frases e imagens ficam salvos só neste navegador, neste aparelho: nada é enviado para a internet e não aparece em outro aparelho. Para não perder nada, exporte um backup e guarde o arquivo (pen drive, Google Drive, e-mail).</div>
    <p class="muted small">Os dados ficam apenas neste navegador. Faça backups regulares: limpar os dados do navegador apaga tudo. O arquivo de backup contém dados clínicos e pessoais — guarde-o com cuidado.</p>
    <div class="row"><button class="btn" id="bk">Exportar backup</button><button class="btn" id="rs">Restaurar backup</button><input type="file" id="rsf" accept="application/json,.json" style="display:none"></div></div>
  <div class="card"><h2>Sobre</h2><p class="small">VetLaudo versão <strong>${esc(APP_VERSION)}</strong>. Se uma novidade não aparecer, abra a página de atualização: <a href="atualizar.html"><strong>Atualizar o VetLaudo</strong></a> (limpa só a cópia antiga do aplicativo; seus laudos não são apagados). <strong>Não limpe os dados do site</strong> pelo navegador: isso apaga os laudos deste aparelho.</p></div>
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
      headerText: v('s-head').trim(), footerText: v('s-foot').trim(), afterConclusion: v('s-after').trim(), impressionAsList: view.querySelector('#s-list').checked, font: v('s-font'), fontSize: Number(v('s-size')),
      compress: view.querySelector('#s-comp').checked, jpegQuality: q, maxImagePx: px, maxImageMB: mb, theme: v('s-theme') };
    try { await saveSettings(next); applyTheme(next.theme); onChange(next); toast('Configurações salvas.', 'success'); }
    catch { toast('Não foi possível salvar as configurações.', 'error'); }
  });
  for (const key of ['logo', 'logo2']) {
    view.querySelector(`#s-${key}`).addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { const next = { ...settings, [key]: await readLogo(f) }; await saveSettings(next); onChange(next); renderSettings(view, next, onChange); toast('Logotipo salvo.', 'success'); }
      catch (err) { toast(err.message, 'error'); }
    });
  }
  const saveSig = async (img) => { const next = { ...settings, signatureImage: img }; await saveSettings(next); onChange(next); renderSettings(view, next, onChange); toast(img ? 'Assinatura salva.' : 'Assinatura removida.', 'success'); };
  view.querySelector('#s-sig').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { await saveSig(await readLogo(f)); } catch (err) { toast(err.message.replace('logotipo', 'imagem da assinatura').replace('O logotipo', 'A imagem'), 'error'); }
  });
  const rm = view.querySelector('#sig-rm'); if (rm) rm.onclick = () => saveSig('');
  view.querySelector('#sig-draw').onclick = async () => { const img = await drawSignature(); if (img) await saveSig(img); };
  view.querySelectorAll('[data-rmlogo]').forEach((btn) => { btn.onclick = async () => { const next = { ...settings, [btn.dataset.rmlogo]: '' }; await saveSettings(next); onChange(next); renderSettings(view, next, onChange); }; });
  view.querySelector('#bk').onclick = async () => {
    try { download(new Blob([JSON.stringify(await exportBackup())], { type: 'application/json' }), `VetLaudo_backup_${todayISO()}.json`); await setSetting('last-backup', Date.now()); toast('Backup gerado.', 'success'); }
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

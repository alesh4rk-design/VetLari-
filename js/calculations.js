// Calculadoras definidas pela veterinária (fórmula, variáveis e unidades). Nada vem pronto e nenhuma
// unidade é convertida ou deduzida automaticamente.
import { uid, esc, toast, download, todayISO } from './utils.js';
import { dbAll, dbPut, dbDel } from './local-storage.js';
import { openModal, confirmDialog, alertList } from './ui.js';
import { norm, validateCalculation, runCalculation } from './calc-logic.js';
import { parseFormula, formulaVariables } from './formula.js';

export const listCalculations = async () => (await dbAll('calculations')).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
const blank = () => ({ id: uid(), name: '', description: '', formula: '', variables: [], resultLabel: '', resultUnit: '', decimals: 2 });

function form(calc) {
  const c = JSON.parse(JSON.stringify(calc));
  const m = openModal('<div id="cf"></div>', { wide: true, label: 'Cálculo' });
  const box = m.el.querySelector('#cf');
  const draw = () => {
    box.innerHTML = `<h2>${calc.name ? 'Editar cálculo' : 'Novo cálculo'}</h2>
      <p class="muted small">Você define a fórmula, as variáveis e as unidades. Operadores: + − * / ^ ( ), constante pi, funções sqrt() e abs(). Exemplo: <code>(L*W*H)*0.523</code>. O sistema não confere se a fórmula é clinicamente adequada: a responsabilidade é sua.</p>
      <div class="grid g2"><div class="field"><label for="c-name">Nome do cálculo *</label><input id="c-name" data-c="name" value="${esc(c.name)}"></div>
      <div class="field"><label for="c-desc">Descrição / fonte da fórmula</label><input id="c-desc" data-c="description" value="${esc(c.description)}"></div>
      <div class="field"><label for="c-res">Nome do resultado *</label><input id="c-res" data-c="resultLabel" value="${esc(c.resultLabel)}" placeholder="Ex.: Volume"></div>
      <div class="field"><label for="c-ru">Unidade do resultado *</label><input id="c-ru" data-c="resultUnit" value="${esc(c.resultUnit)}" placeholder="Ex.: cm³"></div>
      <div class="field"><label for="c-dec">Casas decimais (0 a 6)</label><input id="c-dec" data-c="decimals" type="number" min="0" max="6" value="${esc(c.decimals)}"></div></div>
      <div class="field"><label for="c-f">Fórmula *</label><input id="c-f" data-c="formula" value="${esc(c.formula)}" placeholder="Ex.: (L*W*H)*0.523"></div>
      <div class="row" style="margin-bottom:8px"><button type="button" class="btn sm" data-x="detect">Detectar variáveis da fórmula</button></div>
      ${c.variables.map((v, i) => `<div class="mrow"><input class="m-small" data-v="${i}" data-k="name" value="${esc(v.name)}" aria-label="Nome da variável" placeholder="Variável">
        <input class="m-label" data-v="${i}" data-k="label" value="${esc(v.label)}" aria-label="Descrição da variável" placeholder="Descrição (igual ao nome da medida nos laudos)">
        <input class="m-small" data-v="${i}" data-k="unit" value="${esc(v.unit)}" aria-label="Unidade da variável" placeholder="Unidade"></div>`).join('')}
      <div id="cerr"></div><div class="row end"><button type="button" class="btn" data-x="cancel">Cancelar</button><button type="button" class="btn primary" data-x="save">Salvar cálculo</button></div>`;
  };
  draw();
  box.addEventListener('input', (e) => {
    if (e.target.dataset.c) c[e.target.dataset.c] = e.target.value;
    if (e.target.dataset.v !== undefined) c.variables[Number(e.target.dataset.v)][e.target.dataset.k] = e.target.value;
  });
  return new Promise((resolve) => {
    box.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-x]'); if (!b) return;
      if (b.dataset.x === 'cancel') return m.close(null);
      if (b.dataset.x === 'detect') {
        try {
          const names = formulaVariables(parseFormula(c.formula));
          c.variables = names.map((n) => c.variables.find((v) => v.name === n) || { name: n, label: '', unit: '' }); draw();
        } catch (err) { box.querySelector('#cerr').innerHTML = alertList('Fórmula', [err.message], 'error'); }
      }
      if (b.dataset.x === 'save') {
        c.decimals = Number(c.decimals);
        const errs = validateCalculation(c);
        if (errs.length) { box.querySelector('#cerr').innerHTML = alertList('Corrija:', errs, 'error'); return; }
        await dbPut('calculations', { ...c, name: c.name.trim(), updatedAt: Date.now() }); m.close(c); toast('Cálculo salvo.', 'success');
      }
    });
    m.closed.then(resolve);
  });
}

export async function renderCalculations(view) {
  let all = await listCalculations();
  const draw = () => {
    view.querySelector('#clist').innerHTML = all.length ? all.map((c) => `<div class="phrase card"><strong>${esc(c.name)}</strong>
      <div class="txt">${esc(c.description)}\nFórmula: ${esc(c.formula)}\nResultado: ${esc(c.resultLabel)} (${esc(c.resultUnit)}), ${esc(c.decimals)} casa(s)\nVariáveis: ${c.variables.map((v) => `${esc(v.name)} = ${esc(v.label || v.name)} [${esc(v.unit)}]`).join('; ')}</div>
      <div class="row"><button class="btn sm" data-act="edit" data-id="${c.id}">Editar</button><button class="btn sm danger" data-act="del" data-id="${c.id}">Excluir</button></div></div>`).join('')
      : '<div class="card empty">Nenhum cálculo cadastrado. Clique em "Novo cálculo".</div>';
  };
  view.innerHTML = `<div class="page-head"><div><h1>Bases técnicas</h1><p class="muted">Referências e cálculos cadastrados por você. O sistema não traz valores nem fórmulas prontos.</p></div></div>
    <nav class="steps" aria-label="Bases"><a class="btn sm" href="#/referencias" style="align-self:center">Referências</a><button aria-current="step" disabled>Cálculos</button></nav>
    <div class="row" style="margin-bottom:12px"><button class="btn primary" data-act="new">Novo cálculo</button><button class="btn" data-act="export">Exportar JSON</button></div><div id="clist"></div>`;
  draw();
  view.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const c = all.find((x) => x.id === b.dataset.id);
    const reload = async () => { all = await listCalculations(); draw(); };
    if (b.dataset.act === 'new') { if (await form(blank())) await reload(); }
    else if (b.dataset.act === 'edit') { if (await form(c)) await reload(); }
    else if (b.dataset.act === 'del' && await confirmDialog(`Excluir o cálculo "${c.name}"? Resultados já inseridos em laudos não mudam.`, { ok: 'Excluir', danger: true })) { await dbDel('calculations', c.id); await reload(); }
    else if (b.dataset.act === 'export') download(new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' }), `VetLaudo_calculos_${todayISO()}.json`);
  });
}

/** Janela usada no laudo: escolhe o cálculo, preenche variáveis (sugere a partir das medidas da estrutura) e devolve a medida calculada. */
export function openCalculator(section, calcs) {
  if (!calcs.length) { toast('Nenhum cálculo cadastrado. Cadastre em Bases técnicas → Cálculos.', 'error'); return Promise.resolve(null); }
  const m = openModal(`<h2>Calcular — ${esc(section.title)}</h2>
    <div class="field"><label for="k-sel">Cálculo</label><select id="k-sel">${calcs.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
    <div id="k-vars"></div><div id="k-res"></div>
    <div class="row end"><button class="btn" data-x="cancel">Cancelar</button><button class="btn" data-x="calc">Calcular</button><button class="btn primary" data-x="add" disabled>Adicionar como medida calculada</button></div>`, { label: 'Calculadora' });
  let result = null;
  const cur = () => calcs.find((c) => c.id === m.el.querySelector('#k-sel').value);
  const drawVars = () => {
    const c = cur(); result = null; m.el.querySelector('[data-x=add]').disabled = true; m.el.querySelector('#k-res').innerHTML = '';
    m.el.querySelector('#k-vars').innerHTML = c.variables.map((v) => {
      const hit = (section.measuresList || []).find((x) => !x.calculated && norm(x.label) === norm(v.label || v.name) && norm(x.unit) === norm(v.unit));
      return `<div class="mrow"><span class="m-label">${esc(v.label || v.name)} (${esc(v.name)})</span>
        <input class="m-small" data-var="${esc(v.name)}" inputmode="decimal" aria-label="${esc(v.label || v.name)}" value="${esc(hit ? hit.value : '')}">
        <span class="m-small muted">${esc(v.unit)}</span></div>`;
    }).join('') + '<p class="small muted">Os valores são sugeridos a partir das medidas desta estrutura com o mesmo nome e a mesma unidade. Nenhuma unidade é convertida.</p>';
  };
  drawVars();
  m.el.querySelector('#k-sel').addEventListener('change', drawVars);
  return new Promise((resolve) => {
    m.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-x]'); if (!b) return;
      if (b.dataset.x === 'cancel') return m.close(null);
      const c = cur();
      if (b.dataset.x === 'calc') {
        const inputs = {};
        m.el.querySelectorAll('[data-var]').forEach((el) => { const v = c.variables.find((x) => x.name === el.dataset.var); inputs[v.name] = { value: el.value, unit: v.unit }; });
        try {
          result = runCalculation(c, inputs);
          m.el.querySelector('#k-res').innerHTML = `<div class="alert info"><strong>${esc(result.label)}: ${esc(result.value)} ${esc(result.unit)}</strong><div class="small">Fórmula: ${esc(c.formula)} — resultado calculado pelo sistema a partir dos valores informados. Confira antes de usar.</div></div>`;
          m.el.querySelector('[data-x=add]').disabled = false;
        } catch (err) { result = null; m.el.querySelector('[data-x=add]').disabled = true; m.el.querySelector('#k-res').innerHTML = alertList('Não foi possível calcular', [err.message], 'error'); }
      }
      if (b.dataset.x === 'add' && result) m.close({ id: uid(), label: result.label, value: result.value, unit: result.unit, calculated: true, calcId: result.calcId, calcName: result.calcName, formula: result.formula, inputs: result.inputs });
    });
    m.closed.then(resolve);
  });
}

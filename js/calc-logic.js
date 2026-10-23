// Regras puras das calculadoras definidas pela veterinária (validação e execução).
import { parseFormula, formulaVariables, evaluate, formatResult, isValidVariableName } from './formula.js';
import { isNumericValue } from './quality.js';

const norm = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export { norm };

/** calc = { name, formula, variables:[{name,label,unit}], resultLabel, resultUnit, decimals } */
export function validateCalculation(c) {
  const errors = [];
  if (!String(c.name || '').trim()) errors.push('Informe o nome do cálculo.');
  if (!String(c.resultLabel || '').trim()) errors.push('Informe o nome do resultado (ex.: Volume).');
  if (!String(c.resultUnit || '').trim()) errors.push('Informe a unidade do resultado. O sistema não deduz unidades.');
  const dec = Number(c.decimals);
  if (!(dec >= 0 && dec <= 6)) errors.push('Casas decimais: use de 0 a 6.');
  let used = [];
  try { used = formulaVariables(parseFormula(c.formula)); } catch (e) { errors.push(e.message); }
  const declared = (c.variables || []).map((v) => v.name);
  for (const v of c.variables || []) {
    if (!isValidVariableName(v.name || '')) errors.push(`Nome de variável inválido: "${v.name}" (use letras/números, começando por letra).`);
    if (!String(v.unit || '').trim()) errors.push(`A variável ${v.name} precisa de unidade.`);
  }
  if (new Set(declared).size !== declared.length) errors.push('Há variáveis repetidas.');
  for (const u of used) if (!declared.includes(u)) errors.push(`A variável "${u}" é usada na fórmula, mas não foi declarada.`);
  for (const d of declared) if (!used.includes(d)) errors.push(`A variável "${d}" foi declarada, mas não aparece na fórmula.`);
  return errors;
}

/** inputs = { nome: { value: '5,2', unit: 'cm' } }. Nenhuma conversão de unidade é feita. */
export function runCalculation(calc, inputs) {
  const errs = validateCalculation(calc);
  if (errs.length) throw new Error(errs[0]);
  const vars = {};
  for (const v of calc.variables) {
    const i = inputs[v.name];
    if (!i || !String(i.value || '').trim()) throw new Error(`Informe o valor de ${v.label || v.name}.`);
    if (!isNumericValue(i.value) || /[x×]/i.test(i.value)) throw new Error(`${v.label || v.name}: use um número simples (ex.: 5,2).`);
    if (norm(i.unit) !== norm(v.unit)) throw new Error(`${v.label || v.name}: a unidade deve ser "${v.unit}" (informada: "${i.unit || 'nenhuma'}"). Nenhuma conversão é feita automaticamente.`);
    vars[v.name] = Number(String(i.value).trim().replace(',', '.'));
  }
  const raw = evaluate(parseFormula(calc.formula), vars);
  return {
    value: formatResult(raw, calc.decimals), unit: calc.resultUnit, label: calc.resultLabel,
    formula: calc.formula, calcId: calc.id, calcName: calc.name,
    inputs: Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, `${v.value} ${v.unit}`])),
  };
}

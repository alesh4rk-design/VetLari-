// Fórmulas definidas pela própria veterinária (ex.: volume, razão entre medidas).
// Interpretador próprio e seguro: NÃO usa eval/Function. Suporta + - * / ^ ( ), números (vírgula ou ponto),
// a constante pi, as funções sqrt() e abs() e variáveis declaradas. O sistema não traz fórmulas prontas.

const FUNCTIONS = { sqrt: Math.sqrt, abs: Math.abs };
const CONSTANTS = { pi: Math.PI };
export const RESERVED = [...Object.keys(FUNCTIONS), ...Object.keys(CONSTANTS)];
export const isValidVariableName = (n) => /^[A-Za-z][A-Za-z0-9_]{0,19}$/.test(n) && !RESERVED.includes(n.toLowerCase());

function tokenize(src) {
  const s = String(src).replace(/×|·/g, '*').replace(/÷/g, '/');
  const out = [];
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    const num = /^\d+([.,]\d+)?/.exec(s.slice(i));
    if (num) { out.push({ t: 'num', v: Number(num[0].replace(',', '.')) }); i += num[0].length; continue; }
    const id = /^[A-Za-z][A-Za-z0-9_]*/.exec(s.slice(i));
    if (id) { out.push({ t: 'id', v: id[0] }); i += id[0].length; continue; }
    if ('+-*/^()'.includes(c)) { out.push({ t: c }); i++; continue; }
    throw new Error(`Caractere inválido na fórmula: "${c}".`);
  }
  return out;
}

export function parseFormula(src) {
  if (!String(src || '').trim()) throw new Error('Informe a fórmula.');
  const tk = tokenize(src);
  let p = 0;
  const peek = () => tk[p] && tk[p].t;
  const eat = (t) => { if (peek() !== t) throw new Error(`Fórmula inválida: esperado "${t}".`); return tk[p++]; };
  function expr() { let n = term(); while (peek() === '+' || peek() === '-') { const op = tk[p++].t; n = { op, a: n, b: term() }; } return n; }
  function term() { let n = unary(); while (peek() === '*' || peek() === '/') { const op = tk[p++].t; n = { op, a: n, b: unary() }; } return n; }
  function unary() { if (peek() === '-') { p++; return { op: 'neg', a: unary() }; } return power(); }
  function power() { const base = primary(); if (peek() === '^') { p++; return { op: '^', a: base, b: unary() }; } return base; }
  function primary() {
    const t = tk[p];
    if (!t) throw new Error('Fórmula incompleta.');
    if (t.t === 'num') { p++; return { num: t.v }; }
    if (t.t === 'id') {
      p++;
      const lower = t.v.toLowerCase();
      if (peek() === '(') {
        if (!FUNCTIONS[lower]) throw new Error(`Função desconhecida: ${t.v}.`);
        p++; const arg = expr(); eat(')'); return { fn: lower, a: arg };
      }
      if (CONSTANTS[lower] !== undefined) return { num: CONSTANTS[lower] };
      return { v: t.v };
    }
    if (t.t === '(') { p++; const n = expr(); eat(')'); return n; }
    throw new Error(`Fórmula inválida perto de "${t.t}".`);
  }
  const ast = expr();
  if (p < tk.length) throw new Error('Fórmula inválida: há trechos sobrando no final.');
  return ast;
}

export function formulaVariables(ast, acc = new Set()) {
  if (ast.v) acc.add(ast.v);
  if (ast.a) formulaVariables(ast.a, acc);
  if (ast.b) formulaVariables(ast.b, acc);
  return [...acc];
}

export function evaluate(ast, vars) {
  const ev = (n) => {
    if (n.num !== undefined) return n.num;
    if (n.v) { if (!Object.prototype.hasOwnProperty.call(vars, n.v)) throw new Error(`Falta o valor de ${n.v}.`); return vars[n.v]; }
    if (n.fn) { const x = ev(n.a); if (n.fn === 'sqrt' && x < 0) throw new Error('Raiz quadrada de número negativo.'); return FUNCTIONS[n.fn](x); }
    if (n.op === 'neg') return -ev(n.a);
    const a = ev(n.a), b = ev(n.b);
    if (n.op === '+') return a + b;
    if (n.op === '-') return a - b;
    if (n.op === '*') return a * b;
    if (n.op === '/') { if (b === 0) throw new Error('Divisão por zero.'); return a / b; }
    if (n.op === '^') return a ** b;
    throw new Error('Operação desconhecida.');
  };
  const r = ev(ast);
  if (!Number.isFinite(r)) throw new Error('O resultado não é um número válido.');
  return r;
}

/** Formata com vírgula decimal e o número de casas definido. */
export function formatResult(n, decimals = 2) {
  const d = Math.min(6, Math.max(0, Number(decimals) || 0));
  return n.toFixed(d).replace('.', ',');
}

// PPL de dotación docente (modelo CMEstudios) resuelto con HiGHS.
// Traducción del modelo PuLP `optimizar(datos, parametros)`: mismas restricciones (C1–C20) y mismas fases
// lexicográficas (F1 contratar, F2 horas pagadas, F3a balance del peor colegio, F3b balance de todos, F4 estabilidad).
// Única diferencia de formulación: los cursos de un colegio con la misma asignatura y las mismas horas se agrupan,
// y la variable dice cuántos de esos cursos hace cada docente (entera) en vez de uno por uno (binaria). Da el mismo
// óptimo con muchas menos variables; los cursos con nombre se reparten al final.
// Entrega una propuesta: no modifica la dotación.
import { round, fmt, teacherFunction, RENEWABLE, FULL_TIME } from './core.mjs';

export const K65 = 45 / (60 * 0.65), K60 = 45 / (60 * 0.60); // horas de contrato por hora pedagógica
export const FUENTES = ['GEN', 'PIE'];
export const DEFAULT_PPL = { U: 10, permitir_supresion: true, max_sup_frac: 0.5, sup_titulares: false, permitir_extension: true, misma_comuna: true, kPIE: 1, tlim: 20, gap: 0.01 };
// Segundos por fase: cubrir y pagar mandan; balance y estabilidad afinan sin alargar la espera.
export const PHASE_LIMITS = { F1: 30, F2: 8, F3: 3, F3b: 3, F4: 4 };
// Brecha aceptada por fase: cubrir y pagar se exigen casi exactos; balance y estabilidad, con algo de holgura.
export const PHASE_GAPS = { F1: 1e-4, F2: 1e-3, F3: 1e-2, F3b: 1e-2, F4: 2e-2 };
export const PERIODS = [1, 2];
export const PERIOD_LABEL = { 1: 'Marzo a julio', 2: 'Agosto a diciembre' };
const WEEKS = { 1: 18, 2: 20 };

// Número estable por texto, para inventar datos de escenario siempre iguales (habilitaciones, licencias, retiros).
const hash = text => { let h = 2166136261; for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const levelOf = school => ['Liceo', 'Técnico profesional'].includes(school.modality) ? 'media' : school.modality === 'Escuela especial' ? 'especial' : 'basica';

// Cursos con nombre a partir de los grupos del plan de cada establecimiento.
export function coursesOf(school, plans) {
  const own = plans.filter(p => p.schoolId === school.id);
  const n = Math.max(0, ...own.map(p => p.groups));
  if (school.modality === 'Microcentro') return school.ruralMembers.flatMap(m => Array.from({ length: m.groups }, (_, k) => ({ label: `${m.name.replace('Escuela rural ficticia', 'Rural')} · combinado ${k + 1}`, ciclo1: k === 0 })));
  if (school.modality === 'Escuela especial') return Array.from({ length: n }, (_, k) => ({ label: `Grupo ${k + 1}`, ciclo1: false }));
  const grades = levelOf(school) === 'media' ? 4 : 8; const suffix = grades === 4 ? 'medio' : 'básico';
  const out = [];
  for (let g = 0; g < grades; g++) { const count = Math.floor(n / grades) + (g < n % grades ? 1 : 0); for (let k = 0; k < count; k++) out.push({ label: `${g + 1}° ${suffix} ${String.fromCharCode(65 + k)}`, ciclo1: grades === 8 && g < 4 }); }
  return out;
}

// ---------- Datos del modelo (D) desde la demo ----------
export function buildData(state, ids, settings) {
  const schools = state.schools.filter(s => ids.has(s.id) && s.modality !== 'Jardín VTF');
  const E = {}, groups = [], courses = {};
  for (const s of schools) {
    E[s.id] = { comuna: s.commune, prio80: s.lectiveRatio <= 0.6, jec: !!s.jec, level: levelOf(s), name: s.name };
    const list = coursesOf(s, state.plans); courses[s.id] = list;
    for (const p of state.plans.filter(p => p.schoolId === s.id && p.groups > 0 && p.hoursPerGroup > 0)) {
      // Una asignatura con menos cursos que el colegio se dicta en los cursos superiores (p. ej. módulos TP en 3° y 4°).
      const taken = list.slice(Math.max(0, list.length - p.groups));
      // Misma proporción lectiva que la cuadratura del establecimiento (65/35 o 60/40), para que la propuesta y la
      // cuadratura cuenten igual las horas al aplicarla.
      if (taken.length) groups.push({ id: `g${groups.length}`, e: s.id, subject: p.subject, level: E[s.id].level, h: p.hoursPerGroup, n: taken.length, kap: 45 / (60 * s.lectiveRatio), courses: taken.map(c => c.label) });
    }
  }
  const RPIE = Object.fromEntries(schools.map(s => [s.id, s.pie ? s.pie.courses * (s.jec ? settings.pieHoursJec : settings.pieHoursNoJec) : 0]));
  const subjectsAt = level => [...new Set(groups.filter(g => g.level === level).map(g => g.subject))];
  const doc = {};
  for (const t of state.staff.filter(t => t.type === 'Docente' && !t.vacant && E[t.schoolId])) {
    const school = state.schools.find(s => s.id === t.schoolId); const level = E[t.schoolId].level; const k = hash(t.id);
    const own = [...new Set(state.plans.filter(p => p.schoolId === t.schoolId).map(p => p.subject))];
    // Habilitaciones de escenario: generalistas en básica rural y parte de la urbana; 1 o 2 asignaturas en media;
    // los docentes de especialidad TP quedan habilitados en los módulos de su liceo.
    const generalist = level === 'especial' || school.modality === 'Microcentro' || (level === 'basica' && k % 5 < 2);
    let hab = generalist ? subjectsAt(level) : [own[k % own.length], own[(k >> 3) % own.length]];
    if (t.track === 'Formación diferenciada TP') hab = [...new Set([...own.filter(x => x.startsWith('Módulos')), own[k % own.length]])];
    const pie = t.funding === 'PIE'; const fn = teacherFunction(t.role);
    const Hnl = fn === 'Docente de aula' ? 0 : round(Math.max(0, t.contractHours - t.assignedPed * 45 / 60));
    const fin = t.endDate && RENEWABLE.includes(t.contract) ? (t.endDate < '2027-03-01' ? 1 : t.endDate < '2027-08-01' ? 2 : null) : null;
    doc[t.id] = { name: t.name, rut: t.rut, o: t.schoolId, H: pie ? { PIE: t.contractHours } : { GEN: t.contractHours }, Hnl, tipo: RENEWABLE.includes(t.contract) ? 'contrata' : 'titular', fuero: /fuero/i.test(t.protection || ''), hab: new Set(hab.filter(Boolean).map(a => `${a}|${level}`)), esp_pie: pie, lic: k % 41 === 7 ? { 2: 1 } : k % 53 === 11 ? { 1: 0.5 } : {}, ret: k % 97 === 13 ? 2 : null, fin, max_extra: 1, assignedPed: t.assignedPed };
  }
  // Distribución vigente (q0): cada docente toma cursos de sus asignaturas en su colegio hasta sus horas lectivas actuales.
  const q0 = {}; const left = Object.fromEntries(groups.map(g => [g.id, g.n]));
  for (const [d, i] of Object.entries(doc)) {
    let hours = i.assignedPed;
    for (const g of groups.filter(g => g.e === i.o && i.hab.has(`${g.subject}|${g.level}`))) {
      const take = Math.min(left[g.id], Math.floor(hours / g.h + 1e-9)); if (take <= 0) continue;
      q0[`${d}|${g.id}`] = take; left[g.id] -= take; hours -= take * g.h;
    }
  }
  return { E, groups, courses, RPIE, T: PERIODS, semanas: WEEKS, doc, q0 };
}

// ---------- Modelo ----------
const act = (i, t) => i.ret != null && t >= i.ret ? 0 : i.fin != null && t >= i.fin ? 'ren' : 1;
const lic = (i, t) => i.lic[t] ?? 0;

export function buildModel(D, params) {
  const P = { ...DEFAULT_PPL, ...params };
  const { E, groups, doc, RPIE, T, semanas: W } = D; const kP = P.kPIE;
  const gById = Object.fromEntries(groups.map(g => [g.id, g]));
  const REQ = Object.fromEntries(Object.keys(E).map(e => [e, groups.filter(g => g.e === e).reduce((n, g) => n + g.n * g.h * g.kap, 0)]));
  // Holgura inicial por colegio, fuente y periodo (paso previo del modelo).
  const H0 = {};
  for (const e of Object.keys(E)) for (const f of FUENTES) for (const t of T) {
    let cap = 0;
    for (const i of Object.values(doc)) if (i.o === e && act(i, t) === 1) cap += Math.max((i.H[f] ?? 0) - (f === 'GEN' ? i.Hnl : 0), 0) * (1 - lic(i, t));
    H0[`${e}|${f}|${t}`] = cap - (f === 'GEN' ? REQ[e] : RPIE[e] * kP);
  }
  const donante = (e, f, t) => H0[`${e}|${f}|${t}`] >= P.U, receptor = (e, f, t) => H0[`${e}|${f}|${t}`] < 0;
  const puede = (i, e, f, t) => {
    if (act(i, t) === 0 || lic(i, t) >= 1) return false;
    if (e === i.o) return true;
    if (P.misma_comuna && E[e].comuna !== E[i.o].comuna) return false;
    if (E[e].level !== E[i.o].level) return false;
    return donante(i.o, f, t) && receptor(e, f, t);
  };
  // Variables
  const vars = new Map(); const add = (name, type, lb = 0, ub = Infinity) => (vars.set(name, { type, lb, ub }), name);
  const x = [], xp = [], ys = {}, sm = {}, sp = {}, ren = {}, z = {};
  for (const [d, i] of Object.entries(doc)) for (const g of groups) for (const t of T)
    if (i.H.GEN && i.hab.has(`${g.subject}|${g.level}`) && puede(i, g.e, 'GEN', t)) x.push({ d, g: g.id, t, e: g.e, name: add(`x${x.length}`, 'I', 0, g.n) });
  for (const [d, i] of Object.entries(doc)) if (i.esp_pie) for (const e of Object.keys(E)) for (const t of T)
    if (RPIE[e] > 0 && puede(i, e, 'PIE', t)) xp.push({ d, e, t, name: add(`p${xp.length}`, 'C') });
  const v = {}; for (const g of groups) for (const t of T) v[`${g.id}|${t}`] = add(`v_${g.id}_${t}`, 'I', 0, g.n);
  const wp = {}; for (const e of Object.keys(E)) for (const t of T) if (RPIE[e] > 0) wp[`${e}|${t}`] = add(`w_${e.replace('-', '')}_${t}`, 'C');
  let k = 0;
  for (const [d, i] of Object.entries(doc)) {
    k++;
    for (const f of FUENTES) if (i.H[f] != null) { sm[`${d}|${f}`] = add(`sm${k}${f}`, 'I'); for (const t of T) { ys[`${d}|${f}|${t}`] = add(`y${k}${f}${t}`, 'C'); sp[`${d}|${f}|${t}`] = add(`sp${k}${f}${t}`, 'I'); } }
    if (i.fin != null) ren[d] = add(`r${k}`, 'B', 0, 1);
  }
  for (const q of [...x, ...xp]) if (q.e !== doc[q.d].o && !z[`${q.d}|${q.e}`]) z[`${q.d}|${q.e}`] = add(`z${Object.keys(z).length}`, 'B', 0, 1);
  const TH = add('Theta', 'C');
  // Índices para armar restricciones rápido.
  const xBy = { dt: {}, gt: {} }; for (const q of x) { (xBy.dt[`${q.d}|${q.t}`] ??= []).push(q); (xBy.gt[`${q.g}|${q.t}`] ??= []).push(q); }
  const pBy = { dt: {}, et: {} }; for (const q of xp) { (pBy.dt[`${q.d}|${q.t}`] ??= []).push(q); (pBy.et[`${q.e}|${q.t}`] ??= []).push(q); }
  const cost = q => gById[q.g].h * gById[q.g].kap;
  const rows = []; const row = (terms, sense, rhs) => rows.push({ terms: terms.filter(([c]) => c !== 0), sense, rhs });
  // C1–C2 cobertura del plan (curso por curso, agrupado) y del apoyo PIE.
  for (const g of groups) for (const t of T) row([...(xBy.gt[`${g.id}|${t}`] ?? []).map(q => [1, q.name]), [1, v[`${g.id}|${t}`]]], '=', g.n);
  for (const e of Object.keys(E)) for (const t of T) if (RPIE[e] > 0) row([...(pBy.et[`${e}|${t}`] ?? []).map(q => [1, q.name]), [1, wp[`${e}|${t}`]]], '=', RPIE[e]);
  for (const [d, i] of Object.entries(doc)) {
    const prot = i.fuero || (i.tipo === 'titular' && !P.sup_titulares) || Object.keys(i.lic).length > 0 || !P.permitir_supresion || i.fin != null;
    for (const f of FUENTES) {
      if (i.H[f] == null) continue; const Hf = i.H[f]; const s = sm[`${d}|${f}`];
      row([[1, s]], '<=', Math.floor(Hf * P.max_sup_frac));                    // C11 tope de supresión
      if (prot) row([[1, s]], '=', 0);                                          // C12 protecciones
      for (const t of T) {
        const y = ys[`${d}|${f}|${t}`], e = sp[`${d}|${f}|${t}`]; const a = act(i, t);
        if (!P.permitir_extension) row([[1, e]], '=', 0);                      // C13
        if (a === 1) row([[1, y], [1, s], [-1, e]], '=', Hf);                   // C4 balance de contrato
        else if (a === 0) { row([[1, y]], '=', 0); row([[1, e]], '=', 0); }     // C4 retiro
        else { row([[1, y], [-Hf, ren[d]], [-1, e]], '=', 0); row([[1, e], [-FULL_TIME, ren[d]]], '<=', 0); } // C4 renovación
      }
    }
    for (const t of T) {
      const a = act(i, t); const disp = 1 - lic(i, t);
      row(FUENTES.filter(f => i.H[f] != null).map(f => [1, ys[`${d}|${f}|${t}`]]), '<=', FULL_TIME);   // C5 jornada máxima
      const mine = xBy.dt[`${d}|${t}`] ?? [];
      if (i.H.GEN != null) {
        const y = ys[`${d}|GEN|${t}`];
        if (a === 1) row([[1, y]], '>=', i.Hnl); else if (a === 'ren') row([[1, y], [-i.Hnl, ren[d]]], '>=', 0);   // C6 horas no lectivas
        const terms = [...mine.map(q => [cost(q), q.name]), [-disp, y]];                                            // C7 capacidad lectiva
        if (a === 1) row(terms, '<=', -i.Hnl * disp); else if (a === 'ren') row([...terms, [i.Hnl * disp, ren[d]]], '<=', 0); else row(terms, '<=', 0);
      }
      if (i.H.PIE != null) row([...(pBy.dt[`${d}|${t}`] ?? []).map(q => [kP, q.name]), [-disp, ys[`${d}|PIE|${t}`]]], '<=', 0); // C8
      if (a === 'ren') { for (const q of mine) row([[1, q.name], [-gById[q.g].n, ren[d]]], '<=', 0); for (const q of pBy.dt[`${d}|${t}`] ?? []) row([[1, q.name], [-RPIE[q.e], ren[d]]], '<=', 0); } // C10
    }
    row(Object.keys(z).filter(key => key.startsWith(`${d}|`)).map(key => [1, z[key]]), '<=', i.max_extra);         // C15
  }
  for (const q of x) if (q.e !== doc[q.d].o) row([[1, q.name], [-gById[q.g].n, z[`${q.d}|${q.e}`]]], '<=', 0);     // C14
  for (const q of xp) if (q.e !== doc[q.d].o) row([[1, q.name], [-RPIE[q.e], z[`${q.d}|${q.e}`]]], '<=', 0);
  for (const e of Object.keys(E)) for (const t of T) {
    // C16 el donante no presta más de lo que le sobra; C17 al receptor solo entra lo que le falta (más un bloque).
    const out = x.filter(q => q.t === t && doc[q.d].o === e && q.e !== e); if (out.length) row(out.map(q => [cost(q), q.name]), '<=', Math.max(H0[`${e}|GEN|${t}`], 0));
    const outP = xp.filter(q => q.t === t && doc[q.d].o === e && q.e !== e); if (outP.length) row(outP.map(q => [kP, q.name]), '<=', Math.max(H0[`${e}|PIE|${t}`], 0));
    const into = x.filter(q => q.t === t && q.e === e && doc[q.d].o !== e);
    const block = Math.max(0, ...groups.filter(g => g.e === e).map(g => g.h * g.kap)); const h0 = H0[`${e}|GEN|${t}`];
    if (into.length) row(into.map(q => [cost(q), q.name]), '<=', Math.max(0, -h0) + (h0 < 0 ? block - 1e-6 : 0));
    const intoP = xp.filter(q => q.t === t && q.e === e && doc[q.d].o !== e); if (intoP.length) row(intoP.map(q => [kP, q.name]), '<=', Math.max(0, -H0[`${e}|PIE|${t}`]));
  }
  // C18–C19 holgura de cada colegio y balance (theta = holgura relativa del colegio más holgado).
  const hol = {};
  for (const e of Object.keys(E)) for (const t of T) {
    const terms = [];
    for (const [d, i] of Object.entries(doc)) {
      if (i.o !== e || i.H.GEN == null) continue; const a = act(i, t); const disp = 1 - lic(i, t);
      terms.push([disp, ys[`${d}|GEN|${t}`]]);
      if (a === 'ren') terms.push([-i.Hnl * disp, ren[d]]);
      for (const q of xBy.dt[`${d}|${t}`] ?? []) terms.push([-cost(q), q.name]);
    }
    // holgura = términos + constante (la constante descuenta las horas no lectivas de quienes siguen activos).
    const constant = -Object.values(doc).filter(i => i.o === e && i.H.GEN != null && act(i, t) === 1).reduce((n, i) => n + i.Hnl * (1 - lic(i, t)), 0);
    hol[`${e}|${t}`] = { terms, constant };
    if (REQ[e] > 0) row([...terms, [-REQ[e], TH]], '<=', -constant);
  }
  // Objetivos
  const F1 = [...groups.flatMap(g => T.map(t => [W[t] * g.h * g.kap, v[`${g.id}|${t}`]])), ...Object.entries(wp).map(([key, w]) => [W[key.split('|')[1]] * kP, w])];
  const F2 = Object.entries(ys).map(([key, y]) => [W[key.split('|')[2]], y]);
  const F3 = [[1, TH]];
  return { P, vars, rows, x, xp, v, wp, ys, sm, sp, ren, z, TH, hol, REQ, H0, objectives: { F1, F2, F3 }, D };
}

export function lpText(model, objective, extraRows) {
  const num = c => Number.isInteger(c) ? String(c) : String(+c.toPrecision(12));
  const expr = terms => { if (!terms.length) return '0 Theta'; let out = ''; terms.forEach(([c, n], i) => { out += `${c < 0 ? ' - ' : i ? ' + ' : ' '}${num(Math.abs(c))} ${n}`; if (i % 8 === 7) out += '\n  '; }); return out; };
  const lines = ['Minimize', ` obj: ${expr(objective)}`, 'Subject To'];
  [...model.rows, ...extraRows].forEach((r, i) => lines.push(` c${i}: ${expr(r.terms)} ${r.sense} ${num(r.rhs)}`));
  lines.push('Bounds');
  const ints = [], bins = [];
  for (const [name, b] of model.vars) {
    if (b.type === 'B') { bins.push(name); continue; }
    if (b.type === 'I') ints.push(name);
    lines.push(b.ub === Infinity ? ` ${name} >= ${num(b.lb)}` : ` ${num(b.lb)} <= ${name} <= ${num(b.ub)}`);
  }
  if (ints.length) lines.push('Generals', ...chunk(ints));
  if (bins.length) lines.push('Binaries', ...chunk(bins));
  lines.push('End');
  return lines.join('\n');
}
const chunk = names => { const out = []; for (let i = 0; i < names.length; i += 20) out.push(' ' + names.slice(i, i + 20).join(' ')); return out; };
const value = (cols, terms) => terms.reduce((n, [c, name]) => n + c * (cols[name]?.Primal ?? 0), 0);

// Resuelve las fases en orden sobre un único modelo en memoria. Cada fase parte desde la solución de la
// anterior (arranque en caliente) y fija su óptimo con tolerancia, como en el modelo PuLP. Si una fase no
// logra mejorar dentro del tiempo, se conserva la solución anterior: nunca se entrega una solución inválida.
const PHASES = [['F1 · Minimizar horas sin cubrir (contratar)', 'F1', 1e-4], ['F2 · Minimizar horas pagadas', 'F2', 1e-4], ['F3a · Balancear el colegio más holgado', 'F3', 1e-3], ['F3b · Balancear todos los colegios', 'F3b', 1e-3], ['F4 · Estabilidad respecto de la distribución vigente', 'F4', null]];
function solvePart(highs, D, P, onPhase, part) {
  const model = buildModel(D, P);
  const hm = highs.createModel({ format: 'lp', data: lpText(model, model.objectives.F1, []) });
  const log = [];
  try {
    hm.options.set({ output_flag: false, mip_rel_gap: P.gap ?? 0.01 });
    const idx = new Map([...model.vars.keys()].map(n => [n, hm.getColByName(n)]));
    let numCols = idx.size; let sol = null;
    const at = (x, n) => x[idx.get(n)] ?? 0;
    const valueOf = (terms, x) => terms.reduce((s, [c, n]) => s + c * at(x, n), 0);
    const entries = terms => { const m = new Map(); for (const [c, n] of terms) m.set(idx.get(n), (m.get(idx.get(n)) ?? 0) + c); return { indices: new Int32Array([...m.keys()]), values: new Float64Array([...m.values()]) }; };
    const newCol = name => { hm.addVar(0, highs.infinity); idx.set(name, numCols++); return name; };
    const addRow = (terms, lower, upper) => hm.addRow(lower, upper, entries(terms));
    const holVal = (key, x) => valueOf(model.hol[key].terms, x) + model.hol[key].constant;
    for (const [label, key, tol] of PHASES) {
      let objective = model.objectives[key]; let start = sol ? Array.from(sol) : null;
      if (key === 'F3b' && sol) {
        const reqT = Object.entries(model.REQ).filter(([, r]) => r > 0); const total = reqT.reduce((n, [, r]) => n + r, 0) * D.T.length;
        const rbar = total ? reqT.reduce((n, [e]) => n + D.T.reduce((m, t) => m + holVal(`${e}|${t}`, sol), 0), 0) / total : 0;
        objective = [];
        for (const [e, r] of reqT) for (const t of D.T) {
          const h = model.hol[`${e}|${t}`]; const dev = newCol(`dev_${e.replace('-', '')}_${t}`); objective.push([1, dev]);
          addRow([[1, dev], ...h.terms.map(([c, n]) => [-c, n])], h.constant - rbar * r, highs.infinity);
          addRow([[1, dev], ...h.terms], rbar * r - h.constant, highs.infinity);
          start.push(Math.abs(holVal(`${e}|${t}`, sol) - rbar * r));
        }
      }
      if (key === 'F4' && sol) {
        objective = [];
        for (const q of model.x) {
          const base = D.q0[`${q.d}|${q.g}`];
          if (!base) { objective.push([1, q.name]); continue; }
          const u = newCol(`u_${q.name}`); objective.push([1, u]);
          addRow([[1, u], [-1, q.name]], -base, highs.infinity); addRow([[1, u], [1, q.name]], base, highs.infinity);
          start.push(Math.abs(at(sol, q.name) - base));
        }
        objective.push(...Object.values(model.z).map(n => [1, n]), ...Object.values(model.sp).map(n => [1, n]));
      }
      if ((key === 'F3b' || key === 'F4') && !sol) break;
      for (let i = 0; i < numCols; i++) hm.changeColCost(i, 0);
      const obj = entries(objective); obj.indices.forEach((i, k) => hm.changeColCost(i, obj.values[k]));
      hm.options.set({ time_limit: Math.min(P.tlim, PHASE_LIMITS[key]), mip_rel_gap: PHASE_GAPS[key] });
      if (start) hm.setSolution({ colValue: new Float64Array(start) });
      const started = Date.now();
      hm.run();
      const status = hm.getModelStatus(); const feasible = hm.info.get('primal_solution_status') === 2;
      const seconds = round((Date.now() - started) / 1000);
      if (!feasible) { log.push({ part, label, status: status === 8 ? 'Sin solución' : 'Sin mejora en el tiempo límite', value: null, seconds }); onPhase(log.at(-1)); if (!sol) break; continue; }
      sol = hm.getSolution().colValue; const val = valueOf(objective, sol);
      log.push({ part, label, status: status === 7 ? 'Óptimo' : 'Mejor solución en el tiempo límite', value: round(val), seconds }); onPhase(log.at(-1));
      if (tol !== null) addRow(objective, -highs.infinity, val + tol + Math.abs(val) * tol);
    }
    const cols = sol ? Object.fromEntries([...idx.keys()].map(n => [n, { Primal: at(sol, n) }])) : null;
    return { log, model, cols, size: { variables: numCols, enteras: [...model.vars.values()].filter(b => b.type !== 'C').length } };
  } finally { hm.dispose(); }
}

// Con traslados solo dentro de la comuna, cada comuna es un problema independiente: se resuelve por separado
// (mismo óptimo para cubrir, pagar y estabilidad; el balance se mide dentro de cada comuna).
export const partsOf = (D, params = {}) => ({ ...DEFAULT_PPL, ...params }).misma_comuna ? [...new Set(Object.values(D.E).map(e => e.comuna))].sort() : ['Todo el territorio'];
export function solve(highs, D, params = {}, onPhase = () => {}, only = null) {
  const P = { ...DEFAULT_PPL, ...params };
  const parts = only ? [only] : partsOf(D, P);
  const results = [];
  for (const part of parts) {
    const sub = P.misma_comuna ? subset(D, e => D.E[e].comuna === part) : D;
    if (!Object.keys(sub.E).length) continue;
    const r = solvePart(highs, sub, P, onPhase, part);
    results.push({ part, log: r.log, size: r.size, ...(r.cols ? decode(r.model, r.cols) : {}) });
  }
  return mergeResults(results);
}
// Une los resultados de cada comuna (se resuelven por separado, incluso en paralelo).
export function mergeResults(results) {
  const out = { log: [], plan: {}, people: [], vacantes: [], piePend: [], holgura: {}, theta: 0, size: { variables: 0, enteras: 0 }, parts: [], failed: [] };
  for (const r of results) {
    out.log.push(...r.log); out.size.variables += r.size.variables; out.size.enteras += r.size.enteras; out.parts.push(r.part);
    if (!r.people) { out.failed.push(r.part); continue; }
    Object.assign(out.plan, r.plan); Object.assign(out.holgura, r.holgura); out.people.push(...r.people); out.vacantes.push(...r.vacantes); out.piePend.push(...r.piePend); out.theta = Math.max(out.theta, r.theta);
  }
  return out;
}
function subset(D, keep) {
  const E = Object.fromEntries(Object.entries(D.E).filter(([e]) => keep(e)));
  const doc = Object.fromEntries(Object.entries(D.doc).filter(([, i]) => E[i.o]));
  const groups = D.groups.filter(g => E[g.e]); const ids = new Set(groups.map(g => g.id));
  return { ...D, E, doc, groups, RPIE: Object.fromEntries(Object.entries(D.RPIE).filter(([e]) => E[e])), courses: Object.fromEntries(Object.entries(D.courses).filter(([e]) => E[e])), q0: Object.fromEntries(Object.entries(D.q0).filter(([key]) => doc[key.split('|')[0]] && ids.has(key.split('|')[1]))) };
}

// ---------- Resultado legible ----------
function decode(model, cols) {
  const { D } = model; const val = n => cols[n]?.Primal ?? 0; const gById = Object.fromEntries(D.groups.map(g => [g.id, g]));
  const teaching = {}; // por docente y periodo: grupos y horas
  for (const q of model.x) { const n = Math.round(val(q.name)); if (n > 0) (teaching[`${q.d}|${q.t}`] ??= []).push({ g: q.g, e: q.e, n }); }
  const pie = {}; for (const q of model.xp) { const h = val(q.name); if (h > 1e-3) (pie[`${q.d}|${q.t}`] ??= []).push({ e: q.e, h: round(h) }); }
  // Planificación curso por curso: los cursos de cada grupo se reparten primero a quien ya los tenía.
  const plan = {};
  for (const t of D.T) for (const g of D.groups) {
    const who = Object.entries(teaching).filter(([key]) => key.endsWith(`|${t}`)).flatMap(([key, list]) => list.filter(a => a.g === g.id).map(a => ({ d: key.split('|')[0], n: a.n })));
    who.sort((a, b) => (D.q0[`${b.d}|${g.id}`] ?? 0) - (D.q0[`${a.d}|${g.id}`] ?? 0));
    const labels = [...g.courses];
    for (const { d, n } of who) for (const label of labels.splice(0, n)) (plan[`${g.e}|${t}`] ??= []).push({ course: label, subject: g.subject, hours: g.h, teacher: d, name: D.doc[d].name, origin: D.doc[d].o });
    for (const label of labels) (plan[`${g.e}|${t}`] ??= []).push({ course: label, subject: g.subject, hours: g.h, teacher: null, name: 'Vacante', origin: null });
  }
  const people = Object.entries(D.doc).map(([d, i]) => {
    const per = Object.fromEntries(D.T.map(t => {
      const list = teaching[`${d}|${t}`] ?? [];
      const porColegio = {}; for (const a of list) porColegio[a.e] = round((porColegio[a.e] ?? 0) + a.n * gById[a.g].h);
      return [t, { lectivas: round(list.reduce((n, a) => n + a.n * gById[a.g].h, 0)), usado: round(list.reduce((n, a) => n + a.n * gById[a.g].h * gById[a.g].kap, 0)), cursos: list.reduce((n, a) => n + a.n, 0), asignaturas: [...new Set(list.map(a => gById[a.g].subject))], porColegio, destinos: [...new Set(list.map(a => a.e))], pie: (pie[`${d}|${t}`] ?? []).reduce((n, a) => n + a.h, 0), piePorColegio: Object.fromEntries((pie[`${d}|${t}`] ?? []).map(a => [a.e, a.h])), contrato: round(Object.keys(i.H).reduce((n, f) => n + val(model.ys[`${d}|${f}|${t}`]), 0)), extension: Object.keys(i.H).reduce((n, f) => n + Math.round(val(model.sp[`${d}|${f}|${t}`])), 0) }];
    }));
    return { id: d, name: i.name, rut: i.rut, origin: i.o, contrato: Object.values(i.H).reduce((n, h) => n + h, 0), supresion: Object.keys(i.H).reduce((n, f) => n + Math.round(val(model.sm[`${d}|${f}`])), 0), renueva: i.fin == null ? null : val(model.ren[d]) > 0.5, licencia: i.lic, retiro: i.ret, migra: Object.keys(model.z).filter(key => key.startsWith(`${d}|`) && val(model.z[key]) > 0.5).map(key => key.split('|')[1]).filter(e => Object.values(per).some(x => (x.porColegio[e] ?? 0) + (x.piePorColegio[e] ?? 0) > 0.01)), per };
  });
  const vacantes = D.groups.flatMap(g => D.T.map(t => ({ e: g.e, t, subject: g.subject, cursos: Math.round(val(model.v[`${g.id}|${t}`])), horas: round(Math.round(val(model.v[`${g.id}|${t}`])) * g.h) }))).filter(v => v.cursos > 0);
  const piePend = Object.entries(model.wp).map(([key, n]) => ({ e: key.split('|')[0], t: Number(key.split('|')[1]), horas: round(val(n)) })).filter(p => p.horas > 0.01);
  const holgura = Object.fromEntries(Object.entries(model.hol).map(([key, h]) => [key, round(h.terms.reduce((n, [c, name]) => n + c * val(name), 0) + h.constant)]));
  return { plan, people, vacantes, piePend, holgura, theta: round(val(model.TH) * 10000) / 10000 };
}

// Línea base: lo que queda sin cubrir con la distribución vigente (q0), para comparar.
export function baseline(D) {
  const gaps = D.groups.map(g => { const taken = Object.entries(D.q0).filter(([key]) => key.endsWith(`|${g.id}`)).reduce((n, [, c]) => n + c, 0); return { e: g.e, cursos: g.n - taken, horas: (g.n - taken) * g.h }; });
  return { cursos: gaps.reduce((n, x) => n + x.cursos, 0), horas: round(gaps.reduce((n, x) => n + x.horas, 0)) };
}
export const describePeriod = t => `${PERIOD_LABEL[t]} (${WEEKS[t]} semanas)`;
export { fmt };

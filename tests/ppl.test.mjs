import test from 'node:test';
import assert from 'node:assert/strict';
import loadHighs from 'highs';
import { createSeed } from '../src/core.mjs';
import { buildData, solve, coursesOf } from '../src/ppl.mjs';
import { buildReport } from '../src/pplReport.mjs';

const highs = await loadHighs();
const seed = createSeed();
// Una comuna completa: lo bastante chica para la prueba y con traslados posibles.
const ids = new Set(seed.schools.filter(s => s.commune === 'Los Muermos').map(s => s.id));
const D = buildData(seed, ids, seed.settings);
const R = solve(highs, D, {}, () => {});
const rep = buildReport(seed, D, R);

test('courses get real names and use the same lective ratio as the cuadratura', () => {
  const school = seed.schools.find(s => s.modality === 'Escuela regular');
  const courses = coursesOf(school, seed.plans);
  assert.equal(courses.length, Math.max(...seed.plans.filter(p => p.schoolId === school.id).map(p => p.groups)));
  assert.match(courses[0].label, /^1° básico A$/);
  for (const g of D.groups) assert.equal(g.kap, 45 / (60 * seed.schools.find(s => s.id === g.e).lectiveRatio));
});
test('every phase finishes with a valid solution', () => {
  assert.deepEqual(R.failed, []);
  assert.ok(R.log.length >= 5);
  assert.ok(R.log.every(l => l.value !== null && /Óptimo|Mejor solución/.test(l.status)), JSON.stringify(R.log));
});
test('the planning covers each course and subject exactly once per period', () => {
  for (const t of D.T) for (const g of D.groups) {
    const rows = (R.plan[`${g.e}|${t}`] ?? []).filter(r => r.subject === g.subject && g.courses.includes(r.course));
    assert.equal(rows.length, g.n, `${g.e} ${g.subject} periodo ${t}`);
  }
});
test('no teacher goes over their capacity (same rule as the cuadratura), and protected people are never suppressed', () => {
  for (const p of R.people) {
    const i = D.doc[p.id];
    for (const t of D.T) {
      const available = Math.max(0, p.per[t].contrato - (i.H.GEN ? i.Hnl : 0)) * (1 - (i.lic[t] ?? 0));
      assert.ok(p.per[t].usado <= available + 0.05, `${p.id} periodo ${t}: ${p.per[t].usado} > ${available}`);
      assert.ok(p.per[t].contrato <= 44 + 1e-6);
    }
    if (i.fuero || i.tipo === 'titular') assert.equal(p.supresion, 0, p.id);
    if (i.ret != null) for (const t of D.T.filter(t => t >= i.ret)) assert.equal(p.per[t].cursos, 0);
  }
});
test('the optimization never leaves more classes uncovered than the current distribution', () => {
  assert.ok(rep.summary.uncoveredAfter <= rep.summary.uncoveredBefore);
  assert.ok(rep.summary.efficientAfter >= rep.summary.efficientBefore);
});
test('transfers report real hours and every teacher gets a suggestion', () => {
  for (const m of rep.moves) assert.ok(m.destHours > 0 || m.destPie > 0, JSON.stringify(m));
  assert.ok(rep.teachers.every(t => t.suggestions.length > 0));
  assert.ok(rep.schools.every(s => s.suggestions.length > 0 && s.per[1] && s.per[2]));
});

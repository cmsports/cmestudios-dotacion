import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createSeed, computeIndicators, summarizeSchool } from '../src/core.mjs';
import { indicatorsBook, schoolSheetBook, listBook } from '../src/exports.mjs';
const XLSX = createRequire(import.meta.url)('xlsx');
const formulas = wb => Object.values(wb.Sheets).flatMap(ws => Object.values(ws).filter(c => c && c.f));

test('indicators workbook computes the PAL summary from the personnel sheet', () => {
  const s = createSeed(); const ids = new Set(s.schools.map(x => x.id));
  const wb = indicatorsBook(computeIndicators(s.schools, s.staff, s.plans, s.settings), XLSX, { state: s, label: 'SLEP', ids });
  assert.deepEqual(wb.SheetNames, ['Resumen PAL', 'Establecimientos', 'Por modalidad', 'Personal', 'Notas']);
  const resumen = Object.values(wb.Sheets['Resumen PAL']).filter(c => c && c.f);
  assert.ok(resumen.length > 40);
  assert.ok(resumen.every(c => /Personal!|Establecimientos!|'Por modalidad'!|C\d+/.test(c.f)));
  assert.equal(wb.Sheets['Resumen PAL'].B6.v, s.settings.lunchMinutesPerDay);
});
test('school workbook links its summary to the plan and staff sheets', () => {
  const s = createSeed();
  for (const id of ['EST-001', 'EST-026', 'EST-039', 'EST-053']) {
    const wb = schoolSheetBook(s, id, XLSX); const school = s.schools.find(x => x.id === id);
    assert.equal(wb.SheetNames[0], 'Resumen'); assert.ok(wb.SheetNames.includes('Docentes')); assert.ok(wb.SheetNames.includes('Notas'));
    if (school.modality === 'Técnico profesional') assert.ok(wb.SheetNames.includes('Formación TP'));
    if (school.modality === 'Microcentro') assert.ok(wb.SheetNames.includes('Escuelas rurales'));
    if (school.modality === 'Jardín VTF') assert.ok(wb.SheetNames.includes('Coeficientes VTF'));
    assert.ok(formulas(wb).length > 10);
  }
});
test('list exports keep readable rows for CSV and add totals that respect filters', () => {
  const s = createSeed(); const stats = s.schools.map(x => summarizeSchool(x, s.staff, s.plans));
  const { rows, wb } = listBook(XLSX, { kind: 'schools', state: s, schools: stats, people: s.staff, events: s.events });
  assert.equal(rows.length, 56); assert.ok('Brecha (45 min)' in rows[0]);
  assert.ok(formulas(wb).some(c => c.f.startsWith('SUBTOTAL(9,')));
  assert.ok(wb.Sheets['Establecimientos']['!autofilter']);
  assert.equal(listBook(null, { kind: 'people', state: s, schools: stats, people: s.staff.slice(0, 5), events: s.events }).rows.length, 5);
});

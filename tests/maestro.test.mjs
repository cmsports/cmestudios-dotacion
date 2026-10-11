import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed, rutDv, formatRut, parseRut, parseDate, validateImport, parseCSV, sampleImport } from '../src/core.mjs';

test('RUT is validated with its check digit and normalized', () => {
  assert.equal(rutDv('11111111'), '1');
  assert.equal(formatRut('11111111'), '11.111.111-1');
  assert.equal(parseRut('11111111-1'), '11.111.111-1');
  assert.equal(parseRut('11.111.111-2'), null);
  assert.equal(parseRut('abc'), null);
  const s = createSeed();
  const ruts = s.staff.filter(p => p.rut).map(p => p.rut);
  assert.equal(new Set(ruts).size, ruts.length);
  assert.ok(ruts.every(r => parseRut(r) === r));
  assert.ok(ruts.every(r => Number(r.split('-')[0].replace(/\D/g, '')) >= 45000000), 'los RUT del escenario quedan fuera del rango de personas naturales');
});
test('dates accept ISO and Chilean format and reject impossible days', () => {
  assert.equal(parseDate('2027-03-01'), '2027-03-01');
  assert.equal(parseDate('01-03-2027'), '2027-03-01');
  assert.equal(parseDate('01/03/2027'), '2027-03-01');
  assert.equal(parseDate('31-02-2027'), null);
  assert.equal(parseDate('marzo'), null);
});
test('maestro columns are validated row by row', () => {
  const s = createSeed(); const school = s.schools.find(x => x.modality === 'Escuela regular');
  const base = { id: 'X-1', nombre: 'Prueba', establecimiento_id: school.id, tipo: 'Docente', cargo: 'Docente de aula', horas_contrato: '30', horas_lectivas_pedagogicas: '20', financiamiento: 'General', contrato: 'Contrata', rut: '11.111.111-1', estatuto: 'Estatuto Docente', tramo: 'Avanzado', fecha_ingreso: '2027-03-01', fecha_termino: '2027-12-31', horas_basica: '30', horas_media: '0' };
  const ok = validateImport([base], s); assert.deepEqual(ok.errors, []);
  assert.deepEqual([ok.people[0].rut, ok.people[0].statute, ok.people[0].tramo, ok.people[0].endDate, ok.people[0].hoursBasic], ['11.111.111-1', 'Estatuto Docente', 'Avanzado', '2027-12-31', 30]);
  const errs = row => validateImport([{ ...base, ...row }], s).errors.join(' ');
  assert.match(errs({ rut: '11.111.111-2' }), /RUT .* no es válido/);
  assert.match(errs({ fecha_termino: '2026-01-01' }), /anterior a la de ingreso/);
  assert.match(errs({ fecha_ingreso: '2027-02-30' }), /fecha de ingreso inválida/);
  assert.match(errs({ estatuto: 'Otro' }), /estatuto debe ser/);
  assert.match(errs({ tramo: 'Experto III' }), /tramo debe ser/);
  assert.match(errs({ tipo: 'Asistente', horas_lectivas_pedagogicas: '0', horas_basica: '', horas_media: '' }), /tramo .* solo aplica a docentes/);
  assert.match(errs({ horas_basica: '20', horas_media: '5' }), /deben sumar las horas de contrato/);
  assert.match(validateImport([base, { ...base, id: 'X-2' }], s).errors.join(' '), /repetido/);
});
test('the bulk sample looks like a payroll master and passes validation', () => {
  const s = createSeed(); const rows = parseCSV(sampleImport());
  for (const col of ['rut', 'estatuto', 'tramo', 'fecha_ingreso', 'fecha_termino', 'horas_basica', 'horas_media']) assert.ok(col in rows[0], col);
  assert.deepEqual(validateImport(rows, s).errors, []);
});

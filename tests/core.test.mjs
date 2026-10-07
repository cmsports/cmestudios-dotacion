import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeed, capacityPedagogical, teacherCheck, summarizeSchool, parseCSV, serializeCSV, validateImport, applyImport, sampleImport} from '../src/core.mjs';

test('scenario covers 52 institutions, 4 microcenters, 25 rural members and 2,200 staff',()=>{
  const s=createSeed(); assert.equal(s.schools.filter(s=>s.modality!=='Microcentro').length,52);
  assert.equal(s.schools.filter(s=>s.modality==='Microcentro').length,4);
  assert.equal(s.schools.reduce((n,s)=>n+s.ruralMembers.length,0),25);
  assert.equal(s.staff.filter(p=>p.type==='Docente').length,1100);
  assert.equal(s.staff.filter(p=>p.type==='Asistente').length,1100);
  assert.equal(new Set(s.staff.map(p=>p.id)).size,2200);
});
test('contract and classroom hours are converted, never directly compared',()=>{
  assert.equal(capacityPedagogical(30,0.65),26);
  assert.equal(capacityPedagogical(30,0.6),24);
  const c=teacherCheck({contractHours:30,assignedPed:28},{lectiveRatio:0.65});
  assert.equal(c.excess,2);assert.equal(c.lectiveClock,19.5);assert.equal(c.nonLectiveClock,10.5);
});
test('curriculum edits and staff hours change the gap immediately',()=>{
  const s=createSeed();const school=s.schools[0];const before=summarizeSchool(school,s.staff,s.plans);
  const first=s.plans.find(p=>p.schoolId===school.id);
  const next=s.plans.map(p=>p.id===first.id?{...p,hoursPerGroup:p.hoursPerGroup+2}:p);
  const after=summarizeSchool(school,s.staff,next);
  assert.equal(after.required-before.required,first.groups*2);
  assert.equal(after.gap,Math.round((before.gap-first.groups*2)*100)/100);
});
test('VTF has no curricular deficit and requires explicit scenario coefficients',()=>{
  const s=createSeed(); const school=s.schools.find(s=>s.modality==='Jardín VTF');
  const before=summarizeSchool(school,s.staff,s.plans);assert.equal(before.status,'Por validar');assert.equal(before.needEducators,null);
  const configured=summarizeSchool({...school,enrollment:43,educatorPerChildren:10,technicianPerChildren:7},s.staff,s.plans);
  assert.equal(configured.needEducators,5);assert.equal(configured.needTechnicians,7);
});
test('CSV handles BOM, quoted delimiters, escaped quotes and multiline fields',()=>{
  const rows=[{id:'1',nombre:'Ana; "Demo"',nota:'Primera línea\nSegunda línea'}];
  assert.deepEqual(parseCSV(serializeCSV(rows)),rows);
  assert.deepEqual(parseCSV('id,nombre\r\n1,"Ana, Demo"\r\n'),[{id:'1',nombre:'Ana, Demo'}]);
  assert.throws(()=>parseCSV('id;nombre\n1;"Ana'),/sin cerrar/);
});
test('unknown schools, duplicate IDs, empty numeric cells and invalid types block import',()=>{
  const s=createSeed();const rows=parseCSV(sampleImport());rows[0].horas_contrato='';rows[1].establecimiento_id='UNKNOWN';rows[2].id=rows[1].id;rows[2].tipo='Otro';
  const r=validateImport(rows,s);assert.ok(r.errors.some(e=>e.includes('contrato')));assert.ok(r.errors.some(e=>e.includes('desconocido')));assert.ok(r.errors.some(e=>e.includes('duplicado')));assert.ok(r.errors.some(e=>e.includes('tipo debe')));assert.equal(s.staff.length,2200);
});
test('import upserts by ID, preserving unmentioned staff and existing protections',()=>{
  const s=createSeed();const r=validateImport(parseCSV(sampleImport()),s);assert.deepEqual(r.errors,[]);
  const next=applyImport(s,r.people);assert.equal(next.staff.length,2202);
  assert.equal(next.staff.find(p=>p.id==='DEMO-0001').contractHours,44);
  assert.equal(next.staff.find(p=>p.id==='DEMO-0001').protection,s.staff[0].protection);
  assert.equal(next.staff.find(p=>p.id==='DEMO-0050').name,s.staff.find(p=>p.id==='DEMO-0050').name);
  assert.equal(s.staff.length,2200);
});

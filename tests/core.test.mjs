import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeed, capacityPedagogical, teacherCheck, summarizeSchool, summarizeTracks, summarizeRural, summarizePie, hourBreakdown, computeIndicators, indicatorRows, parseCSV, serializeCSV, validateImport, applyImport, sampleImport} from '../src/core.mjs';

test('scenario covers 52 institutions, 4 microcenters, 25 rural members and 2,200 staff',()=>{
  const s=createSeed(); assert.equal(s.schools.filter(s=>s.modality!=='Microcentro').length,52);
  assert.equal(s.schools.filter(s=>s.modality==='Microcentro').length,4);
  assert.equal(s.schools.reduce((n,s)=>n+s.ruralMembers.length,0),25);
  const persons=s.staff.filter(p=>!p.vacant);
  assert.equal(persons.filter(p=>p.type==='Docente').length,1100);
  assert.equal(persons.filter(p=>p.type==='Asistente').length,1100);
  assert.ok(s.staff.filter(p=>p.vacant).length>0);
  assert.equal(new Set(s.staff.map(p=>p.id)).size,s.staff.length);
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
test('vacant positions cover the curriculum but are not counted as people',()=>{
  const s=createSeed();const vacancy=s.staff.find(p=>p.vacant);const school=s.schools.find(x=>x.id===vacancy.schoolId);
  const withVacancy=summarizeSchool(school,s.staff,s.plans);
  const without=summarizeSchool(school,s.staff.filter(p=>p.id!==vacancy.id),s.plans);
  assert.equal(withVacancy.teachers,without.teachers);
  assert.equal(withVacancy.vacancies,without.vacancies+1);
  assert.equal(Math.round((withVacancy.assigned-without.assigned)*100)/100,vacancy.assignedPed);
});
test('VTF has no curricular deficit and requires explicit coefficients for every level',()=>{
  const s=createSeed(); const school=s.schools.find(s=>s.modality==='Jardín VTF');
  const before=summarizeSchool(school,s.staff,s.plans);assert.equal(before.status,'Por validar');assert.equal(before.needEducators,null);
  const one=summarizeSchool({...school,vtfLevels:[{level:'Nivel medio',enrollment:43,educatorPerChildren:10,technicianPerChildren:7}]},s.staff,s.plans);
  assert.equal(one.needEducators,5);assert.equal(one.needTechnicians,7);
  const partial=summarizeSchool({...school,vtfLevels:[{level:'Sala cuna',enrollment:12,educatorPerChildren:null,technicianPerChildren:6},{level:'Nivel medio',enrollment:30,educatorPerChildren:30,technicianPerChildren:15}]},s.staff,s.plans);
  assert.equal(partial.status,'Por validar');
  const two=summarizeSchool({...school,vtfLevels:[{level:'Sala cuna',enrollment:12,educatorPerChildren:20,technicianPerChildren:6},{level:'Nivel medio',enrollment:30,educatorPerChildren:30,technicianPerChildren:15}]},s.staff,s.plans);
  assert.equal(two.needEducators,2);assert.equal(two.needTechnicians,4);assert.equal(two.enrollment,42);
});
test('TP tracks and rural schools add up to the establishment cuadratura',()=>{
  const s=createSeed();
  for(const school of s.schools.filter(x=>x.modality==='Técnico profesional')){
    const total=summarizeSchool(school,s.staff,s.plans);const t=summarizeTracks(school,s.staff,s.plans);
    assert.equal(t.tracks.reduce((n,x)=>n+x.required,0),total.required);
    assert.equal(Math.round((t.tracks.reduce((n,x)=>n+x.assigned,0)+t.unassigned.assigned)*100)/100,total.assigned);
  }
  for(const school of s.schools.filter(x=>x.modality==='Microcentro')){
    const total=summarizeSchool(school,s.staff,s.plans);const r=summarizeRural(school,s.staff,s.plans);
    assert.equal(r.members.reduce((n,m)=>n+m.required,0),total.required);
    assert.equal(Math.round((r.members.reduce((n,m)=>n+m.assigned,0)+r.unassigned.assigned)*100)/100,total.assigned);
  }
});
test('PIE support hours depend on JEC and split between transitory and permanent needs',()=>{
  const s=createSeed();const school={...s.schools[0],jec:true,pie:{courses:4,neet:15,neep:5}};
  const pie=summarizePie(school,s.staff,s.settings);assert.equal(pie.required,40);assert.equal(pie.requiredT,30);assert.equal(pie.requiredP,10);
  assert.equal(summarizePie({...school,jec:false},s.staff,s.settings).required,28);
  assert.equal(summarizePie({...school,pie:null},s.staff,s.settings),null);
});
test('hour types always add up to the contract and indicators reconcile',()=>{
  for(const p of [{role:'Docente de aula',contractHours:30,assignedPed:26},{role:'Directiva',contractHours:44,assignedPed:4},{role:'Técnico-pedagógica',contractHours:44,assignedPed:0},{role:'Docente de aula',contractHours:20,assignedPed:40}]){
    const b=hourBreakdown(p);assert.equal(Math.round((b.aula+b.noLectivas+b.directivas+b.tecnicas)*100)/100,p.contractHours);
  }
  assert.equal(hourBreakdown({role:'Directiva',contractHours:44,assignedPed:4}).directivas,41);
  const s=createSeed();const ind=computeIndicators(s.schools,s.staff,s.plans,s.settings);
  const persons=s.staff.filter(p=>!p.vacant);
  assert.equal(ind.teachers.count,1100);assert.equal(ind.teachers.hours,persons.filter(p=>p.type==='Docente').reduce((n,p)=>n+p.contractHours,0));
  const types=ind.hourTypes;assert.equal(Math.round(types.aula+types.noLectivas+types.directivas+types.tecnicas+ind.vtfEducatorHours),ind.teachers.hours);
  assert.equal(Object.values(ind.funding).reduce((n,f)=>n+f.hours,0),ind.teachers.hours);
  assert.equal(Object.values(ind.assistantCategories).reduce((n,c)=>n+c.count,0),1100);
  assert.equal(Math.round(ind.pie.requiredT+ind.pie.requiredP),Math.round(ind.pie.required));
  assert.equal(ind.byModality.reduce((n,m)=>n+m.total,0),ind.teachers.hours+ind.assistants.hours);
  assert.ok(indicatorRows(ind).every(r=>Number.isFinite(r.Valor)));
  const one=s.schools.slice(0,1);assert.equal(computeIndicators(one,s.staff,s.plans,s.settings).teachers.count,persons.filter(p=>p.schoolId===one[0].id&&p.type==='Docente').length);
});
test('CSV handles BOM, quoted delimiters, escaped quotes and multiline fields',()=>{
  const rows=[{id:'1',nombre:'Ana; "Demo"',nota:'Primera línea\nSegunda línea'}];
  assert.deepEqual(parseCSV(serializeCSV(rows)),rows);
  assert.deepEqual(parseCSV('id,nombre\r\n1,"Ana, Demo"\r\n'),[{id:'1',nombre:'Ana, Demo'}]);
  assert.throws(()=>parseCSV('id;nombre\n1;"Ana'),/sin cerrar/);
});
test('unknown schools, duplicate IDs, empty numeric cells and invalid types block import',()=>{
  const s=createSeed();const size=s.staff.length;const rows=parseCSV(sampleImport());rows[0].horas_contrato='';rows[1].establecimiento_id='UNKNOWN';rows[2].id=rows[1].id;rows[2].tipo='Otro';
  const r=validateImport(rows,s);assert.ok(r.errors.some(e=>e.includes('contrato')));assert.ok(r.errors.some(e=>e.includes('desconocido')));assert.ok(r.errors.some(e=>e.includes('duplicado')));assert.ok(r.errors.some(e=>e.includes('tipo debe')));assert.equal(s.staff.length,size);
});
test('optional TP and rural columns are validated against the establishment',()=>{
  const s=createSeed();const regular=s.schools.find(x=>x.modality==='Escuela regular');const micro=s.schools.find(x=>x.modality==='Microcentro');const tp=s.schools.find(x=>x.modality==='Técnico profesional');
  const base={id:'X-1',nombre:'Prueba',tipo:'Docente',cargo:'Docente de aula',horas_contrato:'30',horas_lectivas_pedagogicas:'20',financiamiento:'General',contrato:'Contrata',fuero:'',formacion_tp:'',escuela_rural:''};
  assert.ok(validateImport([{...base,establecimiento_id:regular.id,formacion_tp:'General'}],s).errors.some(e=>e.includes('formación TP')));
  assert.ok(validateImport([{...base,establecimiento_id:micro.id,escuela_rural:'Escuela inexistente'}],s).errors.some(e=>e.includes('no pertenece')));
  assert.ok(validateImport([{...base,establecimiento_id:tp.id,formacion_tp:'Otra'}],s).errors.some(e=>e.includes('General o Diferenciada')));
  const ok=validateImport([{...base,establecimiento_id:tp.id,formacion_tp:'Diferenciada',fuero:'Sí'}],s);assert.deepEqual(ok.errors,[]);
  assert.equal(ok.people[0].track,'Formación diferenciada TP');assert.equal(ok.people[0].protection,'Fuero gremial');
});
test('bulk sample spans every modality and upserts by ID, preserving unmentioned staff',()=>{
  const s=createSeed();const rows=parseCSV(sampleImport());assert.ok(rows.length>=200);
  const ids=new Set(rows.map(r=>r.establecimiento_id));for(const m of ['Escuela regular','Liceo','Técnico profesional','Escuela especial','Jardín VTF','Microcentro'])assert.ok(s.schools.some(x=>x.modality===m&&ids.has(x.id)),m);
  const r=validateImport(rows,s);assert.deepEqual(r.errors,[]);
  const added=rows.filter(x=>!s.staff.some(p=>p.id===x.id)).length;assert.ok(added>0);
  const next=applyImport(s,r.people);assert.equal(next.staff.length,s.staff.length+added);
  const updated=rows.find(x=>s.staff.some(p=>p.id===x.id&&p.protection));
  assert.equal(next.staff.find(p=>p.id===updated.id).protection,'Fuero gremial');
  const untouched=s.staff.find(p=>!rows.some(x=>x.id===p.id));
  assert.deepEqual(next.staff.find(p=>p.id===untouched.id),untouched);
});

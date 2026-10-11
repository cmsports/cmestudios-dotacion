// Contenido de los reportes exportables (ficha por establecimiento e indicadores PAL).
// No toca el DOM: recibe jsPDF / XLSX ya cargados y devuelve el documento, para poder probarlo fuera del navegador.
import { fmt, round, capacityPedagogical, teacherCheck, teacherFunction, assistantCategory, summarizeSchool, summarizeTracks, summarizeRural, summarizePie, vtfLevelsOf, indicatorRows, TP_TRACKS, TEACHER_FUNCTIONS, FULL_TIME, MODALITIES } from './core.mjs';

export const BRAND = [81, 67, 233];
export const hasFuero = p => /fuero/i.test(p.protection || '');
const DISCLAIMER = 'DEMOSTRACION - Datos ficticios. Formato propio; pendiente adaptar a la planilla PAL de la DEP.';
const pdfFooter = pdf => { pdf.setFontSize(8); pdf.setTextColor(120); pdf.text('CMEstudios | Escenario demo | ' + new Date().toLocaleDateString('es-CL'), 14, pdf.internal.pageSize.height - 8); pdf.setTextColor(0); };
// Agrega una tabla con título, pasando de página si no queda espacio.
function pdfSection(pdf, autoTable, { title, head, body }, fontSize = 8) {
  let y = (pdf.lastAutoTable?.finalY ?? 30) + 10;
  if (y > pdf.internal.pageSize.height - 35) { pdf.addPage(); y = 20; }
  pdf.setFontSize(11); pdf.text(title, 14, y);
  autoTable(pdf, { startY: y + 3, head: [head], body, styles: { fontSize }, headStyles: { fillColor: BRAND }, didDrawPage: () => pdfFooter(pdf) });
}

export function indicatorTables(ind) {
  return {
    rows: indicatorRows(ind),
    schools: ind.bySchool.map(s => ({ ID: s.id, Establecimiento: s.name, Modalidad: s.modality, Comuna: s.commune, Horas_docentes: s.teacherHours, Horas_asistentes: s.assistantHours, Horas_totales: s.total, Horas_vacantes: s.vacantHours, Brecha_lectiva_pedagogica: s.gap ?? 'No aplica', Estado: s.status })),
    modalities: ind.byModality.map(m => ({ Modalidad: m.modality, Unidades: m.units, Personas: m.people, Horas_docentes: m.teacherHours, Horas_asistentes: m.assistantHours, Horas_totales: m.total })),
  };
}
export function indicatorsPdf(ind, label, { jsPDF, autoTable }) {
  const { rows } = indicatorTables(ind); const pdf = new jsPDF({ compress: true });
  pdf.setFontSize(17); pdf.text('Indicadores de dotación 2027 | Plan Anual Local', 14, 18); pdf.setFontSize(9); pdf.text(label, 14, 25); pdf.text(DISCLAIMER, 14, 30);
  autoTable(pdf, { startY: 36, head: [['Sección', 'Indicador', 'Valor', 'Unidad']], body: rows.map(r => [r.Seccion, r.Indicador, fmt(r.Valor), r.Unidad]), styles: { fontSize: 8 }, headStyles: { fillColor: BRAND }, didDrawPage: () => pdfFooter(pdf) });
  pdf.addPage('a4', 'landscape'); pdf.setFontSize(13); pdf.text('Horas por establecimiento', 14, 18);
  autoTable(pdf, { startY: 23, head: [['ID', 'Establecimiento', 'Modalidad', 'Horas docentes', 'Horas asistentes', 'Total', 'Horas vacantes', 'Brecha lectiva (45 min)', 'Estado']], body: ind.bySchool.map(s => [s.id, s.name, s.modality, fmt(s.teacherHours), fmt(s.assistantHours), fmt(s.total), fmt(s.vacantHours), s.gap === null ? 'No aplica' : fmt(s.gap), s.status]), styles: { fontSize: 7 }, headStyles: { fillColor: BRAND }, didDrawPage: () => pdfFooter(pdf) });
  return pdf;
}

export function schoolSheet(state, id) {
  const school = state.schools.find(s => s.id === id); const sm = summarizeSchool(school, state.staff, state.plans);
  const people = state.staff.filter(p => p.schoolId === id); const vtf = school.modality === 'Jardín VTF';
  const adjust = p => p.projection + (p.projection === 'No renovación' ? ` (${p.contractHours} h)` : p.changeHours && p.projection !== 'Mantención' ? ` (${p.changeHours} h)` : '');
  const resumen = [['Establecimiento', school.name], ['ID demo', school.id], ['Modalidad', school.modality], ['Comuna', school.commune], ['Matrícula (ficticia)', sm.enrollment],
    ...(vtf ? [['Educadoras disponibles / requeridas', `${sm.educators} / ${sm.needEducators ?? 'por validar'}`], ['Técnicas disponibles / requeridas', `${sm.technicians} / ${sm.needTechnicians ?? 'por validar'}`]]
      : [['Proporción lectiva / no lectiva', `${fmt(school.lectiveRatio * 100)} / ${fmt((1 - school.lectiveRatio) * 100)}`], ['Jornada escolar completa', school.jec ? 'Sí' : 'No'], ['Horas pedagógicas requeridas', fmt(sm.required)], ['Horas pedagógicas asignadas', `${fmt(sm.assigned)}${sm.vacantPed ? ` (incluye ${fmt(sm.vacantPed)} de cargos vacantes)` : ''}`], ['Brecha (asignadas - requeridas)', fmt(sm.gap)]]),
    ['Estado', sm.status], ['Docentes', sm.teachers], ['Asistentes de la educación', sm.assistants], ['Cargos vacantes', sm.vacancies], ['Proyección 2027', school.projection], ['Justificación', school.justification || 'Sin cambios justificados en este escenario']];
  const pie = summarizePie(school, state.staff, state.settings);
  const tables = [
    school.modality === 'Técnico profesional' && { sheet: 'Formación TP', title: 'Cuadratura por tipo de formación', head: ['Formación', 'Requeridas (45 min)', 'Asignadas (45 min)', 'Brecha', 'Docentes'], body: summarizeTracks(school, state.staff, state.plans).tracks.map(t => [t.track, fmt(t.required), fmt(t.assigned), fmt(t.gap), t.teachers]) },
    school.modality === 'Microcentro' && { sheet: 'Escuelas rurales', title: 'Cuadratura por escuela rural', head: ['Escuela rural', 'Matrícula', 'Cursos combinados', 'Docentes', 'Requeridas', 'Asignadas', 'Brecha'], body: summarizeRural(school, state.staff, state.plans).members.map(m => [m.name, m.enrollment, m.groups, m.teachers, fmt(m.required), fmt(m.assigned), fmt(m.gap)]) },
    vtf && { sheet: 'Coeficientes VTF', title: 'Coeficientes por nivel (escenario)', head: ['Nivel', 'Matrícula', 'Niños por educadora', 'Niños por técnica'], body: vtfLevelsOf(school).map(l => [l.level, l.enrollment, l.educatorPerChildren ?? 'Por validar', l.technicianPerChildren ?? 'Por validar']) },
    pie && { sheet: 'PIE', title: 'Programa de Integración Escolar', head: ['Cursos PIE', 'NEE transitorias', 'NEE permanentes', 'Horas requeridas', 'Horas docentes PIE', 'Brecha'], body: [[pie.courses, pie.neet, pie.neep, fmt(pie.required), fmt(pie.assigned), fmt(pie.gap)]] },
    !vtf && { sheet: 'Plan de estudios', title: 'Plan de estudios (escenario)', head: ['Asignatura', 'Cursos', 'Horas por curso', 'Total (45 min)'], body: state.plans.filter(p => p.schoolId === id).map(p => [p.subject + (p.track === 'Formación diferenciada TP' ? ' (diferenciada TP)' : ''), p.groups, p.hoursPerGroup, fmt(p.groups * p.hoursPerGroup)]) },
    { sheet: 'Docentes', title: 'Dotación docente', head: ['RUT / ID', 'Nombre', 'Función', 'Cargo', 'Contrato', 'Horas contrato', 'Lectivas (45 min)', 'Financ.', 'Fuero', 'Proyección'], body: people.filter(p => p.type === 'Docente').map(p => [p.rut || p.id, p.name, teacherFunction(p.role), [p.role, p.track, p.ruralSchool].filter(Boolean).join(' | '), p.contract, p.contractHours, fmt(p.assignedPed), p.funding, hasFuero(p) ? 'Sí' : 'No', adjust(p)]) },
    { sheet: 'Asistentes', title: 'Asistentes de la educación', head: ['RUT', 'Nombre', 'Categoría', 'Cargo', 'Contrato', 'Horas contrato', 'Financ.', 'Fuero', 'Proyección'], body: people.filter(p => p.type === 'Asistente').map(p => [p.rut || p.id, p.name, assistantCategory(p.role), p.role, p.contract, p.contractHours, p.funding, hasFuero(p) ? 'Sí' : 'No', adjust(p)]) },
  ].filter(Boolean);
  return { school, resumen, tables };
}
export function schoolSheetPdf(state, id, { jsPDF, autoTable }) {
  const { school, resumen, tables } = schoolSheet(state, id); const pdf = new jsPDF({ orientation: 'landscape', compress: true });
  pdf.setFontSize(17); pdf.text(`Ficha de dotación 2027 | ${school.name}`, 14, 18); pdf.setFontSize(9); pdf.text(DISCLAIMER, 14, 25);
  autoTable(pdf, { startY: 30, body: resumen, theme: 'striped', styles: { fontSize: 8 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } }, didDrawPage: () => pdfFooter(pdf) });
  tables.forEach(t => pdfSection(pdf, autoTable, t, t.head.length > 8 ? 7 : 8));
  let y = pdf.lastAutoTable.finalY + 22;
  if (y > pdf.internal.pageSize.height - 40) { pdf.addPage(); pdfFooter(pdf); y = 40; }
  pdf.setFontSize(9); pdf.setDrawColor(150);
  [[14, 'Director(a) del establecimiento'], [160, 'Visación Servicio Local']].forEach(([x, label]) => { pdf.line(x, y, x + 110, y); pdf.text(label, x, y + 5); pdf.text('Nombre:', x, y + 12); pdf.text('Firma y timbre:', x, y + 19); pdf.text('Fecha:', x, y + 26); });
  return pdf;
}

// ---------- Planillas Excel de trabajo ----------
// No son volcados de tabla: cada hoja trae fórmulas (con su valor ya calculado), totales con SUBTOTAL que
// respetan los filtros, filtro por columna y una hoja de notas con unidades y reglas.
const HOURS = '#,##0.0';
const PCT = '0%';
const FIRST = 5; // primera fila de datos de las hojas tipo tabla (encabezado en la fila 4)
export const colName = i => { let s = ''; for (let n = i + 1; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
const q = name => /[^A-Za-z0-9_]/.test(name) ? `'${name}'` : name;
const total = (list, f) => round(list.reduce((n, x) => n + (Number(f(x)) || 0), 0));
const put = (ws, r, c, cell) => { if (cell) ws[colName(c) + (r + 1)] = cell; };
const cellOf = (v, z) => v === null || v === undefined || v === '' ? null : typeof v === 'number' ? { t: 'n', v, z } : { t: 's', v: String(v) };
const yes = b => b ? 'Sí' : 'No';

// columns: { key, label, width, value(row), formula?(row, at), total?, z? }. at(key) = celda de esa columna en la fila.
function tableSheet({ title, note, columns, rows, totals = true }) {
  const ws = {}; const last = FIRST - 1 + rows.length;
  put(ws, 0, 0, { t: 's', v: title }); if (note) put(ws, 1, 0, { t: 's', v: note });
  columns.forEach((c, i) => put(ws, FIRST - 2, i, { t: 's', v: c.label }));
  rows.forEach((row, n) => {
    const r = FIRST - 1 + n; const at = key => `${colName(columns.findIndex(c => c.key === key))}${r + 1}`;
    columns.forEach((c, i) => {
      const v = c.value(row); const f = c.formula?.(row, at);
      put(ws, r, i, f ? { t: typeof v === 'string' ? 's' : 'n', f, v: v ?? 0, z: c.z } : cellOf(v, c.z));
    });
  });
  let end = Math.max(last, FIRST - 1);
  if (totals && rows.length) {
    end = last + 1; put(ws, end - 1, 0, { t: 's', v: 'Total de las filas visibles' });
    columns.forEach((c, i) => { if (c.total) put(ws, end - 1, i, { t: 'n', f: `SUBTOTAL(9,${colName(i)}${FIRST}:${colName(i)}${last})`, v: total(rows, c.value), z: c.z }); });
  }
  ws['!ref'] = `A1:${colName(columns.length - 1)}${end}`;
  ws['!autofilter'] = { ref: `A${FIRST - 1}:${colName(columns.length - 1)}${Math.max(last, FIRST - 1)}` };
  ws['!cols'] = columns.map(c => ({ wch: c.width ?? Math.max(11, c.label.length + 2) }));
  return ws;
}
const letter = (columns, key) => colName(columns.findIndex(c => c.key === key));
const dataRange = (sheet, columns, key, rows) => `${q(sheet)}!$${letter(columns, key)}$${FIRST}:$${letter(columns, key)}$${FIRST - 1 + Math.max(rows, 1)}`;
const wholeCol = (sheet, columns, key) => `${q(sheet)}!$${letter(columns, key)}:$${letter(columns, key)}`;
function notesSheet(lines) {
  const ws = {}; const all = ['Cómo usar esta planilla', '', ...lines, '', 'Datos ficticios de demostración. Formato propio; pendiente adaptar a la planilla PAL de la DEP.'];
  all.forEach((t, r) => put(ws, r, 0, cellOf(t)));
  ws['!ref'] = `A1:A${all.length}`; ws['!cols'] = [{ wch: 130 }]; return ws;
}
// Hoja de resumen por bloques (título, encabezado y filas). Una fila con `key` deja su celda de valor en refs;
// las fórmulas pueden usar {clave} para apuntar a otra fila del mismo resumen.
function summarySheet(blocks, widths) {
  const ws = {}; let r = 0; const refs = {}; const pending = [];
  for (const block of blocks) {
    if (block.title) { put(ws, r, 0, { t: 's', v: block.title }); r++; }
    if (block.text) { put(ws, r, 0, { t: 's', v: block.text }); r++; }
    if (block.head) { block.head.forEach((h, c) => put(ws, r, c, cellOf(h))); r++; }
    for (const row of block.rows ?? []) {
      row.cells.forEach((cell, c) => {
        if (cell && typeof cell === 'object') { const out = { t: typeof cell.v === 'string' ? 's' : 'n', f: cell.f, v: cell.v, z: cell.z }; put(ws, r, c, out); pending.push(out); }
        else put(ws, r, c, cellOf(cell, row.z));
      });
      if (row.key) refs[row.key] = `$B$${r + 1}`;
      r++;
    }
    r++;
  }
  for (const cell of pending) cell.f = cell.f.replace(/\{(\w+)\}/g, (_, k) => refs[k]);
  ws['!ref'] = `A1:${colName(widths.length - 1)}${r}`; ws['!cols'] = widths.map(wch => ({ wch }));
  return { ws, refs };
}

function peopleColumns(byId) {
  const sch = p => byId.get(p.schoolId);
  const isTeacher = p => p.type === 'Docente';
  return [
    { key: 'id', label: 'ID', width: 11, value: p => p.id },
    { key: 'rut', label: 'RUT', width: 13, value: p => p.rut },
    { key: 'name', label: 'Nombre', width: 28, value: p => p.name },
    { key: 'sid', label: 'ID establecimiento', width: 11, value: p => p.schoolId },
    { key: 'school', label: 'Establecimiento', width: 30, value: p => sch(p)?.name },
    { key: 'mode', label: 'Modalidad', width: 20, value: p => sch(p)?.modality },
    { key: 'type', label: 'Tipo', width: 10, value: p => p.type },
    { key: 'role', label: 'Cargo', width: 24, value: p => p.role },
    { key: 'fn', label: 'Función o categoría', width: 20, value: p => isTeacher(p) ? teacherFunction(p.role) : assistantCategory(p.role) },
    { key: 'statute', label: 'Estatuto', width: 17, value: p => p.statute },
    { key: 'tramo', label: 'Tramo', width: 11, value: p => p.tramo },
    { key: 'contract', label: 'Contrato', width: 11, value: p => p.contract },
    { key: 'start', label: 'Fecha de ingreso', width: 12, value: p => p.startDate },
    { key: 'end', label: 'Fecha de término', width: 12, value: p => p.endDate },
    { key: 'h', label: 'Horas contrato (60 min)', width: 13, z: HOURS, total: true, value: p => p.contractHours },
    { key: 'hb', label: 'Horas básica (60 min)', width: 11, z: HOURS, total: true, value: p => p.hoursBasic },
    { key: 'hm', label: 'Horas media (60 min)', width: 11, z: HOURS, total: true, value: p => p.hoursMedia },
    { key: 'lect', label: 'Lectivas asignadas (45 min)', width: 13, z: HOURS, total: true, value: p => isTeacher(p) ? p.assignedPed : null },
    { key: 'ratio', label: 'Proporción lectiva', width: 11, z: PCT, value: p => isTeacher(p) ? sch(p)?.lectiveRatio : null },
    { key: 'cap', label: 'Capacidad lectiva (45 min)', width: 13, z: HOURS, total: true, value: p => isTeacher(p) ? capacityPedagogical(p.contractHours, sch(p)?.lectiveRatio) : null, formula: (p, at) => isTeacher(p) ? `ROUND(${at('h')}*${at('ratio')}*60/45,2)` : null },
    { key: 'slack', label: 'Holgura (45 min; negativo = sobrecarga)', width: 15, z: HOURS, total: true, value: p => isTeacher(p) ? round(capacityPedagogical(p.contractHours, sch(p)?.lectiveRatio) - p.assignedPed) : null, formula: (p, at) => isTeacher(p) ? `${at('cap')}-${at('lect')}` : null },
    { key: 'funding', label: 'Financiamiento', width: 12, value: p => p.funding },
    { key: 'track', label: 'Formación TP', width: 22, value: p => p.track },
    { key: 'rural', label: 'Escuela rural', width: 24, value: p => p.ruralSchool },
    { key: 'fuero', label: 'Fuero gremial', width: 9, value: p => yes(hasFuero(p)) },
    { key: 'vac', label: 'Cargo vacante', width: 9, value: p => yes(p.vacant) },
    { key: 'proj', label: 'Proyección 2027', width: 14, value: p => p.projection },
    { key: 'adj', label: 'Horas de ajuste (60 min)', width: 12, z: HOURS, total: true, value: p => p.projection === 'Mantención' ? 0 : p.projection === 'No renovación' ? p.contractHours : p.changeHours || 0 },
  ];
}
function planColumns(tp) {
  return [
    { key: 'subject', label: 'Asignatura o componente', width: 36, value: p => p.subject },
    ...(tp ? [{ key: 'track', label: 'Formación', width: 26, value: p => p.track || 'Formación general' }, { key: 'specialty', label: 'Especialidad', width: 22, value: p => p.specialty }] : []),
    { key: 'groups', label: 'Cursos o grupos', width: 12, value: p => p.groups },
    { key: 'hours', label: 'Horas por curso (45 min)', width: 13, z: HOURS, value: p => p.hoursPerGroup },
    { key: 'total', label: 'Total requerido (45 min)', width: 14, z: HOURS, total: true, value: p => p.groups * p.hoursPerGroup, formula: (p, at) => `${at('groups')}*${at('hours')}` },
  ];
}
function vtfColumns() {
  const need = (n, c) => Number.isInteger(c) && c > 0 ? Math.ceil(n / c) : '';
  return [
    { key: 'level', label: 'Nivel', width: 16, value: l => l.level }, { key: 'enr', label: 'Matrícula', width: 11, total: true, value: l => l.enrollment },
    { key: 'ce', label: 'Niños por educadora', width: 12, value: l => l.educatorPerChildren }, { key: 'ne', label: 'Educadoras requeridas', width: 13, total: true, value: l => need(l.enrollment, l.educatorPerChildren), formula: (l, at) => `IF(ISNUMBER(${at('ce')}),IF(${at('ce')}>0,ROUNDUP(${at('enr')}/${at('ce')},0),""),"")` },
    { key: 'ct', label: 'Niños por técnica', width: 12, value: l => l.technicianPerChildren }, { key: 'nt', label: 'Técnicas requeridas', width: 13, total: true, value: l => need(l.enrollment, l.technicianPerChildren), formula: (l, at) => `IF(ISNUMBER(${at('ct')}),IF(${at('ct')}>0,ROUNDUP(${at('enr')}/${at('ct')},0),""),"")` },
  ];
}

// Listas de las pantallas (establecimientos, dotación, plan y bitácora).
function listSpec({ kind, state, schools, people, school, summary, events }) {
  const byId = new Map(state.schools.map(s => [s.id, s]));
  if (kind === 'schools') return { sheet: 'Establecimientos', title: 'Establecimientos y microcentros · Dotación 2027', note: 'Brecha = horas asignadas - horas requeridas (horas pedagógicas de 45 min). Los jardines VTF se evalúan por coeficientes.', rows: schools, notes: ['La columna Brecha es una fórmula: si cambias horas requeridas o asignadas, se recalcula.', 'La fila final usa SUBTOTAL: al filtrar por modalidad, comuna o estado, suma solo las filas visibles.', 'Horas requeridas = cursos × horas por curso del plan de estudios. Horas asignadas incluyen los cargos vacantes por proveer.'], columns: [
    { key: 'id', label: 'ID', width: 9, value: s => s.id }, { key: 'name', label: 'Establecimiento', width: 34, value: s => s.name }, { key: 'mode', label: 'Modalidad', width: 20, value: s => s.modality }, { key: 'commune', label: 'Comuna', width: 14, value: s => s.commune },
    { key: 'teachers', label: 'Docentes', width: 10, total: true, value: s => s.teachers }, { key: 'vac', label: 'Cargos vacantes', width: 10, total: true, value: s => s.vacancies }, { key: 'assistants', label: 'Asistentes', width: 11, total: true, value: s => s.assistants },
    { key: 'req', label: 'Horas requeridas (45 min)', width: 13, z: HOURS, total: true, value: s => s.modality === 'Jardín VTF' ? null : s.required },
    { key: 'asg', label: 'Horas asignadas (45 min)', width: 13, z: HOURS, total: true, value: s => s.modality === 'Jardín VTF' ? null : s.assigned },
    { key: 'gap', label: 'Brecha (45 min)', width: 12, z: HOURS, total: true, value: s => s.modality === 'Jardín VTF' ? null : s.gap, formula: (s, at) => s.modality === 'Jardín VTF' ? null : `${at('asg')}-${at('req')}` },
    { key: 'status', label: 'Estado', width: 12, value: s => s.status }, { key: 'proj', label: 'Proyección 2027', width: 14, value: s => s.projection }, { key: 'just', label: 'Justificación', width: 50, value: s => s.justification },
  ] };
  if (kind === 'people') return { sheet: 'Dotación', title: 'Maestro de personal · Dotación 2027', note: 'Horas de contrato en 60 min; lectivas, capacidad y holgura en horas pedagógicas de 45 min.', rows: people, columns: peopleColumns(byId), notes: ['Capacidad lectiva = horas de contrato × proporción lectiva × 60/45 (fórmula). Holgura = capacidad - lectivas; un valor negativo es una sobrecarga.', 'Puedes cambiar horas de contrato, lectivas o la proporción de una persona: su capacidad y su holgura se recalculan.', 'La fila final usa SUBTOTAL: filtra por establecimiento, función o proyección y suma solo lo visible.', 'Horas de ajuste: horas que aumentan o se suprimen; para una no renovación, todas las horas del contrato.'] };
  if (kind === 'plan' && school.modality === 'Jardín VTF') return { sheet: 'Coeficientes VTF', title: `Coeficientes por nivel · ${school.name}`, note: 'Personas requeridas = matrícula / niños por persona, redondeado hacia arriba.', rows: vtfLevelsOf(school), notes: ['Las columnas de personas requeridas son fórmulas: cambia matrícula o coeficientes y se recalculan.', 'Los coeficientes son valores de escenario; deben validarse según nivel y edad.'], columns: vtfColumns() };
  if (kind === 'plan') return { sheet: 'Plan de estudios', title: `Plan de estudios · ${school.name}`, note: 'Horas pedagógicas de 45 min. Total = cursos × horas por curso.', rows: state.plans.filter(p => p.schoolId === school.id), notes: ['La columna Total es una fórmula: cambia cursos u horas por curso y el total se recalcula.', `Horas asignadas en la plataforma al exportar: ${fmt(summary.assigned)} h pedagógicas.`], columns: planColumns(school.modality === 'Técnico profesional') };
  return { sheet: 'Bitácora', title: 'Bitácora de cambios · Dotación 2027', note: 'Registro local del escenario de demostración.', rows: events, totals: false, notes: ['Cada fila es un cambio con su motivo. Filtra por acción para ver, por ejemplo, solo los cargos vacantes creados.'], columns: [
    { key: 'date', label: 'Fecha', width: 20, value: e => new Date(e.date).toLocaleString('es-CL') }, { key: 'action', label: 'Acción', width: 34, value: e => e.action }, { key: 'detail', label: 'Detalle y motivo', width: 110, value: e => e.detail }, { key: 'author', label: 'Autor', width: 22, value: e => e.author },
  ] };
}
export function listBook(XLSX, data) {
  const spec = listSpec(data);
  const rows = spec.rows.map(r => Object.fromEntries(spec.columns.map(c => [c.label, c.value(r) ?? ''])));
  if (!XLSX) return { rows };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, tableSheet(spec), spec.sheet);
  XLSX.utils.book_append_sheet(wb, notesSheet(spec.notes), 'Notas');
  return { rows, wb };
}

// Ficha de trabajo por establecimiento: el resumen se calcula con fórmulas desde el plan y la dotación.
export function schoolSheetBook(state, id, XLSX) {
  const school = state.schools.find(s => s.id === id); const sm = summarizeSchool(school, state.staff, state.plans);
  const byId = new Map(state.schools.map(s => [s.id, s]));
  const vtf = school.modality === 'Jardín VTF'; const tp = school.modality === 'Técnico profesional'; const micro = school.modality === 'Microcentro';
  const staff = state.staff.filter(p => p.schoolId === id);
  const teachers = staff.filter(p => p.type === 'Docente'); const assistants = staff.filter(p => p.type === 'Asistente');
  const plans = state.plans.filter(p => p.schoolId === id);
  const base = peopleColumns(byId);
  const tCols = base.filter(c => !['sid', 'school', 'mode', 'type', 'track', 'rural'].includes(c.key));
  tCols.splice(tCols.findIndex(c => c.key === 'contract'), 0, { key: 'grp', label: tp ? 'Formación TP' : micro ? 'Escuela rural' : 'Formación o escuela', width: 26, value: p => p.track || p.ruralSchool });
  const aCols = base.filter(c => ['id', 'rut', 'name', 'fn', 'role', 'statute', 'contract', 'start', 'end', 'h', 'funding', 'fuero', 'proj', 'adj'].includes(c.key));
  const pCols = planColumns(tp);
  const D = 'Docentes', A = 'Asistentes', P = 'Plan de estudios';
  const vac = wholeCol(D, tCols, 'vac');
  const sheets = [[D, tableSheet({ title: `Dotación docente · ${school.name}`, note: 'Capacidad y holgura son fórmulas por persona.', columns: tCols, rows: teachers })], [A, tableSheet({ title: `Asistentes de la educación · ${school.name}`, columns: aCols, rows: assistants })]];
  if (!vtf) sheets.push([P, tableSheet({ title: `Plan de estudios · ${school.name}`, note: 'Total = cursos × horas por curso (fórmula).', columns: pCols, rows: plans })]);
  const blocks = [{ title: `Ficha de dotación 2027 · ${school.name}`, text: 'Datos ficticios. Las celdas con fórmula se recalculan si cambias el plan o la dotación en las otras hojas.' },
    { title: 'Datos del establecimiento', rows: [['Establecimiento', school.name], ['ID demo', school.id], ['Modalidad', school.modality], ['Comuna', school.commune], ['Matrícula (ficticia)', sm.enrollment], ...(vtf ? [] : [['Proporción lectiva', school.lectiveRatio], ['Jornada escolar completa', yes(school.jec)]]), ['Proyección 2027', school.projection], ['Justificación', school.justification || 'Sin decisión justificada']].map(([k, v]) => ({ cells: [k, v], z: k === 'Proporción lectiva' ? PCT : undefined })) }];
  if (!vtf) blocks.push({ title: 'Cuadratura (horas pedagógicas de 45 min)', head: ['Concepto', 'Valor', '', 'Cómo se calcula'], rows: [
    { key: 'req', cells: ['Horas requeridas', { f: `SUM(${dataRange(P, pCols, 'total', plans.length)})`, v: sm.required, z: HOURS }, '', 'Suma de la columna Total de la hoja Plan de estudios'] },
    { key: 'asg', cells: ['Horas asignadas', { f: `SUM(${dataRange(D, tCols, 'lect', teachers.length)})`, v: sm.assigned, z: HOURS }, '', 'Suma de lectivas de la hoja Docentes (incluye cargos vacantes)'] },
    { cells: ['Brecha (asignadas - requeridas)', { f: '{asg}-{req}', v: sm.gap, z: HOURS }, '', 'Negativo = déficit; positivo = excedente'] },
    { cells: ['Capacidad lectiva máxima', { f: `SUM(${dataRange(D, tCols, 'cap', teachers.length)})`, v: sm.capacity, z: HOURS }, '', 'Contrato × proporción lectiva × 60/45, por docente'] },
    { cells: ['Estado al exportar', sm.status] },
  ] });
  blocks.push({ title: 'Personas', rows: [
    { cells: ['Docentes vigentes', { f: `COUNTIF(${vac},"No")`, v: sm.teachers }] },
    { cells: ['Cargos vacantes por proveer', { f: `COUNTIF(${vac},"Sí")`, v: sm.vacancies }] },
    { cells: ['Asistentes de la educación', { f: `COUNTA(${dataRange(A, aCols, 'id', assistants.length)})`, v: sm.assistants }] },
  ] });
  if (tp) { const t = summarizeTracks(school, state.staff, state.plans); sheets.push(['Formación TP', tableSheet({ title: 'Cuadratura por tipo de formación', note: 'Calculada con SUMIFS sobre el plan y la dotación.', rows: t.tracks, columns: [
    { key: 'track', label: 'Formación', width: 28, value: x => x.track },
    { key: 'req', label: 'Requeridas (45 min)', width: 14, z: HOURS, total: true, value: x => x.required, formula: (x, at) => `SUMIFS(${wholeCol(P, pCols, 'total')},${wholeCol(P, pCols, 'track')},${at('track')})` },
    { key: 'asg', label: 'Asignadas (45 min)', width: 14, z: HOURS, total: true, value: x => x.assigned, formula: (x, at) => `SUMIFS(${wholeCol(D, tCols, 'lect')},${wholeCol(D, tCols, 'grp')},${at('track')})` },
    { key: 'gap', label: 'Brecha (45 min)', width: 12, z: HOURS, total: true, value: x => x.gap, formula: (x, at) => `${at('asg')}-${at('req')}` },
    { key: 'n', label: 'Docentes', width: 10, total: true, value: x => x.teachers, formula: (x, at) => `COUNTIFS(${wholeCol(D, tCols, 'grp')},${at('track')},${vac},"No")` },
  ] })]); }
  if (micro) { const r = summarizeRural(school, state.staff, state.plans); sheets.push(['Escuelas rurales', tableSheet({ title: 'Cuadratura por escuela rural', note: 'Cambia los cursos combinados de una escuela y su requerimiento se recalcula.', rows: r.members, columns: [
    { key: 'name', label: 'Escuela rural', width: 28, value: m => m.name }, { key: 'enr', label: 'Matrícula', width: 11, total: true, value: m => m.enrollment }, { key: 'groups', label: 'Cursos combinados', width: 12, total: true, value: m => m.groups },
    { key: 'per', label: 'Horas por curso (45 min)', width: 13, z: HOURS, value: () => r.perGroup, formula: () => `SUM(${dataRange(P, pCols, 'hours', plans.length)})` },
    { key: 'req', label: 'Requeridas (45 min)', width: 13, z: HOURS, total: true, value: m => m.required, formula: (m, at) => `${at('groups')}*${at('per')}` },
    { key: 'asg', label: 'Asignadas (45 min)', width: 13, z: HOURS, total: true, value: m => m.assigned, formula: (m, at) => `SUMIFS(${wholeCol(D, tCols, 'lect')},${wholeCol(D, tCols, 'grp')},${at('name')})` },
    { key: 'gap', label: 'Brecha (45 min)', width: 12, z: HOURS, total: true, value: m => m.gap, formula: (m, at) => `${at('asg')}-${at('req')}` },
    { key: 'n', label: 'Docentes', width: 10, total: true, value: m => m.teachers, formula: (m, at) => `COUNTIFS(${wholeCol(D, tCols, 'grp')},${at('name')},${vac},"No")` },
  ] })]); }
  if (vtf) { const levels = vtfLevelsOf(school); const cols = vtfColumns(); sheets.push(['Coeficientes VTF', tableSheet({ title: 'Coeficientes por nivel (escenario)', note: 'Personas requeridas = matrícula / niños por persona, redondeado hacia arriba.', columns: cols, rows: levels })]);
    blocks.push({ title: 'Personal requerido VTF', head: ['Concepto', 'Requeridas', 'Disponibles'], rows: [
      { cells: ['Educadoras de párvulos', { f: `SUM(${dataRange('Coeficientes VTF', cols, 'ne', levels.length)})`, v: sm.needEducators ?? 0 }, { f: `COUNTIFS(${wholeCol(D, tCols, 'role')},"Educadora de párvulos",${vac},"No")`, v: sm.educators }] },
      { cells: ['Técnicas en párvulos', { f: `SUM(${dataRange('Coeficientes VTF', cols, 'nt', levels.length)})`, v: sm.needTechnicians ?? 0 }, { f: `COUNTIF(${wholeCol(A, aCols, 'role')},"Técnica en párvulos")`, v: sm.technicians }] },
    ] }); }
  const pie = summarizePie(school, state.staff, state.settings);
  if (pie) { const per = school.jec ? state.settings.pieHoursJec : state.settings.pieHoursNoJec; sheets.push(['PIE', tableSheet({ title: 'Programa de Integración Escolar', note: 'Cambia cursos, estudiantes u horas por curso y se recalcula el requerimiento.', rows: [pie], totals: false, columns: [
    { key: 'courses', label: 'Cursos con PIE', width: 11, value: () => pie.courses }, { key: 'neet', label: 'NEE transitorias', width: 12, value: () => pie.neet }, { key: 'neep', label: 'NEE permanentes', width: 12, value: () => pie.neep },
    { key: 'per', label: `Horas de apoyo por curso (${school.jec ? 'con' : 'sin'} JEC)`, width: 16, z: HOURS, value: () => per },
    { key: 'req', label: 'Horas requeridas', width: 12, z: HOURS, value: () => pie.required, formula: (x, at) => `${at('courses')}*${at('per')}` },
    { key: 'reqT', label: 'Requeridas NEE transitorias', width: 14, z: HOURS, value: () => pie.requiredT, formula: (x, at) => `IF(${at('neet')}+${at('neep')}>0,ROUND(${at('req')}*${at('neet')}/(${at('neet')}+${at('neep')}),2),0)` },
    { key: 'reqP', label: 'Requeridas NEE permanentes', width: 14, z: HOURS, value: () => pie.requiredP, formula: (x, at) => `IF(${at('neet')}+${at('neep')}>0,ROUND(${at('req')}*${at('neep')}/(${at('neet')}+${at('neep')}),2),0)` },
    { key: 'asg', label: 'Horas docentes PIE contratadas', width: 15, z: HOURS, value: () => pie.assigned, formula: () => `SUMIFS(${wholeCol(D, tCols, 'h')},${wholeCol(D, tCols, 'funding')},"PIE")` },
    { key: 'gap', label: 'Brecha PIE', width: 11, z: HOURS, value: () => pie.gap, formula: (x, at) => `${at('asg')}-${at('req')}` },
  ] })]); }
  blocks.push({ title: 'Firmas', rows: [{ cells: ['Director(a) del establecimiento', 'Nombre, firma y timbre:'] }, { cells: ['Visación Servicio Local', 'Nombre, firma y fecha:'] }] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, summarySheet(blocks, [40, 46, 14, 56]).ws, 'Resumen');
  sheets.forEach(([name, ws]) => XLSX.utils.book_append_sheet(wb, ws, name));
  XLSX.utils.book_append_sheet(wb, notesSheet(['Resumen: la cuadratura se calcula con fórmulas desde las hojas Plan de estudios y Docentes.', 'Docentes: capacidad = horas de contrato × proporción lectiva × 60/45; una holgura negativa es una sobrecarga.', 'Plan de estudios: total = cursos × horas por curso. Si agregas filas, extiende el rango de la suma del Resumen.', 'Las filas "Total de las filas visibles" usan SUBTOTAL y respetan los filtros.', 'Horas de contrato en 60 min; lectivas, capacidad y plan en horas pedagógicas de 45 min.']), 'Notas');
  return wb;
}

// Indicadores PAL: el resumen se calcula con fórmulas desde la hoja Personal; los supuestos son celdas editables.
export function indicatorsBook(ind, XLSX, { state, label, ids }) {
  const byId = new Map(state.schools.map(s => [s.id, s]));
  const schools = state.schools.filter(s => ids.has(s.id));
  const staff = state.staff.filter(p => ids.has(p.schoolId));
  const R = 'Resumen PAL', PS = 'Personal', E = 'Establecimientos', M = 'Por modalidad';
  const S = { lunchMin: `${q(R)}!$B$6`, lunchFrom: `${q(R)}!$B$7`, pieJec: `${q(R)}!$B$8`, pieNoJec: `${q(R)}!$B$9` };
  const classroom = p => p.type === 'Docente' && byId.get(p.schoolId).modality !== 'Jardín VTF';
  const kind = (p, fn) => { if (!classroom(p)) return 0; const aula = round(Math.min(p.contractHours, p.assignedPed * 45 / 60)); return fn === 'aula' ? aula : teacherFunction(p.role) === fn ? round(p.contractHours - aula) : 0; };
  const typeFormula = fn => (p, at) => `IF(AND(${at('type')}="Docente",${at('mode')}<>"Jardín VTF"${fn ? `,${at('fn')}="${fn}"` : ''}),${fn ? `${at('h')}-${at('aula')}` : `ROUND(MIN(${at('h')},${at('lect')}*45/60),2)`},0)`;
  const pCols = [...peopleColumns(byId),
    { key: 'aula', label: 'Lectivas en aula (60 min)', width: 13, z: HOURS, value: p => kind(p, 'aula'), formula: typeFormula(null) },
    { key: 'nl', label: 'Curriculares no lectivas (60 min)', width: 14, z: HOURS, value: p => kind(p, 'Docente de aula'), formula: typeFormula('Docente de aula') },
    { key: 'dir', label: 'Directivas (60 min)', width: 12, z: HOURS, value: p => kind(p, 'Directiva'), formula: typeFormula('Directiva') },
    { key: 'tec', label: 'Técnico-pedagógicas (60 min)', width: 14, z: HOURS, value: p => kind(p, 'Técnico-pedagógica'), formula: typeFormula('Técnico-pedagógica') }];
  const col = key => wholeCol(PS, pCols, key);
  const live = `${col('vac')},"No"`;
  const sums = schools.map(s => summarizeSchool(s, state.staff, state.plans));
  const pies = new Map(schools.map(s => [s.id, summarizePie(s, state.staff, state.settings)]));
  const sumOf = s => sums.find(x => x.id === s.id);
  const sumWhere = (list, f) => list.reduce((n, p) => n + f(p), 0);
  const eCols = [
    { key: 'id', label: 'ID', width: 9, value: s => s.id }, { key: 'name', label: 'Establecimiento', width: 32, value: s => s.name }, { key: 'mode', label: 'Modalidad', width: 20, value: s => s.modality }, { key: 'commune', label: 'Comuna', width: 14, value: s => s.commune },
    { key: 'jec', label: 'JEC', width: 6, value: s => s.modality === 'Jardín VTF' ? '' : yes(s.jec) },
    { key: 'req', label: 'Horas requeridas (45 min)', width: 13, z: HOURS, total: true, value: s => s.modality === 'Jardín VTF' ? null : sumOf(s).required },
    { key: 'asg', label: 'Horas asignadas (45 min)', width: 13, z: HOURS, total: true, value: s => s.modality === 'Jardín VTF' ? null : sumOf(s).assigned, formula: (s, at) => s.modality === 'Jardín VTF' ? null : `SUMIFS(${col('lect')},${col('sid')},${at('id')},${col('type')},"Docente")` },
    { key: 'gap', label: 'Brecha (45 min)', width: 12, z: HOURS, total: true, value: s => s.modality === 'Jardín VTF' ? null : sumOf(s).gap, formula: (s, at) => s.modality === 'Jardín VTF' ? null : `${at('asg')}-${at('req')}` },
    { key: 'th', label: 'Horas docentes (60 min)', width: 13, z: HOURS, total: true, value: s => sumWhere(staff, p => p.schoolId === s.id && p.type === 'Docente' && !p.vacant ? p.contractHours : 0), formula: (s, at) => `SUMIFS(${col('h')},${col('sid')},${at('id')},${col('type')},"Docente",${live})` },
    { key: 'ah', label: 'Horas asistentes (60 min)', width: 13, z: HOURS, total: true, value: s => sumWhere(staff, p => p.schoolId === s.id && p.type === 'Asistente' && !p.vacant ? p.contractHours : 0), formula: (s, at) => `SUMIFS(${col('h')},${col('sid')},${at('id')},${col('type')},"Asistente",${live})` },
    { key: 'tot', label: 'Horas totales (60 min)', width: 13, z: HOURS, total: true, value: s => sumWhere(staff, p => p.schoolId === s.id && !p.vacant ? p.contractHours : 0), formula: (s, at) => `${at('th')}+${at('ah')}` },
    { key: 'vh', label: 'Horas vacantes (60 min)', width: 12, z: HOURS, total: true, value: s => sumWhere(staff, p => p.schoolId === s.id && p.vacant ? p.contractHours : 0), formula: (s, at) => `SUMIFS(${col('h')},${col('sid')},${at('id')},${col('vac')},"Sí")` },
    { key: 'pc', label: 'Cursos PIE', width: 9, total: true, value: s => pies.get(s.id)?.courses ?? null }, { key: 'pt', label: 'NEE transitorias', width: 11, total: true, value: s => pies.get(s.id)?.neet ?? null }, { key: 'pp', label: 'NEE permanentes', width: 11, total: true, value: s => pies.get(s.id)?.neep ?? null },
    { key: 'pr', label: 'Horas PIE requeridas', width: 12, z: HOURS, total: true, value: s => pies.get(s.id)?.required ?? null, formula: (s, at) => pies.get(s.id) ? `${at('pc')}*IF(${at('jec')}="Sí",${S.pieJec},${S.pieNoJec})` : null },
    { key: 'prt', label: 'PIE NEE transitorias', width: 12, z: HOURS, total: true, value: s => pies.get(s.id)?.requiredT ?? null, formula: (s, at) => pies.get(s.id) ? `IF(${at('pt')}+${at('pp')}>0,ROUND(${at('pr')}*${at('pt')}/(${at('pt')}+${at('pp')}),2),0)` : null },
    { key: 'prp', label: 'PIE NEE permanentes', width: 12, z: HOURS, total: true, value: s => pies.get(s.id)?.requiredP ?? null, formula: (s, at) => pies.get(s.id) ? `IF(${at('pt')}+${at('pp')}>0,ROUND(${at('pr')}*${at('pp')}/(${at('pt')}+${at('pp')}),2),0)` : null },
    { key: 'pd', label: 'Horas docentes PIE', width: 12, z: HOURS, total: true, value: s => pies.get(s.id)?.assigned ?? null, formula: (s, at) => pies.get(s.id) ? `SUMIFS(${col('h')},${col('sid')},${at('id')},${col('type')},"Docente",${col('funding')},"PIE")` : null },
    { key: 'status', label: 'Estado', width: 12, value: s => sumOf(s).status },
  ];
  const eRange = key => dataRange(E, eCols, key, schools.length);
  const mCols = [
    { key: 'mode', label: 'Modalidad', width: 22, value: m => m.modality },
    { key: 'units', label: 'Unidades', width: 10, total: true, value: m => m.units, formula: (m, at) => `COUNTIF(${eRange('mode')},${at('mode')})` },
    { key: 'people', label: 'Personas', width: 10, total: true, value: m => m.people, formula: (m, at) => `COUNTIFS(${col('mode')},${at('mode')},${live})` },
    { key: 'th', label: 'Horas docentes (60 min)', width: 14, z: HOURS, total: true, value: m => m.teacherHours, formula: (m, at) => `SUMIFS(${col('h')},${col('mode')},${at('mode')},${col('type')},"Docente",${live})` },
    { key: 'ah', label: 'Horas asistentes (60 min)', width: 14, z: HOURS, total: true, value: m => m.assistantHours, formula: (m, at) => `SUMIFS(${col('h')},${col('mode')},${at('mode')},${col('type')},"Asistente",${live})` },
    { key: 'tot', label: 'Horas totales (60 min)', width: 14, z: HOURS, total: true, value: m => m.total, formula: (m, at) => `${at('th')}+${at('ah')}` },
  ];
  const modeRow = name => `${q(M)}!$F$${FIRST + ind.byModality.findIndex(m => m.modality === name)}`;
  // Fórmulas en el mismo orden que indicatorRows(ind).
  const formulas = [
    [`SUMIFS(${col('h')},${col('type')},"Docente",${live})`, 'Suma de horas de contrato de docentes que no son cargos vacantes'],
    [`COUNTIFS(${col('type')},"Docente",${live})`, 'Docentes que no son cargos vacantes'],
    [`COUNTIFS(${col('type')},"Asistente",${live})`, 'Asistentes vigentes'],
    [`SUMIFS(${col('h')},${col('type')},"Asistente",${live})`, 'Horas de contrato de asistentes'],
    ['ROUND({4}/44,2)', 'Horas de asistentes / 44'],
    [`COUNTIFS(${col('mode')},"Jardín VTF",${col('role')},"Educadora de párvulos",${live})`, 'Cargo Educadora de párvulos en jardines VTF'],
    [`COUNTIFS(${col('mode')},"Jardín VTF",${col('role')},"Técnica en párvulos",${live})`, 'Cargo Técnica en párvulos en jardines VTF'],
    [`SUMIFS(${col('adj')},${col('proj')},"Disminución",${live})`, 'Horas de ajuste de personas con proyección Disminución'],
    [`SUMIF(${eRange('gap')},">0")`, 'Suma de brechas positivas de la hoja Establecimientos'],
    [`COUNTIFS(${col('proj')},"No renovación",${live})`, 'Personas con proyección No renovación'],
    [`SUMIFS(${col('h')},${col('proj')},"No renovación",${live})`, 'Horas de contrato de esas personas'],
    [`COUNTIFS(${col('vac')},"Sí")`, 'Filas marcadas como cargo vacante'],
    [`SUMIFS(${col('h')},${col('vac')},"Sí")`, 'Horas de contrato de los cargos vacantes'],
    [`SUMIFS(${col('aula')},${live})`, 'Columna Lectivas en aula de la hoja Personal'],
    [`SUMIFS(${col('nl')},${live})`, 'Columna Curriculares no lectivas'],
    [`SUMIFS(${col('dir')},${live})`, 'Columna Directivas'],
    [`SUMIFS(${col('tec')},${live})`, 'Columna Técnico-pedagógicas'],
    ...['General', 'SEP', 'PIE', 'VTF'].map(f => [`SUMIFS(${col('h')},${col('type')},"Docente",${col('funding')},"${f}",${live})`, `Horas docentes financiadas por ${f}`]),
    [`ROUND(COUNTIFS(${live},${col('h')},">="&${S.lunchFrom})*${S.lunchMin}*5/60,2)`, 'Personas con jornada desde el umbral × minutos diarios × 5 días / 60'],
    [`COUNTIFS(${col('fuero')},"Sí",${live})`, 'Personas con fuero gremial'],
    [`SUMIFS(${col('h')},${col('fuero')},"Sí",${live})`, 'Horas de contrato de personas con fuero'],
    ...TEACHER_FUNCTIONS.map(f => [`COUNTIFS(${col('type')},"Docente",${col('mode')},"<>Jardín VTF",${col('fn')},"${f}",${live})`, `Docentes de establecimientos escolares con función ${f}`]),
    ...Object.keys(ind.assistantCategories).map(c => [`COUNTIFS(${col('type')},"Asistente",${col('fn')},"${c}",${live})`, `Asistentes de categoría ${c}`]),
    [`SUM(${eRange('pt')})`, 'Suma de NEE transitorias por establecimiento'],
    [`SUM(${eRange('pp')})`, 'Suma de NEE permanentes por establecimiento'],
    [`SUM(${eRange('prt')})`, 'Horas requeridas repartidas según estudiantes'],
    [`SUM(${eRange('prp')})`, 'Horas requeridas repartidas según estudiantes'],
    [`SUM(${eRange('pd')})`, 'Horas docentes financiadas por PIE'],
    ...ind.byModality.map(m => [modeRow(m.modality), 'Hoja Por modalidad']),
  ];
  const rows = indicatorRows(ind);
  if (rows.length !== formulas.length) throw new Error('Indicadores y fórmulas no calzan');
  const first = 12; // fila de Excel del primer indicador
  const ws = {};
  [[0, `Indicadores de dotación 2027 · Plan Anual Local`], [1, label], [2, `Generado el ${new Date().toLocaleString('es-CL')} · datos ficticios de demostración`], [4, 'Supuestos de cálculo (puedes cambiar la columna B: los indicadores se recalculan)']].forEach(([r, t]) => put(ws, r, 0, cellOf(t)));
  [['Colación diaria (minutos)', state.settings.lunchMinutesPerDay], ['Colación desde jornadas de (horas semanales)', state.settings.lunchFromHours], ['Apoyo PIE por curso con JEC (horas)', state.settings.pieHoursJec], ['Apoyo PIE por curso sin JEC (horas)', state.settings.pieHoursNoJec]].forEach(([k, v], i) => { put(ws, 5 + i, 0, cellOf(k)); put(ws, 5 + i, 1, cellOf(v)); });
  ['Sección', 'Indicador', 'Valor', 'Unidad', 'Cómo se calcula'].forEach((h, c) => put(ws, first - 2, c, cellOf(h)));
  rows.forEach((row, i) => {
    const r = first - 1 + i; const [f, how] = formulas[i];
    put(ws, r, 0, cellOf(row.Seccion)); put(ws, r, 1, cellOf(row.Indicador));
    put(ws, r, 2, { t: 'n', f: f.replace(/\{(\d+)\}/g, (_, n) => `C${first - 1 + Number(n)}`), v: row.Valor, z: Number.isInteger(row.Valor) ? '#,##0' : HOURS });
    put(ws, r, 3, cellOf(row.Unidad)); put(ws, r, 4, cellOf(how));
  });
  ws['!ref'] = `A1:E${first - 1 + rows.length}`; ws['!cols'] = [{ wch: 22 }, { wch: 48 }, { wch: 14 }, { wch: 24 }, { wch: 70 }];
  ws['!autofilter'] = { ref: `A${first - 1}:E${first - 1 + rows.length}` };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, R);
  XLSX.utils.book_append_sheet(wb, tableSheet({ title: 'Horas por establecimiento', note: 'Calculado con SUMIFS desde la hoja Personal. Las horas PIE requeridas usan los supuestos del Resumen.', columns: eCols, rows: schools }), E);
  XLSX.utils.book_append_sheet(wb, tableSheet({ title: 'Horas por modalidad', note: 'Calculado con SUMIFS desde la hoja Personal.', columns: mCols, rows: ind.byModality }), M);
  XLSX.utils.book_append_sheet(wb, tableSheet({ title: 'Personal del escenario', note: 'Base de todos los indicadores. Cambia horas, función o proyección de una persona y el Resumen se recalcula.', columns: pCols, rows: staff, totals: false }), PS);
  XLSX.utils.book_append_sheet(wb, notesSheet(['Resumen PAL: cada indicador es una fórmula sobre la hoja Personal o Establecimientos; la columna E explica el cálculo.', 'Supuestos: las celdas B6 a B9 del Resumen alimentan la colación y las horas PIE requeridas.', 'Personal: las columnas de tipos de hora se calculan por persona (lectivas en aula = lectivas × 45/60).', 'Establecimientos y Por modalidad: filtra por columna; la fila final usa SUBTOTAL y suma solo lo visible.', 'Horas de contrato en 60 min; lectivas y brechas en horas pedagógicas de 45 min.']), 'Notas');
  return wb;
}

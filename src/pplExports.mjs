// Informes del optimizador: general, por establecimiento, por docente y planificación completa.
import { fmt } from './core.mjs';
import { BRAND, pdfFooter, pdfSection, tableSheet, notesSheet } from './exports.mjs';
import { formatPct } from './pplReport.mjs';

const PERIOD = { 1: 'Marzo–julio', 2: 'Agosto–diciembre' };
const NOTE = 'DEMOSTRACION - Datos ficticios. Habilitaciones, licencias y retiros son datos de escenario.';
const CATEGORIES = [['requeridas', 'Horas del plan (45 min)'], ['propias', 'Cubiertas por docentes propios'], ['llegadas', 'Cubiertas por docentes de otros colegios'], ['vacantes', 'Sin docente (a contratar)'], ['pieRequeridas', 'Apoyo PIE requerido (60 min)'], ['pieCubiertas', 'Apoyo PIE cubierto'], ['piePendientes', 'Apoyo PIE pendiente'], ['contratoAntes', 'Horas de contrato antes (60 min)'], ['contratoDespues', 'Horas de contrato propuestas'], ['directivas', 'Horas directivas y técnicas'], ['extensiones', 'Horas de extensión de jornada']];
export const categoryRows = school => CATEGORIES.map(([k, label]) => [label, fmt(school.per[1]?.[k] ?? 0), fmt(school.per[2]?.[k] ?? 0)]);
const arrow = (a, b) => `${a} → ${b}`;

function start(kit, title, subtitle, landscape = false) {
  const pdf = new kit.jsPDF({ orientation: landscape ? 'landscape' : 'portrait', compress: true });
  pdf.setFontSize(16); pdf.text(title, 14, 18); pdf.setFontSize(9); pdf.text(subtitle, 14, 25); pdf.text(NOTE, 14, 30);
  return pdf;
}
function summaryBody(s) {
  return [['Horas de clases sin docente (por periodo)', arrow(fmt(s.uncoveredBefore), fmt(s.uncoveredAfter))], ['Colegios con cursos sin docente', arrow(s.withVacanciesBefore, s.withVacanciesAfter)], ['Docentes con carga eficiente', arrow(s.efficientBefore, s.efficientAfter)], ['Docentes con carga ineficiente o sin clases', arrow(s.inefficientBefore, s.inefficientAfter)], ['Horas de contrato docentes', arrow(fmt(s.contractBefore), fmt(s.contractAfter))], ['Cursos a contratar (promedio por periodo)', fmt(s.hireCourses)], ['Traslados sugeridos', s.moves], ['Extensiones de jornada', `${s.extensions} docentes · ${fmt(s.extensionHours)} h`], ['Supresiones', `${s.suppressions} docentes · ${fmt(s.suppressionHours)} h`], ['Contratas renovadas / no renovadas', `${s.renewed} / ${s.notRenewed}`], ['Balance (holgura relativa máxima)', formatPct(s.theta)]];
}

export function generalPdf(rep, label, kit) {
  const pdf = start(kit, 'Optimización de la dotación 2027 · Informe general', label);
  kit.autoTable(pdf, { startY: 36, body: summaryBody(rep.summary), theme: 'striped', styles: { fontSize: 9 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 95 } }, didDrawPage: () => pdfFooter(pdf) });
  pdfSection(pdf, kit.autoTable, { title: 'Fases del modelo', head: ['Comuna', 'Fase', 'Estado', 'Valor', 'Seg.'], body: rep.summary.phases.map(p => [p.part, p.label, p.status, p.value === null ? '—' : fmt(p.value), fmt(p.seconds)]) }, 7);
  pdfSection(pdf, kit.autoTable, { title: 'Establecimientos', head: ['Establecimiento', 'Brecha antes', 'Sin docente antes', 'Sin docente después', 'Recibe', 'Presta', 'Sugerencia principal'], body: rep.schools.map(s => [s.name, fmt(s.gapBefore), fmt(s.uncoveredBefore), fmt(s.uncoveredAfter), s.incoming.length, s.outgoing.length, s.suggestions[0]]) }, 7);
  if (rep.moves.length) pdfSection(pdf, kit.autoTable, { title: 'Traslados sugeridos', head: ['Docente', 'Desde', 'Hacia', 'Horas en destino', 'Tipo', 'Asignaturas'], body: rep.moves.map(m => [m.name, m.fromName, m.toName, fmt(m.destHours), m.kind, m.subjects.join(', ')]) }, 7);
  return pdf;
}

export function schoolsPdf(rep, R, ids, kit) {
  const list = rep.schools.filter(s => ids.includes(s.id));
  const pdf = start(kit, list.length === 1 ? `Planificación óptima · ${list[0].name}` : 'Planificación óptima por establecimiento', `${list.length} establecimiento${list.length > 1 ? 's' : ''}`, true);
  list.forEach((s, k) => {
    if (k > 0) { pdf.addPage(); pdf.lastAutoTable = null; pdf.setFontSize(14); pdf.text(s.name, 14, 16); }
    else { pdf.setFontSize(12); pdf.text(s.name, 14, 37); }
    kit.autoTable(pdf, { startY: k > 0 ? 22 : 41, head: [['Horas por categoría', PERIOD[1], PERIOD[2]]], body: categoryRows(s), styles: { fontSize: 8 }, headStyles: { fillColor: BRAND }, didDrawPage: () => pdfFooter(pdf) });
    pdfSection(pdf, kit.autoTable, { title: 'Sugerencias', head: ['Sugerencia'], body: s.suggestions.map(x => [x]) }, 8);
    pdfSection(pdf, kit.autoTable, { title: `Planificación ${PERIOD[1].toLowerCase()}`, head: ['Curso', 'Asignatura', 'Horas', 'Docente', 'Origen'], body: (R.plan[`${s.id}|1`] ?? []).slice().sort((a, b) => a.course.localeCompare(b.course, 'es') || a.subject.localeCompare(b.subject, 'es')).map(r => [r.course, r.subject, fmt(r.hours), r.name, !r.teacher ? 'Por contratar' : r.origin === s.id ? 'Propio' : rep.schools.find(x => x.id === r.origin)?.name ?? r.origin]) }, 7);
    const staff = rep.teachers.filter(t => t.origin === s.id || t.otherSchool === s.id);
    pdfSection(pdf, kit.autoTable, { title: 'Docentes', head: ['Docente', 'Contrato', 'Lectivas', 'Uso de capacidad', 'Estado', 'Sugerencia'], body: staff.map(t => [t.name, arrow(fmt(t.contract), fmt(t.contractAfter)), arrow(fmt(t.lectivasBefore), fmt(t.lectivasAfter)), arrow(formatPct(t.utilBefore), formatPct(t.utilAfter)), t.label, t.suggestions.join(' ')]) }, 7);
  });
  return pdf;
}

const teacherColumns = [
  { key: 'rut', label: 'RUT', width: 13, value: t => t.rut }, { key: 'name', label: 'Docente', width: 28, value: t => t.name }, { key: 'school', label: 'Establecimiento', width: 30, value: t => t.originName },
  { key: 'other', label: 'Colegio extra sugerido', width: 28, value: t => t.otherSchoolName }, { key: 'tipo', label: 'Tipo de contrato', width: 12, value: t => t.tipo },
  { key: 'c0', label: 'Contrato antes (60 min)', width: 12, total: true, value: t => t.contract }, { key: 'c1', label: 'Contrato propuesto (60 min)', width: 13, total: true, value: t => t.contractAfter },
  { key: 'l0', label: 'Lectivas antes (45 min)', width: 12, total: true, value: t => t.lectivasBefore }, { key: 'l1', label: 'Lectivas propuestas (45 min)', width: 13, total: true, value: t => t.lectivasAfter },
  { key: 'u0', label: 'Uso de capacidad antes', width: 11, z: '0%', value: t => t.utilBefore }, { key: 'u1', label: 'Uso de capacidad propuesto', width: 12, z: '0%', value: t => t.utilAfter },
  { key: 'e0', label: 'Estado antes', width: 13, value: t => t.labelBefore }, { key: 'e1', label: 'Estado propuesto', width: 13, value: t => t.label },
  { key: 'ext', label: 'Extensión (h)', width: 10, total: true, value: t => t.extension }, { key: 'sup', label: 'Supresión (h)', width: 10, total: true, value: t => t.supresion },
  { key: 'ren', label: 'Renovación de contrata', width: 12, value: t => t.renueva === null ? '' : t.renueva ? 'Renovar' : 'No renovar' },
  { key: 'sug', label: 'Sugerencia', width: 90, value: t => t.suggestions.join(' ') },
];
export function teachersBook(rep, XLSX) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, tableSheet({ title: 'Docentes · carga actual y propuesta del optimizador', note: 'Uso de capacidad = horas de clase (con su proporción no lectiva) / horas de contrato disponibles.', columns: teacherColumns, rows: rep.teachers }), 'Docentes');
  XLSX.utils.book_append_sheet(wb, notesSheet(['Estados: Eficiente (uso de 90% o más), Aceptable (70% a 90%), Ineficiente (menos de 70%), Sin clases (horas pagadas sin clases), No disponible (licencia, retiro o contrata no renovada), Apoyo PIE.', 'Filtra la columna Estado propuesto para ver a quién conviene revisar.', NOTE]), 'Notas');
  return wb;
}
export function planningBook(rep, R, XLSX) {
  const wb = XLSX.utils.book_new();
  const summaryRows = summaryBody(rep.summary).map(([Concepto, Valor]) => ({ Concepto, Valor }));
  XLSX.utils.book_append_sheet(wb, tableSheet({ title: 'Resumen de la optimización', columns: [{ key: 'k', label: 'Concepto', width: 46, value: r => r.Concepto }, { key: 'v', label: 'Antes → después', width: 26, value: r => String(r.Valor) }], rows: summaryRows, totals: false }), 'Resumen');
  const catCols = [{ key: 'id', label: 'ID', width: 9, value: s => s.id }, { key: 'name', label: 'Establecimiento', width: 32, value: s => s.name }, { key: 'mode', label: 'Modalidad', width: 18, value: s => s.modality }, { key: 'gap', label: 'Brecha antes (45 min)', width: 12, total: true, value: s => s.gapBefore }, { key: 'u0', label: 'Sin docente antes', width: 12, total: true, value: s => s.uncoveredBefore }, { key: 'u1', label: 'Sin docente después', width: 12, total: true, value: s => s.uncoveredAfter },
    ...CATEGORIES.flatMap(([k, label]) => [1, 2].map(t => ({ key: `${k}${t}`, label: `${label} · ${PERIOD[t]}`, width: 14, total: true, value: s => s.per[t]?.[k] ?? 0 }))), { key: 'sug', label: 'Sugerencias', width: 100, value: s => s.suggestions.join(' ') }];
  XLSX.utils.book_append_sheet(wb, tableSheet({ title: 'Horas por categoría y establecimiento', columns: catCols, rows: rep.schools }), 'Establecimientos');
  const rows = Object.entries(R.plan).flatMap(([key, list]) => { const [e, t] = key.split('|'); return list.map(r => ({ e, t, ...r })); }).sort((a, b) => a.e.localeCompare(b.e) || a.t - b.t || a.course.localeCompare(b.course, 'es'));
  const name = id => rep.schools.find(s => s.id === id)?.name ?? id;
  XLSX.utils.book_append_sheet(wb, tableSheet({ title: 'Planificación curso por curso', note: 'Una fila por curso y asignatura. Docente vacío = curso por contratar.', rows, columns: [{ key: 'e', label: 'Establecimiento', width: 30, value: r => name(r.e) }, { key: 't', label: 'Periodo', width: 16, value: r => PERIOD[r.t] }, { key: 'c', label: 'Curso', width: 22, value: r => r.course }, { key: 's', label: 'Asignatura', width: 28, value: r => r.subject }, { key: 'h', label: 'Horas (45 min)', width: 10, total: true, value: r => r.hours }, { key: 'd', label: 'Docente', width: 28, value: r => r.teacher ? r.name : 'Por contratar' }, { key: 'o', label: 'Origen del docente', width: 28, value: r => !r.teacher ? '' : r.origin === r.e ? 'Propio' : name(r.origin) }] }), 'Planificación');
  XLSX.utils.book_append_sheet(wb, tableSheet({ title: 'Docentes', columns: teacherColumns, rows: rep.teachers }), 'Docentes');
  XLSX.utils.book_append_sheet(wb, tableSheet({ title: 'Traslados sugeridos', rows: rep.moves, columns: [{ key: 'n', label: 'Docente', width: 28, value: m => m.name }, { key: 'f', label: 'Desde', width: 30, value: m => m.fromName }, { key: 't', label: 'Hacia', width: 30, value: m => m.toName }, { key: 'h', label: 'Horas en destino (45 min)', width: 12, total: true, value: m => m.destHours }, { key: 'o', label: 'Horas en su colegio', width: 12, total: true, value: m => m.originHours }, { key: 'k', label: 'Tipo', width: 16, value: m => m.kind }, { key: 's', label: 'Asignaturas', width: 40, value: m => m.subjects.join(', ') }] }), 'Traslados');
  XLSX.utils.book_append_sheet(wb, notesSheet(['Resultado del PPL (HiGHS) en cinco fases: cubrir el plan, pagar lo justo, equilibrar el peor colegio, equilibrar a todos y cambiar lo mínimo.', 'Planificación: filtra por establecimiento y periodo para ver qué docente hace cada asignatura en cada curso.', NOTE]), 'Notas');
  return wb;
}

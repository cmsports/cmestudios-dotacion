import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LifeBuoy, LayoutDashboard, School, UsersRound, BookOpen, UploadCloud, History, ChevronDown, ChevronUp, ArrowUpRight, ArrowRight, Search, Bell, Download, Plus, Check, X, CheckCircle2, AlertTriangle, Building2, SlidersHorizontal, FileSpreadsheet, FileText, Pencil, RotateCcw, ShieldCheck, CircleHelp, ArrowLeft, GraduationCap, Sprout, Layers, Clock3, Menu, BriefcaseBusiness, TrendingUp, ChartColumn, UserMinus, UserX, Puzzle, Baby, Wrench, MapPin, Utensils, Scale, UserPlus, FileSignature, Table2, ArrowRightLeft, ArrowLeftRight } from 'lucide-react';
import { MODALITIES, STORAGE_KEY, STATE_VERSION, DEFAULT_SETTINGS, FUNDING, CONTRACTS, RENEWABLE, PROJECTIONS, TP_TRACKS, TEACHER_FUNCTIONS, FULL_TIME, fmt, round, capacityPedagogical, teacherCheck, teacherFunction, assistantCategory, summarizeSchool, summarizeTracks, summarizeRural, summarizePie, vtfLevelsOf, computeIndicators, indicatorRows, createSeed, serializeCSV, parseCSV, validateImport, applyImport, sampleImport, movableTeachers, suggestReassignments, applyReassignments } from './core.mjs';
import { TICKET_SLA_HOURS, TICKET_TYPES, TICKET_STATUS, nextTicketId, seedTickets, ticketSla, ticketStats } from './tickets.mjs';
import { BRAND, hasFuero, indicatorsBook, indicatorsPdf, schoolSheetBook, schoolSheetPdf, listBook } from './exports.mjs';

// El menú sigue el orden de trabajo: cargar datos, revisar, analizar y dejar registro.
const NAV_GROUPS = [
  ['INICIO', [['overview', 'Vista general', LayoutDashboard]]],
  ['1 · DATOS', [['import', 'Importar datos', UploadCloud], ['schools', 'Establecimientos', School], ['people', 'Dotación', UsersRound]]],
  ['2 · ANÁLISIS', [['plans', 'Cuadratura', BookOpen], ['reassign', 'Reasignación', ArrowLeftRight], ['indicators', 'Indicadores PAL', ChartColumn]]],
  ['3 · REGISTRO', [['history', 'Bitácora de cambios', History]]],
  ['4 · SOPORTE', [['support', 'Mesa de ayuda', LifeBuoy]]],
];
const NAV = NAV_GROUPS.flatMap(g => g[1]);
const Titles = {
  overview: ['Tu planificación, en perspectiva.', 'El estado de la dotación 2027 y los pasos para construirla.'],
  import: ['Tus datos, en un solo lugar.', 'Importa el maestro de personal, revisa la validación y confirma.'],
  schools: ['Cada comunidad, su planificación.', 'Elige un establecimiento para abrir su cuadratura.'],
  people: ['Las personas detrás de cada aula.', 'Busca, filtra y abre la ficha de cada persona o cargo vacante.'],
  plans: ['De las horas al equilibrio.', 'Plan de estudios contra horas asignadas, según la modalidad del establecimiento.'],
  reassign: ['De donde sobra, a donde falta.', 'Mueve docentes de establecimientos con excedente a otros con déficit y revisa el efecto antes de aplicar.'],
  indicators: ['Los números del Plan Anual Local.', 'Indicadores de dotación exigidos por la DEP, calculados en tiempo real.'],
  support: ['Una mesa de ayuda, con respuesta en 24 horas.', 'Levanta un requerimiento, sigue su estado y revisa si se respondió dentro del plazo.'],
  history: ['Cada decisión deja una huella.', 'Todos los cambios del escenario, con su motivo.'],
};
const SITUATIONS = ['Todas las situaciones', 'Cargos vacantes', 'Disminución', 'No renovación', 'Aumento', 'Con fuero gremial', 'Con sobrecarga'];
const Status = ({ value }) => <span className={`badge ${value === 'Equilibrado' ? 'green' : value === 'Excedente' ? 'blue' : value === 'Por validar' ? 'neutral' : 'amber'}`}><span className="status-dot" />{value}</span>;
const ModeIcon = ({ mode, size = 18 }) => { const Icon = mode === 'Jardín VTF' ? Sprout : mode === 'Microcentro' ? Layers : mode === 'Técnico profesional' ? BriefcaseBusiness : GraduationCap; return <Icon size={size} />; };
function getInitial() { try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (saved?.version === STATE_VERSION && Array.isArray(saved.schools) && Array.isArray(saved.staff) && Array.isArray(saved.plans) && Array.isArray(saved.events)) return { ...saved, tickets: saved.tickets ?? seedTickets(), settings: { ...DEFAULT_SETTINGS, ...saved.settings } }; } catch {} return createSeed(); }
const personRole = p => p.type === 'Docente' ? teacherFunction(p.role) : assistantCategory(p.role);
async function pdfKit() { const { jsPDF } = await import('jspdf'); const { autoTable } = await import('jspdf-autotable'); return { jsPDF, autoTable }; }
function modalityCopy(school) {
  const ratio = `${fmt(school.lectiveRatio * 100)}/${fmt((1 - school.lectiveRatio) * 100)}`;
  return {
    'Escuela regular': `Escuela de enseñanza básica: plan común, proporción lectiva ${ratio}${school.jec ? ' y jornada escolar completa' : ''}. El apoyo PIE se cuadra aparte.`,
    Liceo: `Liceo científico-humanista: formación general y electivos de 3° y 4° medio, proporción ${ratio}. El apoyo PIE se cuadra aparte.`,
    'Técnico profesional': 'Liceo técnico-profesional: la formación general y la diferenciada por especialidad se cuadran por separado.',
    'Escuela especial': 'Escuela especial: plan de aprendizaje integral y talleres de autonomía. Coeficientes por diagnóstico pendientes de validar.',
    'Jardín VTF': 'Jardín VTF: se compara personal requerido y disponible por nivel, según coeficientes de atención. No hay cuadratura de horas curriculares.',
    Microcentro: `Microcentro de ${school.ruralMembers.length} escuelas rurales multigrado: el plan se reparte según los cursos combinados de cada escuela.`,
  }[school.modality];
}
// Cambio de establecimiento: conserva horas y contrato; la formación TP o la escuela rural se reasignan en el destino.
const moveTo = (p, dest) => ({ ...p, schoolId: dest.id, extraSchool: undefined, extraPed: 0, track: p.type === 'Docente' && dest.modality === 'Técnico profesional' ? 'Formación general' : undefined, ruralSchool: dest.modality === 'Microcentro' ? dest.ruralMembers[0]?.name : undefined });
function saveDownload(name, content, type = 'text/csv;charset=utf-8') { const a = document.createElement('a'); const url = URL.createObjectURL(new Blob([content], {type})); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function Dialog({ title, subtitle, children, close, wide = false }) {
  const ref = useRef(); const previous = useRef(document.activeElement); const pressedOutside = useRef(false);
  useEffect(() => { const el = ref.current; el.showModal(); return () => { if (el.open) el.close(); previous.current?.focus?.(); }; }, []);
  // Solo cierra con un clic que empieza y termina en el fondo oscuro: arrastrar una selección o usar la barra
  // de scroll del formulario no debe cerrar la ventana ni perder lo escrito.
  const outside = e => { const r = ref.current.getBoundingClientRect(); return e.target === ref.current && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom); };
  return <dialog ref={ref} className={`dialog ${wide ? 'wide' : ''}`} onCancel={e => {e.preventDefault();close();}} onMouseDown={e => { pressedOutside.current = outside(e); }} onClick={e => { if (pressedOutside.current && outside(e)) close(); pressedOutside.current = false; }}><header><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-btn" aria-label="Cerrar" onClick={close}><X size={20}/></button></header>{children}</dialog>;
}

export default function App() {
  const [state, setState] = useState(getInitial);
  const [page, setPage] = useState('overview');
  const [scope, setScope] = useState('all');
  const [selectedSchool, setSelectedSchool] = useState('EST-001');
  const [query, setQuery] = useState('');
  const [modality, setModality] = useState('Todas las modalidades');
  const [personType, setPersonType] = useState('Todo el personal');
  const [situation, setSituation] = useState(SITUATIONS[0]);
  const [schoolFilter, setSchoolFilter] = useState('');
  const [personPage, setPersonPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState('');
  const [storageError, setStorageError] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); setStorageError(false); } catch { setStorageError(true); } }, [state]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { setPersonPage(1); }, [query, modality, personType, situation, schoolFilter, scope, selectedSchool]);
  useEffect(() => { window.scrollTo(0, 0); }, [page, selectedSchool]);
  const stats = useMemo(() => state.schools.map(s => summarizeSchool(s, state.staff, state.plans)), [state]);
  const scoped = scope === 'all' ? stats : stats.filter(s => s.id === selectedSchool);
  const visibleSchools = scoped.filter(s => (modality === 'Todas las modalidades' || s.modality === modality) && `${s.name} ${s.commune} ${s.id}`.toLowerCase().includes(query.toLowerCase()));
  const ids = new Set(scoped.map(s => s.id));
  const people = state.staff.filter(p => ids.has(p.schoolId));
  const persons = people.filter(p => !p.vacant);
  const settings = state.settings;
  const schoolById = useMemo(() => new Map(state.schools.map(s => [s.id, s])), [state.schools]);
  const school = schoolById.get(selectedSchool) || state.schools[0];
  const summary = stats.find(s => s.id === school.id);
  const teachers = persons.filter(p => p.type === 'Docente');
  const assistants = persons.filter(p => p.type === 'Asistente');
  const deficits = scoped.filter(s => s.status === 'Déficit');
  const overloads = scoped.reduce((s, x) => s + x.overloads, 0);
  const hours = teachers.reduce((s, p) => s + p.contractHours, 0);
  const events = [...state.events].reverse();
  const indicators = useMemo(() => page === 'indicators' ? computeIndicators(state.schools.filter(s => ids.has(s.id)), state.staff, state.plans, settings) : null, [page, state, scope, selectedSchool]);
  const attention = [...scoped].filter(s => s.modality !== 'Jardín VTF').sort((a, b) => a.gap - b.gap);
  const modalityCounts = [0,0,0,0];
  for (const p of persons) {
    const m = schoolById.get(p.schoolId)?.modality;
    modalityCounts[m==='Escuela regular'?0:['Liceo','Técnico profesional'].includes(m)?1:m==='Jardín VTF'?2:3]++;
  }
  let angle = 0;
  const donutGradient = `conic-gradient(${modalityCounts.map((n,i)=>{const from=angle;angle += persons.length?n/persons.length*100:0;return `${['#4b91e1','#8bb7e9','#c6d9ee','#b3cce9'][i]} ${from}% ${angle}%`;}).join(', ')})`;

  const changePage = next => { setSelected(new Set()); setPage(next); setQuery(''); setModality('Todas las modalidades'); setPersonType('Todo el personal'); setSituation(SITUATIONS[0]); setSchoolFilter(''); setMobileNav(false); };
  const goPeople = ({ type, situation: s, mode, schoolId } = {}) => { changePage('people'); if (type) setPersonType(type); if (s) setSituation(s); if (mode) setModality(mode); if (schoolId) setSchoolFilter(schoolId); };
  const goPlan = id => { setSelectedSchool(id); changePage('plans'); };
  const commit = (next, action, detail) => {
    const event = { id: crypto.randomUUID(), date: new Date().toISOString(), author: 'Administrador · Demo', action, detail };
    setState(prev => ({ ...(typeof next === 'function' ? next(prev) : next), events: [...prev.events, event] }));
  };
  const matchesSituation = p => situation === 'Todas las situaciones' ? true : situation === 'Cargos vacantes' ? p.vacant : situation === 'Con fuero gremial' ? hasFuero(p) : situation === 'Con sobrecarga' ? p.type === 'Docente' && teacherCheck(p, schoolById.get(p.schoolId)).excess > 0.01 : p.projection === situation;
  const pageRowsOf = list => list.slice((personPage - 1) * 20, personPage * 20);
  const filteredPeople = people.filter(p => (personType === 'Todo el personal' || p.type === personType) && matchesSituation(p) && (!schoolFilter || p.schoolId === schoolFilter) && (modality === 'Todas las modalidades' || schoolById.get(p.schoolId)?.modality === modality) && `${p.name} ${p.id} ${p.rut ?? ''} ${p.role} ${schoolById.get(p.schoolId)?.name}`.toLowerCase().includes(query.toLowerCase()));

  const pageRows = pageRowsOf(filteredPeople);
  const runExport = async (task, done) => { setBusy(true); try { await task(); setNotice(done); } catch (e) { console.error(e); setNotice('No se pudo exportar. Intenta nuevamente.'); } finally { setBusy(false); } };
  // Listas (establecimientos, dotación, plan, bitácora): Excel con fórmulas y filtros; CSV plano; PDF para imprimir.
  const listData = kind => ({ kind, state, schools: visibleSchools, people: filteredPeople, school, summary, events, settings });
  const exportList = (kind, format, name) => runExport(async () => {
    const { rows } = listBook(null, listData(kind));
    if (!rows.length) throw new Error('vacío');
    if (format === 'csv') return saveDownload(`${name}.csv`, serializeCSV(rows));
    if (format === 'xlsx') { const XLSX = await import('xlsx'); XLSX.writeFile(listBook(XLSX, listData(kind)).wb, `${name}.xlsx`, { compression: true }); return; }
    const { jsPDF, autoTable } = await pdfKit(); const pdf = new jsPDF({ orientation: 'landscape', compress: true });
    pdf.setFontSize(16); pdf.text(`CMEstudios | ${name.replaceAll('-', ' ')}`, 14, 18); pdf.setFontSize(9); pdf.text('DEMOSTRACION - Datos ficticios. Formato propio; pendiente adaptar a layouts MINEDUC/DEP.', 14, 25);
    autoTable(pdf, { head: [Object.keys(rows[0])], body: rows.map(r => Object.values(r)), startY: 31, styles: { fontSize: 7 }, headStyles: { fillColor: BRAND }, didDrawPage: () => { pdf.setFontSize(8); pdf.text('Escenario demo | ' + new Date().toLocaleDateString('es-CL'), 14, pdf.internal.pageSize.height - 8); } });
    pdf.save(`${name}.pdf`);
  }, `${format === 'xlsx' ? 'Excel' : format.toUpperCase()} descargado.`);
  const listMenu = (kind, name, what) => [
    { icon: FileSpreadsheet, label: 'Excel con fórmulas', hint: `${what}, totales que respetan filtros y hoja de notas`, run: () => exportList(kind, 'xlsx', name) },
    { icon: FileText, label: 'PDF para imprimir', hint: `${what} en formato horizontal`, run: () => exportList(kind, 'pdf', name) },
    { icon: Table2, label: 'CSV', hint: 'Datos planos para otros sistemas', run: () => exportList(kind, 'csv', name) },
  ];
  const exportIndividual = person => runExport(async () => {
    const { jsPDF, autoTable } = await pdfKit(); const pdf = new jsPDF({ compress: true }); const s = schoolById.get(person.schoolId); const check = teacherCheck(person, s);
    pdf.setFontSize(19); pdf.text('Ficha individual de carga horaria', 14, 20); pdf.setFontSize(10); pdf.text('CMEstudios | DEMO 2027 - persona ficticia', 14, 29); pdf.text('Formato de demostracion, pendiente adaptar al formato MINEDUC.', 14, 36);
    autoTable(pdf, { startY: 45, body: [['Persona', person.name], ['RUT (ficticio)', person.rut || 'Sin RUT (cargo vacante)'], ['ID demo', person.id], ['Establecimiento', s.name], ['Cargo', person.role], ['Función o categoría', personRole(person)], ['Estatuto', person.statute || 'Sin dato'], ['Tramo de desarrollo profesional', person.tramo || 'No aplica'], ['Contrato', person.contract], ['Fecha de ingreso', person.startDate || 'Sin dato'], ['Fecha de término', person.endDate || 'Indefinida'], ['Horas básica / media', person.hoursBasic === undefined ? 'No aplica' : `${person.hoursBasic} / ${person.hoursMedia}`], ['Financiamiento', person.funding], ['Horas contrato (60 min)', person.contractHours], ['Proporción configurada', fmt(s.lectiveRatio * 100) + '% / ' + fmt((1 - s.lectiveRatio) * 100) + '%'], ['Máximo lectivo configurado (60 min)', person.type === 'Docente' ? check.lectiveClock : 'No aplica'], ['Reserva no lectiva configurada (60 min)', person.type === 'Docente' ? check.nonLectiveClock : 'No aplica'], ['Lectivas asignadas (45 min)', person.assignedPed], ['Proyección', person.projection], ['Justificación', person.justification || 'Sin cambios registrados']], styles: { fontSize: 10 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 85 } }, theme: 'striped' });
    pdf.text('Firma de la persona: __________________________', 14, Math.min(270, pdf.lastAutoTable.finalY + 22)); pdf.save(`carga-horaria-${person.id}.pdf`);
  }, 'Carga horaria PDF descargada.');
  const indicatorLabel = scope === 'all' ? 'SLEP Llanquihue · 52 establecimientos y 4 microcentros' : summary.name;
  const indicatorMenu = [
    { icon: FileSpreadsheet, label: 'Excel con fórmulas', hint: 'Resumen PAL calculado desde la hoja de personal; si cambias una jornada, se recalcula', run: () => runExport(async () => { const XLSX = await import('xlsx'); XLSX.writeFile(indicatorsBook(indicators, XLSX, { state, label: indicatorLabel, ids }), 'indicadores-pal-2027.xlsx', { compression: true }); }, 'Excel de indicadores descargado.') },
    { icon: FileText, label: 'PDF del informe', hint: 'Indicadores y horas por establecimiento, listo para imprimir', run: () => runExport(async () => indicatorsPdf(indicators, indicatorLabel, await pdfKit()).save('indicadores-pal-2027.pdf'), 'PDF de indicadores descargado.') },
    { icon: Table2, label: 'CSV', hint: 'Lista de indicadores en datos planos', run: () => runExport(async () => saveDownload('indicadores-pal-2027.csv', serializeCSV(indicatorRows(indicators))), 'CSV de indicadores descargado.') },
  ];
  const sheetMenu = [
    { icon: FileSignature, label: 'Ficha para firma (PDF)', hint: 'Resumen, módulos, plan, dotación y espacio para firma del director', run: () => runExport(async () => schoolSheetPdf(state, school.id, await pdfKit()).save(`ficha-dotacion-${school.id}.pdf`), 'Ficha PDF descargada.') },
    { icon: FileSpreadsheet, label: 'Ficha de trabajo (Excel)', hint: 'Cuadratura con fórmulas: cambia cursos u horas y se recalcula la brecha', run: () => runExport(async () => { const XLSX = await import('xlsx'); XLSX.writeFile(schoolSheetBook(state, school.id, XLSX), `ficha-dotacion-${school.id}.xlsx`, { compression: true }); }, 'Ficha Excel descargada.') },
    { icon: Table2, label: 'Plan de estudios (CSV)', hint: 'Solo las asignaturas, en datos planos', run: () => exportList('plan', 'csv', `plan-estudios-${school.id}`) },
  ];
  const newVacancy = () => { const ratio = school.lectiveRatio; const needed = Math.max(0, -summary.gap); const contractHours = Math.min(FULL_TIME, Math.max(1, Math.ceil(needed / (ratio * 60 / 45)))); setModal({ type: 'person', isNew: true, person: { id: `VAC-${String(Math.max(0, ...state.staff.filter(p => p.vacant).map(p => parseInt(p.id.slice(4), 10) || 0)) + 1).padStart(3, '0')}`, name: 'Cargo vacante por proveer', schoolId: school.id, type: 'Docente', role: 'Docente de aula', contractHours, assignedPed: round(Math.min(needed, capacityPedagogical(contractHours, ratio))), funding: 'General', contract: 'Contrata', protection: '', projection: 'Aumento', changeHours: contractHours, justification: '', vacant: true, ...(school.modality === 'Técnico profesional' ? { track: 'Formación general' } : {}), ...(school.modality === 'Microcentro' ? { ruralSchool: school.ruralMembers[0]?.name } : {}) } }); };
  const editSchool = section => setModal({ type: 'school', section });
  const bulkMove = (to, reason) => {
    const dest = state.schools.find(x => x.id === to); const list = state.staff.filter(p => selected.has(p.id));
    commit(prev => ({ ...prev, staff: prev.staff.map(p => selected.has(p.id) ? { ...moveTo(p, dest), justification: `Traslado a ${dest.name}. ${reason}` } : p) }), 'Traslado de personas', `${list.length} persona${list.length > 1 ? 's' : ''} a ${dest.name}: ${list.map(p => p.name).join(', ')}. Motivo: ${reason}`);
    setSelected(new Set()); setModal(null); setNotice(`${list.length} persona${list.length > 1 ? 's' : ''} movida${list.length > 1 ? 's' : ''} a ${dest.name}.`);
  };
  const saveSchool = (s, section, applyVtf, reason) => {
    const vtfCount = state.schools.filter(x => x.modality === 'Jardín VTF').length;
    const detail = { general: `${s.modality === 'Jardín VTF' ? '' : `proporción ${s.lectiveRatio * 100}/${100 - s.lectiveRatio * 100}, ${s.jec ? 'con' : 'sin'} JEC, `}proyección ${s.projection}`, pie: `PIE ${s.pie?.courses} cursos, ${s.pie?.neet} NEE transitorias y ${s.pie?.neep} permanentes`, rural: s.ruralMembers.map(m => `${m.name}: ${m.enrollment} estudiantes, ${m.groups} cursos`).join('; '), vtf: vtfLevelsOf(s).map(l => `${l.level} ${l.enrollment} niños (1 educadora/${l.educatorPerChildren ?? '?'}, 1 técnica/${l.technicianPerChildren ?? '?'})`).join('; ') + (applyVtf ? `. Coeficientes aplicados a los ${vtfCount} jardines VTF` : '') }[section];
    const action = { general: 'Parámetros y proyección actualizados', pie: 'Datos PIE actualizados', rural: 'Escuelas rurales actualizadas', vtf: 'Coeficientes VTF actualizados' }[section];
    commit(prev => ({ ...prev,
      schools: prev.schools.map(x => x.id === s.id ? s : applyVtf && x.modality === 'Jardín VTF' ? { ...x, vtfLevels: vtfLevelsOf(x).map(l => { const ref = s.vtfLevels.find(r => r.level === l.level); return ref ? { ...l, educatorPerChildren: ref.educatorPerChildren, technicianPerChildren: ref.technicianPerChildren } : l; }) } : x),
      plans: s.modality === 'Microcentro' ? prev.plans.map(p => p.schoolId === s.id ? { ...p, groups: s.ruralMembers.reduce((n, m) => n + m.groups, 0) } : p) : prev.plans,
    }), action, `${s.name}: ${detail}. Motivo: ${reason}`);
    setModal(null); setNotice(applyVtf ? `Coeficientes aplicados a los ${vtfCount} jardines VTF.` : 'Cambios guardados. La cuadratura se recalculó.');
  };
  const savePerson = (p, isNew) => {
    commit(prev => ({ ...prev, staff: isNew ? [...prev.staff, p] : prev.staff.map(x => x.id === p.id ? p : x) }), isNew ? 'Cargo vacante creado' : 'Ajuste de dotación', `${p.name} (${p.id}): ${p.contractHours} h contrato, ${p.assignedPed} h lectivas; ${p.projection}${p.changeHours && p.projection !== 'Mantención' ? ` (${p.changeHours} h)` : ''}. Motivo: ${p.justification}`);
    setModal(null); setNotice(isNew ? 'Cargo vacante creado. La cuadratura y los indicadores se recalcularon.' : 'Dotación actualizada. La cuadratura se recalculó.');
  };
  const isTp = school.modality === 'Técnico profesional'; const isMicro = school.modality === 'Microcentro'; const isVtf = school.modality === 'Jardín VTF';

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav?'open':''}`}>
      <a className="brand" href="#" onClick={e=>{e.preventDefault();changePage('overview');}}><span className="brand-mark"><span/></span><div>CM<span>Estudios</span><small>GESTIÓN EDUCATIVA</small></div></a>
      <div className="workspace"><span className="workspace-icon"><Building2 size={18}/></span><div>SLEP Llanquihue<small>Escenario de demostración</small></div></div>
      {NAV_GROUPS.map(([label, items]) => <div className="nav-group" key={label}><p className="nav-label">{label}</p><nav>{items.map(([id,text,Icon])=><button key={id} aria-label={text} className={page===id?'active':''} onClick={()=>changePage(id)}><Icon size={19}/><span>{text}</span></button>)}</nav></div>)}
      <div className="sidebar-guide"><div className="guide-icon"><GraduationCap size={23}/></div><h3>¿Primera vez?</h3><p>Un recorrido de 4 minutos por lo que evalúa la comisión.</p><button onClick={()=>setModal({type:'guide'})}>Ver recorrido <ArrowUpRight size={15}/></button></div>
      <button className="sidebar-help" onClick={()=>setModal({type:'rules'})}><CircleHelp size={17}/> Alcance y reglas de cálculo</button>
      <div className="sidebar-user"><span className="avatar">CM</span><div>Equipo CMEstudios<small>Administrador · Demo local</small></div></div>
    </aside>
    <main>
      <header className="topbar"><div className="breadcrumb"><button className="icon-btn mobile-only" aria-label="Abrir menú" onClick={()=>setMobileNav(!mobileNav)}><Menu size={20}/></button><span>Dotación 2027</span><span>/</span><strong>{NAV.find(n=>n[0]===page)[1]}</strong></div><div className="topbar-right"><span className="local-dot">Demo local · datos ficticios</span><button className="alerts-btn" onClick={()=>setModal({type:'alerts'})}><Bell size={17}/>Alertas<span className="alerts-count">{deficits.length+overloads}</span></button></div></header>
      <div className="content">
        {storageError&&<div className="warning-banner"><AlertTriangle size={17}/>El navegador no pudo guardar los cambios. Exporta los datos antes de cerrar.</div>}
        <div className="page-heading"><div><div className="eyebrow">DOTACIÓN ESCOLAR / 2027</div><h1>{Titles[page][0]}</h1><p>{Titles[page][1]}</p></div><label className="view-select"><span>Ver como</span><select aria-label="Vista de demostración" value={scope} onChange={e=>{setScope(e.target.value);setQuery('');}}><option value="all">Sostenedor (todo el SLEP)</option><option value="school">Un establecimiento</option></select></label></div>
        {scope==='school'&&<div className="scope-banner"><School size={18}/><span>Viendo solo</span><select aria-label="Establecimiento de la vista demo" value={selectedSchool} onChange={e=>setSelectedSchool(e.target.value)}>{state.schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><small>Simulación del perfil de establecimiento; sin autenticación de producción.</small></div>}

        {page==='overview'&&<>
          <section className="kpis">
            <Kpi icon={School} title={scope==='all'?'Establecimientos':'Unidad en vista'} value={scope==='all'?'52 + 4':scoped.length} footer={scope==='all'?'52 establecimientos y 4 microcentros':'Alcance de la vista seleccionada'} color="teal" cta="Ver establecimientos" onClick={()=>changePage('schools')}/>
            <Kpi icon={UsersRound} title="Dotación docente" value={fmt(teachers.length)} footer={`${fmt(hours)} horas cronológicas · ${people.filter(p=>p.vacant).length} cargos vacantes`} color="blue" cta="Ver docentes" onClick={()=>goPeople({type:'Docente'})}/>
            <Kpi icon={BriefcaseBusiness} title="Asistentes de la educación" value={fmt(assistants.length)} footer={`${fmt(assistants.reduce((a,p)=>a+p.contractHours,0))} horas cronológicas contratadas`} color="purple" cta="Ver asistentes" onClick={()=>goPeople({type:'Asistente'})}/>
            <Kpi icon={AlertTriangle} title="Establecimientos con déficit" value={fmt(deficits.length)} footer={`${overloads} sobrecargas individuales · ${scoped.filter(s=>s.status==='Por validar').length} VTF por validar`} color="orange" cta="Ver alertas" onClick={()=>setModal({type:'alerts'})}/>
          </section>
          <Workflow go={changePage}/>
          <div className="dashboard-grid">
            <section className="panel modality-panel"><div className="panel-heading"><div><h2>Personas por modalidad</h2><p>Dotación vigente en el escenario de planificación</p></div></div><div className="modality-chart"><div className="donut" style={{background:donutGradient}}><div><small>Dotación total</small><strong>{fmt(persons.length)}</strong><span>personas</span></div></div><div className="legend">{['Escuela regular','Liceo y TP','Jardín VTF','Especial y rural'].map((m,i)=><div key={m}><span className={`legend-dot tone-${i}`}/><span>{m}</span><strong>{fmt(modalityCounts[i])}</strong></div>)}</div></div><div className="panel-footer"><span><ShieldCheck size={15}/>Datos ficticios</span><button onClick={()=>changePage('people')}>Ver la dotación completa <ArrowRight size={15}/></button></div></section>
            <section className="panel gap-panel"><div className="panel-heading"><div><h2>Mayor déficit de horas</h2><p>Los cinco establecimientos con menos horas asignadas que las del plan</p></div></div><div className="gap-chart">{attention.slice(0,5).map(s=><button className="gap-row" key={s.id} onClick={()=>goPlan(s.id)} title={`Abrir la cuadratura de ${s.name}`}><span>{s.name.replace('Escuela ','')}</span><div className="gap-track"><i className={s.gap>=0?'positive':'negative'} style={{width:`${Math.max(4,Math.min(100,Math.abs(s.gap)/250*100))}%`}}/></div><strong className={s.gap>=0?'text-teal':'text-amber'}>{s.gap>0?'+':''}{fmt(s.gap)}<small> h</small></strong></button>)}</div><div className="panel-footer"><span>Horas pedagógicas de 45 min · haz clic en una barra</span><button onClick={()=>changePage('schools')}>Ver todos los establecimientos <ArrowRight size={15}/></button></div></section>
          </div>
        </>}

        {page==='indicators'&&indicators&&<IndicatorsPage ind={indicators} settings={settings} busy={busy} menu={indicatorMenu} editSettings={()=>setModal({type:'settings'})} openSchool={goPlan} goPeople={goPeople} scopeAll={scope==='all'}/>}

        {page==='schools'&&<>
          <section className="small-stats"><span><strong>{scoped.length}</strong> unidades de gestión</span><span><strong>{scoped.filter(s=>s.modality==='Jardín VTF').length}</strong> jardines VTF</span><span><strong>{scoped.filter(s=>s.modality==='Microcentro').reduce((a,s)=>a+s.ruralMembers.length,0)}</strong> escuelas rurales en microcentros</span></section>
          <SideBySide schools={scoped} open={goPlan}/>
          <div className="filter-bar"><SearchBox value={query} change={setQuery} placeholder="Buscar establecimiento o comuna"/><Filter label="Modalidad"><ModeSelect value={modality} change={setModality}/></Filter></div>
          <section className="panel"><div className="panel-heading"><div><h2>Establecimientos y microcentros</h2><p>{visibleSchools.length} unidades · haz clic en una fila para abrir su cuadratura</p></div><ExportMenu busy={busy} items={listMenu('schools','establecimientos-2027','Listado con brechas')}/></div><SchoolTable rows={visibleSchools} open={goPlan}/></section>
        </>}

        {page==='people'&&<>
          <div className="filter-bar"><SearchBox value={query} change={setQuery} placeholder="Buscar por nombre, RUT, cargo o establecimiento"/><Filter label="Tipo"><select aria-label="Tipo de personal" value={personType} onChange={e=>setPersonType(e.target.value)}><option>Todo el personal</option><option>Docente</option><option>Asistente</option></select></Filter><Filter label="Situación"><select aria-label="Situación" value={situation} onChange={e=>setSituation(e.target.value)}>{SITUATIONS.map(s=><option key={s}>{s}</option>)}</select></Filter><Filter label="Modalidad"><ModeSelect value={modality} change={setModality}/></Filter></div>
          {selected.size>0&&<div className="selection-bar sticky"><span><strong>{selected.size}</strong> persona{selected.size>1?'s':''} seleccionada{selected.size>1?'s':''}</span><button className="link-btn" onClick={()=>setSelected(new Set())}>Quitar selección</button><button className="primary-btn" onClick={()=>setModal({type:'bulkMove'})}><ArrowRightLeft size={16}/>Mover a otro establecimiento</button></div>}
          {schoolFilter&&<div className="chip-row"><span className="chip">Establecimiento: {schoolById.get(schoolFilter)?.name}<button aria-label="Quitar filtro de establecimiento" onClick={()=>setSchoolFilter('')}><X size={13}/></button></span></div>}
          <section className="panel"><div className="panel-heading"><div><h2>Maestro de personal</h2><p>{fmt(filteredPeople.length)} registros · haz clic en una fila para ver su ficha; marca varias para moverlas juntas</p></div><ExportMenu busy={busy} items={listMenu('people','dotacion-2027','Personas filtradas, con capacidad y holgura')}/></div><div className="table-scroll"><table><thead><tr><th className="check-cell"><input type="checkbox" aria-label="Seleccionar las personas de esta página" checked={pageRows.length>0&&pageRows.every(p=>selected.has(p.id))} onChange={e=>setSelected(prev=>{const next=new Set(prev);for(const p of pageRows)e.target.checked?next.add(p.id):next.delete(p.id);return next;})}/></th><th>PERSONA / ID DEMO</th><th>ESTABLECIMIENTO</th><th>CARGO</th><th>CONTRATO</th><th>LECTIVAS</th><th>FINANCIA.</th><th>PROYECCIÓN</th></tr></thead><tbody>{pageRows.map(p=>{const s=schoolById.get(p.schoolId);const check=teacherCheck(p,s);return <tr key={p.id} className={`clickable ${selected.has(p.id)?'selected':''}`} tabIndex={0} onClick={()=>setModal({type:'person',person:p})} onKeyDown={e=>{if(e.key==='Enter')setModal({type:'person',person:p});}}><td className="check-cell" onClick={e=>e.stopPropagation()}><input type="checkbox" aria-label={`Seleccionar a ${p.name}`} checked={selected.has(p.id)} onChange={()=>setSelected(prev=>{const next=new Set(prev);next.has(p.id)?next.delete(p.id):next.add(p.id);return next;})}/></td><td><div className="person-cell"><span className="mini-avatar">{p.vacant?'VC':p.name.split(' ').slice(0,2).map(n=>n[0]).join('')}</span><div><strong>{p.name}{p.vacant&&<span className="badge amber inline-badge">Vacante</span>}</strong><small>{p.rut||p.id}{hasFuero(p)&&' · Fuero gremial'}</small></div></div></td><td><span className="truncate" title={s.name}>{s.name}</span><small>{s.modality}</small></td><td>{p.role}<small>{p.type} · {personRole(p)}{p.track?` · ${p.track==='Formación general'?'F. general':'F. diferenciada'}`:''}{p.ruralSchool?` · ${p.ruralSchool.replace('Escuela rural ficticia','Rural')}`:''}</small></td><td><strong>{p.contractHours} h</strong><small>{p.contract}</small></td><td className={p.type==='Docente'&&check.excess>0?'text-amber':''}>{p.type==='Docente'?`${fmt(p.assignedPed)} h`:'—'}{p.extraPed>0&&<small>+{fmt(p.extraPed)} h en {schoolById.get(p.extraSchool)?.name}</small>}{p.type==='Docente'&&check.excess>0&&<small>Sobrecarga +{fmt(check.excess)}</small>}</td><td><span className="funding">{p.funding}</span></td><td><span className="projection">{p.projection}</span>{p.projection==='No renovación'?<small>{p.contractHours} h</small>:p.changeHours>0&&<small>{p.projection==='Disminución'?'−':'+'}{fmt(p.changeHours)} h</small>}</td></tr>;})}</tbody></table>{!filteredPeople.length&&<Empty/>}</div><div className="pagination"><span>Mostrando {filteredPeople.length?((personPage-1)*20+1):0}–{Math.min(personPage*20,filteredPeople.length)} de {fmt(filteredPeople.length)}</span><div><button disabled={personPage===1} onClick={()=>setPersonPage(p=>p-1)}><ArrowLeft size={15}/>Anterior</button><span>{personPage} / {Math.max(1,Math.ceil(filteredPeople.length/20))}</span><button disabled={personPage*20>=filteredPeople.length} onClick={()=>setPersonPage(p=>p+1)}>Siguiente<ArrowRight size={15}/></button></div></div></section>
        </>}

        {page==='plans'&&<>
          <div className="selector-bar"><label><span>Establecimiento</span><select aria-label="Establecimiento para cuadratura" value={selectedSchool} onChange={e=>setSelectedSchool(e.target.value)}>{(scope==='all'?state.schools:state.schools.filter(s=>s.id===selectedSchool)).map(s=><option key={s.id} value={s.id}>{s.name} · {s.modality}</option>)}</select></label><small>Todo lo de esta página corresponde al establecimiento elegido.</small></div>
          <section className="panel institution-card">
            <div className="institution-main"><span className="school-icon large"><ModeIcon mode={school.modality} size={26}/></span><div><div className="institution-title"><h2>{school.name}</h2><Status value={summary.status}/></div><p>{school.id} · {school.commune} · {school.modality}{!isVtf&&` · ${school.jec?'Con JEC':'Sin JEC'}`}</p><p className="institution-desc">{modalityCopy(school)}</p><button className="link-btn" onClick={()=>goPeople({schoolId:school.id})}>Ver su personal: {summary.teachers} docentes y {summary.assistants} asistentes <ArrowRight size={14}/></button></div></div>
            <ExportMenu busy={busy} items={sheetMenu} label="Exportar ficha"/>
          </section>
          {isVtf?<VtfPanel school={school} summary={summary} edit={()=>editSchool('vtf')}/>:<>
            <section className="kpis plan-kpis"><Kpi icon={BookOpen} title="Horas requeridas" value={fmt(summary.required)} footer="Suma del plan de estudios · horas de 45 min" color="teal"/><Kpi icon={UsersRound} title="Horas asignadas" value={fmt(summary.assigned)} footer={`${summary.teachers} docentes${summary.vacancies?` + ${summary.vacancies} cargo${summary.vacancies>1?'s':''} vacante${summary.vacancies>1?'s':''} (${fmt(summary.vacantPed)} h)`:''}`} color="blue"/><Kpi icon={TrendingUp} title={summary.gap<0?'Déficit de asignación':'Excedente de asignación'} value={fmt(Math.abs(summary.gap))} footer="Asignadas − requeridas · horas de 45 min" color={summary.gap<0?'orange':'teal'}/><Kpi icon={Clock3} title="Capacidad lectiva máxima" value={fmt(summary.capacity)} footer={`Contrato × ${fmt(school.lectiveRatio*100)}% × 60/45`} color="purple"/></section>
            {summary.gap<-0.01&&<div className="warning-banner action-banner"><AlertTriangle size={18}/><div><strong>Faltan {fmt(-summary.gap)} h pedagógicas para cubrir el plan.</strong><span>Crea un cargo vacante por proveer: se suma a la cuadratura, a los indicadores y a la bitácora.</span></div><button className="secondary-btn" onClick={newVacancy}><UserPlus size={16}/>Crear cargo vacante</button></div>}
            {isTp&&<TpPanel data={summarizeTracks(school,state.staff,state.plans)}/>}
            {isMicro&&<RuralPanel data={summarizeRural(school,state.staff,state.plans)} edit={()=>editSchool('rural')}/>}
            <section className="panel module-panel"><div className="panel-heading"><div><h2>{isMicro?'Plan agrupado del microcentro':'Plan de estudios'}</h2><p>Escenario ficticio editable · haz clic en una asignatura para modificarla</p></div><button className="primary-btn" onClick={()=>setModal({type:'plan',plan:{id:crypto.randomUUID(),schoolId:school.id,subject:'',groups:isMicro?school.ruralMembers.reduce((n,m)=>n+m.groups,0):1,hoursPerGroup:1,...(isTp?{track:'Formación general'}:{})},isNew:true})}><Plus size={16}/>Agregar asignatura</button></div><div className="table-scroll"><table><thead><tr><th>ASIGNATURA / COMPONENTE</th>{isTp&&<th>FORMACIÓN</th>}<th>CURSOS O GRUPOS</th><th>HORAS POR CURSO</th><th>TOTAL REQUERIDO</th></tr></thead><tbody>{state.plans.filter(p=>p.schoolId===school.id).map(p=><tr key={p.id} className="clickable" tabIndex={0} onClick={()=>setModal({type:'plan',plan:p})} onKeyDown={e=>{if(e.key==='Enter')setModal({type:'plan',plan:p});}}><td><strong>{p.subject}</strong>{p.specialty&&<small>Especialidad {p.specialty}</small>}</td>{isTp&&<td>{p.track||'Formación general'}</td>}<td>{p.groups}{isMicro&&<small>Cursos combinados de las escuelas</small>}</td><td>{p.hoursPerGroup} h pedagógicas</td><td><strong>{fmt(p.groups*p.hoursPerGroup)} h</strong></td></tr>)}</tbody><tfoot><tr><td colSpan={isTp?4:3}>Total de horas pedagógicas requeridas</td><td>{fmt(summary.required)} h</td></tr></tfoot></table></div><div className="panel-footer"><span>Requeridas = cursos × horas por curso. Capacidad = horas de contrato × proporción lectiva × 60/45.</span><button onClick={()=>setModal({type:'rules'})}>Ver todas las reglas <ArrowRight size={15}/></button></div></section>
            {school.pie&&<PiePanel pie={summarizePie(school,state.staff,settings)} school={school} settings={settings} edit={()=>editSchool('pie')}/>}
          </>}
          <section className="panel facts-panel"><div className="panel-heading"><div><h2>Parámetros y proyección 2027</h2><p>Lo que define la capacidad del establecimiento y la decisión registrada para el próximo año</p></div><button className="secondary-btn" onClick={()=>editSchool('general')}><Pencil size={15}/>Editar</button></div><dl className="facts">{!isVtf&&<><div><dt>Proporción lectiva / no lectiva</dt><dd>{fmt(school.lectiveRatio*100)} / {fmt((1-school.lectiveRatio)*100)}</dd></div><div><dt>Jornada escolar completa</dt><dd>{school.jec?'Sí':'No'}</dd></div></>}<div><dt>Proyección 2027</dt><dd>{school.projection}</dd></div><div className="wide"><dt>Justificación técnico-pedagógica</dt><dd>{school.justification||'Sin decisión justificada todavía.'}</dd></div></dl></section>
        </>}

        {page==='import'&&<ImportPanel state={state} commit={commit} notify={setNotice} goPeople={()=>{setScope('all');changePage('people');}} readOnly={scope!=='all'}/>}

        {page==='reassign'&&<ReassignPanel stats={stats} state={state} commit={commit} notify={setNotice} readOnly={scope!=='all'}/>}

        {page==='support'&&<SupportPage state={state} setState={setState} notify={setNotice}/>}

        {page==='history'&&<>
          <section className="panel"><div className="panel-heading"><div><h2>Historial de decisiones</h2><p>{events.length} eventos en este navegador · registro local, no es una auditoría de producción</p></div><ExportMenu busy={busy} items={listMenu('history','bitacora-dotacion-2027','Todos los eventos con fecha, acción y motivo')}/></div><div className="timeline">{events.map(e=><article key={e.id}><span className="timeline-icon"><History size={17}/></span><div><h3>{e.action}</h3><p>{e.detail}</p><small>{e.author} · {new Date(e.date).toLocaleString('es-CL')}</small></div></article>)}</div></section>
          <section className="panel reset-panel"><div><h2>Volver al escenario inicial</h2><p>Borra ajustes, importaciones y bitácora de este navegador y recupera los 2.200 registros ficticios. Útil antes de grabar el video.</p></div><button className="secondary-btn danger" onClick={()=>setModal({type:'reset'})}><RotateCcw size={16}/>Restablecer demo</button></section>
        </>}
        <footer className="main-footer"><span>CMEstudios <span>·</span> Gestión de dotación escolar</span><span>Demo funcional · datos locales en este navegador</span></footer>
      </div>
    </main>
    {notice&&<div className="toast" role="status"><CheckCircle2 size={19}/>{notice}<button onClick={()=>setNotice('')} aria-label="Cerrar aviso"><X size={16}/></button></div>}
    {modal?.type==='person'&&<EditPerson key={modal.person.id} person={modal.person} isNew={modal.isNew} schools={scope==='all'?state.schools:state.schools.filter(s=>s.id===selectedSchool)} close={()=>setModal(null)} save={p=>savePerson(p,modal.isNew)} download={modal.isNew?null:()=>exportIndividual(modal.person)} busy={busy}/>}
    {modal?.type==='school'&&<EditSchool key={school.id+modal.section} section={modal.section} school={school} summary={summary} vtfCount={state.schools.filter(s=>s.modality==='Jardín VTF').length} close={()=>setModal(null)} save={saveSchool}/>}
    {modal?.type==='plan'&&<EditPlan plan={modal.plan} isNew={modal.isNew} modality={school.modality} close={()=>setModal(null)} save={(p,reason)=>{commit(prev=>({...prev,plans:modal.isNew?[...prev.plans,p]:prev.plans.map(x=>x.id===p.id?p:x)}),modal.isNew?'Asignatura incorporada':'Plan de estudios actualizado',`${school.name}: ${p.subject}${p.track?` (${p.track})`:''}, ${p.groups} cursos × ${p.hoursPerGroup} h. Motivo: ${reason}`);setModal(null);setNotice('Plan guardado. Cuadratura recalculada.');}}/>}
    {modal?.type==='settings'&&<EditSettings settings={settings} close={()=>setModal(null)} save={(next,reason)=>{commit(prev=>({...prev,settings:next}),'Supuestos de cálculo actualizados',`Colación ${next.lunchMinutesPerDay} min diarios desde ${next.lunchFromHours} h; apoyo PIE ${next.pieHoursJec} h por curso con JEC y ${next.pieHoursNoJec} h sin JEC. Motivo: ${reason}`);setModal(null);setNotice('Supuestos guardados. Indicadores recalculados.');}}/>}
    {modal?.type==='rules'&&<Dialog title="Alcance y reglas de la demo" subtitle="Qué funciona hoy y qué falta validar" close={()=>setModal(null)} wide><div className="dialog-body rules-copy"><p><strong>Funciona:</strong> importación CSV masiva validada, asignación de personal, cargos vacantes, ajustes con justificación, planes editables, cuadratura por establecimiento y por modalidad, indicadores PAL, ficha por establecimiento con firma, exportaciones Excel con fórmulas, PDF y CSV, y bitácora local.</p><h3>Horas y proporciones</h3><p>El contrato usa horas de 60 minutos y el plan horas pedagógicas de 45 minutos. Capacidad lectiva = horas de contrato × proporción configurada × 60/45. La demo permite 65/35 o 60/40 por establecimiento. La aplicabilidad debe determinarse por docente y normativa antes de producción; no todos los cargos tienen horas de aula.</p><h3>Tipos de hora</h3><p>Lectivas en aula = horas asignadas × 45/60. El resto del contrato se clasifica como directivo, técnico-pedagógico o curricular no lectivo según la función del cargo. Las fuentes (subvención general, SEP/PME, PIE, VTF) se informan aparte, según el financiamiento registrado de cada persona.</p><h3>Modalidades</h3><p>Liceos TP: la formación general y la diferenciada por especialidad se cuadran por separado. Microcentros: el plan se distribuye por los cursos combinados de cada escuela rural. Jardines VTF: personas requeridas por nivel según coeficientes de escenario; no se cuadran horas curriculares. PIE: horas de apoyo por curso con o sin JEC, repartidas entre NEE transitorias y permanentes según estudiantes; son supuestos editables, no valores normativos validados.</p><h3>Ajustes y protecciones</h3><p>La no renovación solo se permite en contratos a plazo fijo o contrata. Las personas con fuero gremial muestran una advertencia antes de una disminución o no renovación, que requiere revisión jurídica. La colación se calcula con minutos diarios y un umbral de jornada configurables.</p><h3>Jardines VTF</h3><p>Los coeficientes no vienen fijados en las bases. Se configuran como escenario por nivel y se comparan con matrícula, educadoras y técnicas; no se presentan como coeficientes legales verificados.</p><h3>Condiciones pendientes</h3><p>Validar reglas PIE/NEE, horas gremiales, fueros, fuentes de financiamiento y modalidades especiales. Adaptar reportes a layouts oficiales MINEDUC y a la planilla PAL de la DEP. Implementar permisos reales, autenticación, 2FA, servidor, respaldos y soporte; hoy las vistas son simuladas y los datos se guardan en este navegador.</p></div><div className="dialog-actions"><button className="primary-btn" onClick={()=>setModal(null)}>Entendido</button></div></Dialog>}
    {modal?.type==='guide'&&<Dialog title="Un recorrido de 4 minutos y medio" subtitle="Los cinco parámetros que evalúa la comisión (Anexo 7)" close={()=>setModal(null)}><div className="dialog-body guide-steps">{[['00:00','1 · Plataforma 52 + 4','Establecimientos: 52 unidades y 4 microcentros; cada fila abre su cuadratura.'],['00:45','2 · Carga masiva','Importar datos: probar el archivo de ejemplo (más de 200 filas), revisar y confirmar.'],['01:40','3 · Módulos por modalidad','Cuadratura de una escuela con PIE, un liceo TP por formación, un jardín VTF por niveles y un microcentro por escuela rural.'],['02:50','4 · Cuadratura y ajustes','Editar una asignatura, ver el recálculo, crear un cargo vacante y exportar la ficha para firma.'],['03:40','5 · Dashboard','Indicadores PAL: horas por tipo, VTF, vacantes, no renovados y PIE. Exportar el Excel con fórmulas.']].map(([time,title,desc])=><div key={time}><span>{time}</span><section><h3>{title}</h3><p>{desc}</p></section></div>)}</div><div className="dialog-actions"><button className="primary-btn" onClick={()=>{setModal(null);changePage('schools');}}>Comenzar por Establecimientos <ArrowRight size={16}/></button></div></Dialog>}
    {modal?.type==='alerts'&&<Dialog title="Alertas de planificación" subtitle="Haz clic en una alerta para abrir su cuadratura" close={()=>setModal(null)}><div className="dialog-body"><div className="warning-banner"><AlertTriangle size={18}/>{deficits.length} establecimientos con déficit · {overloads} sobrecargas individuales.</div>{scoped.filter(s=>s.status==='Déficit'||s.status==='Sobrecarga'||s.status==='Por validar').sort((a,b)=>a.gap-b.gap).slice(0,12).map(s=><button className="alert-item" key={s.id} onClick={()=>{goPlan(s.id);setModal(null);}}><div><strong>{s.name}</strong><small>{s.modality==='Jardín VTF'?'Coeficientes VTF pendientes de validación':s.status==='Sobrecarga'?`${s.overloads} docentes con sobrecarga`:`${fmt(s.gap)} h pedagógicas de diferencia`}</small></div><Status value={s.status}/><ArrowRight size={16}/></button>)}</div></Dialog>}
    {modal?.type==='bulkMove'&&<BulkMoveDialog people={state.staff.filter(p=>selected.has(p.id))} schools={state.schools} close={()=>setModal(null)} save={bulkMove}/>}
    {modal?.type==='reset'&&<Dialog title="¿Restablecer el escenario?" subtitle="Se eliminarán ajustes, importaciones y bitácora de esta demo." close={()=>setModal(null)}><div className="dialog-body"><p>Los archivos que ya descargaste se conservan. Esta acción recupera los 2.200 registros ficticios iniciales.</p></div><div className="dialog-actions"><button className="secondary-btn" onClick={()=>setModal(null)}>Cancelar</button><button className="primary-btn" onClick={()=>{setState(createSeed());setModal(null);setNotice('Escenario inicial restablecido.');}}>Restablecer demo</button></div></Dialog>}
  </div>;
}

function Kpi({icon:Icon,title,value,footer,color,cta,onClick}) {
  const body=<><div className="kpi-top"><span>{title}</span><span className={`kpi-icon ${color}`}><Icon size={19}/></span></div><strong>{value}</strong><p>{footer}</p>{cta&&<span className="kpi-cta">{cta} <ArrowRight size={13}/></span>}</>;
  return onClick?<button className="kpi kpi-link" onClick={onClick}>{body}</button>:<article className="kpi">{body}</article>;
}
function SearchBox({value,change,placeholder}) {return <label className="search"><Search size={17}/><input aria-label={placeholder} placeholder={placeholder} value={value} onChange={e=>change(e.target.value)}/>{value&&<button aria-label="Limpiar búsqueda" onClick={()=>change('')}><X size={14}/></button>}</label>;}
function Filter({label,children}) {return <label className="filter"><span>{label}</span>{children}</label>;}
function ModeSelect({value,change}) {return <select aria-label="Filtrar modalidad" value={value} onChange={e=>change(e.target.value)}><option>Todas las modalidades</option>{MODALITIES.map(m=><option key={m}>{m}</option>)}</select>;}
function Empty() {return <div className="empty"><Search size={28}/><h3>No hay resultados</h3><p>Prueba otra búsqueda o cambia los filtros.</p></div>;}
// Un solo botón por pantalla para exportar; las opciones se explican dentro del menú.
function ExportMenu({items,busy,label='Exportar'}) {
  const [open,setOpen]=useState(false);const ref=useRef();
  useEffect(()=>{if(!open)return;const out=e=>{if(!ref.current?.contains(e.target))setOpen(false);};const esc=e=>{if(e.key==='Escape')setOpen(false);};document.addEventListener('mousedown',out);document.addEventListener('keydown',esc);return()=>{document.removeEventListener('mousedown',out);document.removeEventListener('keydown',esc);};},[open]);
  return <div className="export-menu" ref={ref}><button className="secondary-btn" aria-haspopup="menu" aria-expanded={open} disabled={busy} onClick={()=>setOpen(o=>!o)}><Download size={16}/>{busy?'Generando…':label}<ChevronDown size={15}/></button>{open&&<div className="menu" role="menu">{items.map(it=><button role="menuitem" key={it.label} onClick={()=>{setOpen(false);it.run();}}><span className="menu-icon"><it.icon size={18}/></span><span><strong>{it.label}</strong><small>{it.hint}</small></span></button>)}</div>}</div>;
}
function Workflow({go}) {
  const steps=[[UploadCloud,'Cargar el maestro','Importa el CSV del personal; se valida antes de aplicar.','import'],[BookOpen,'Revisar la cuadratura','Plan de estudios contra horas asignadas, según cada modalidad.','plans'],[UsersRound,'Registrar ajustes','Vacantes, disminuciones y no renovaciones, con su motivo.','people'],[ChartColumn,'Reportar el PAL','Indicadores de la DEP y fichas para firma, en Excel y PDF.','indicators']];
  return <section className="panel workflow"><div className="panel-heading"><div><h2>Cómo se construye la dotación 2027</h2><p>Cuatro pasos, en este orden. Cada tarjeta abre su pantalla.</p></div></div><div className="workflow-steps">{steps.map(([Icon,title,desc,to],i)=><button key={to} className="workflow-step" onClick={()=>go(to)}><span className="step-head"><span className="step-number">{i+1}</span><span className="step-icon"><Icon size={19}/></span></span><strong>{title}</strong><small>{desc}</small><span className="step-cta">Abrir <ArrowRight size={13}/></span></button>)}</div></section>;
}
function SchoolTable({rows,open}) {return <div className="table-scroll"><table><thead><tr><th>ESTABLECIMIENTO</th><th>MODALIDAD</th><th>DOCENTES</th><th>ASISTENTES</th><th>BRECHA LECTIVA</th><th>ESTADO</th><th><span className="sr-only">Abrir</span></th></tr></thead><tbody>{rows.map(s=><tr key={s.id} className="clickable" tabIndex={0} onClick={()=>open(s.id)} onKeyDown={e=>{if(e.key==='Enter')open(s.id);}}><td><div className="school-name"><span className="school-icon"><ModeIcon mode={s.modality}/></span><span><strong>{s.name}</strong><small>{s.commune} · {s.id}</small></span></div></td><td>{s.modality}</td><td>{s.teachers}{s.vacancies>0&&<small>+{s.vacancies} vacante{s.vacancies>1?'s':''}</small>}</td><td>{s.assistants}</td><td className={s.gap<0?'text-amber':'text-teal'}>{s.modality==='Jardín VTF'?<span className="text-muted">Por coeficientes</span>:<><strong>{s.gap>0?'+':''}{fmt(s.gap)} h</strong><small>pedagógicas</small></>}</td><td><Status value={s.status}/></td><td className="row-open"><ArrowRight size={16}/></td></tr>)}</tbody></table>{!rows.length&&<Empty/>}</div>;}
const validCoef = v => Number.isInteger(v) && v > 0;
function VtfPanel({school,summary,edit}) {
  const levels=vtfLevelsOf(school);
  return <><section className="kpis"><Kpi icon={Baby} title="Matrícula de escenario" value={summary.enrollment} footer={levels.map(l=>`${l.level}: ${l.enrollment}`).join(' · ')} color="teal"/><Kpi icon={GraduationCap} title="Educadoras disponibles" value={summary.educators} footer={summary.needEducators===null?'Coeficiente por validar':`Requeridas: ${summary.needEducators} según escenario`} color="blue"/><Kpi icon={BriefcaseBusiness} title="Técnicas disponibles" value={summary.technicians} footer={summary.needTechnicians===null?'Coeficiente por validar':`Requeridas: ${summary.needTechnicians} según escenario`} color="purple"/><Kpi icon={SlidersHorizontal} title="Coeficientes de atención" value={summary.vtfConfigured?'Configurados':'Pendientes'} footer="Validar aplicabilidad según nivel y edad" color={summary.vtfConfigured?'teal':'orange'}/></section>
    <section className="panel module-panel"><div className="panel-heading"><div><h2>Coeficientes por nivel</h2><p>Personas requeridas = matrícula ÷ niños por persona, redondeado hacia arriba en cada nivel</p></div><button className="primary-btn" onClick={edit}><SlidersHorizontal size={16}/>Configurar coeficientes</button></div><div className="table-scroll"><table><thead><tr><th>NIVEL</th><th>MATRÍCULA</th><th>NIÑOS POR EDUCADORA</th><th>EDUCADORAS REQUERIDAS</th><th>NIÑOS POR TÉCNICA</th><th>TÉCNICAS REQUERIDAS</th></tr></thead><tbody>{levels.map(l=><tr key={l.level}><td><strong>{l.level}</strong></td><td>{l.enrollment}</td><td>{validCoef(l.educatorPerChildren)?l.educatorPerChildren:<span className="text-muted">Por validar</span>}</td><td>{validCoef(l.educatorPerChildren)&&l.enrollment>0?Math.ceil(l.enrollment/l.educatorPerChildren):'—'}</td><td>{validCoef(l.technicianPerChildren)?l.technicianPerChildren:<span className="text-muted">Por validar</span>}</td><td>{validCoef(l.technicianPerChildren)&&l.enrollment>0?Math.ceil(l.enrollment/l.technicianPerChildren):'—'}</td></tr>)}</tbody><tfoot><tr><td>Total</td><td>{summary.enrollment}</td><td/><td>{summary.needEducators??'—'} · disponibles {summary.educators}</td><td/><td>{summary.needTechnicians??'—'} · disponibles {summary.technicians}</td></tr></tfoot></table></div>{!summary.vtfConfigured&&<p className="field-help padded">Las bases no fijan los coeficientes. Puedes ensayar valores por nivel, identificados como escenario y no como validación normativa.</p>}</section></>;
}
const Figure = ({label,value,tone}) => <div><small>{label}</small><strong className={tone}>{value}</strong></div>;
const signed = v => `${v>0?'+':''}${fmt(v)} h`;
function TpPanel({data}) {return <section className="panel module-panel"><div className="panel-heading"><div><h2>Cuadratura por tipo de formación</h2><p>Horas pedagógicas (45 min) requeridas por el plan y asignadas a docentes de cada formación</p></div></div><div className="module-grid">{data.tracks.map(t=><article className="module-card" key={t.track}><span className="module-eyebrow">{t.track}</span><div className="module-figures"><Figure label="Requeridas" value={`${fmt(t.required)} h`}/><Figure label="Asignadas" value={`${fmt(t.assigned)} h`}/><Figure label={t.gap<0?'Déficit':'Excedente'} value={signed(t.gap)} tone={t.gap<0?'text-amber':'text-teal'}/></div><p>{t.teachers} docentes asignados a esta formación</p></article>)}<article className="module-card"><span className="module-eyebrow">Especialidades</span><ul className="module-list">{data.specialties.map(sp=><li key={sp.specialty}><strong>{sp.specialty}</strong><small>{sp.groups} cursos de 3° y 4° medio · {fmt(sp.required)} h</small></li>)}{!data.specialties.length&&<li><small>Sin especialidades en el plan</small></li>}</ul>{data.unassigned.teachers>0&&<p className="text-amber">{data.unassigned.teachers} docentes sin formación asignada ({fmt(data.unassigned.assigned)} h)</p>}</article></div></section>;}
function RuralPanel({data,edit}) {return <section className="panel module-panel"><div className="panel-heading"><div><h2>Cuadratura por escuela rural</h2><p>Cada curso combinado requiere {fmt(data.perGroup)} h pedagógicas según el plan agrupado</p></div><button className="secondary-btn" onClick={edit}><MapPin size={15}/>Editar matrícula y cursos</button></div><div className="table-scroll"><table><thead><tr><th>ESCUELA RURAL</th><th>MATRÍCULA</th><th>CURSOS COMBINADOS</th><th>DOCENTES</th><th>REQUERIDAS</th><th>ASIGNADAS</th><th>BRECHA</th></tr></thead><tbody>{data.members.map(m=><tr key={m.name}><td><strong>{m.name}</strong></td><td>{m.enrollment}</td><td>{m.groups}</td><td>{m.teachers}</td><td>{fmt(m.required)} h</td><td>{fmt(m.assigned)} h</td><td className={m.gap<0?'text-amber':'text-teal'}><strong>{signed(m.gap)}</strong></td></tr>)}{data.unassigned.teachers>0&&<tr><td><strong>Sin escuela asignada</strong></td><td/><td/><td>{data.unassigned.teachers}</td><td/><td>{fmt(data.unassigned.assigned)} h</td><td/></tr>}</tbody></table></div></section>;}
function PiePanel({pie,school,settings,edit}) {const per=school.jec?settings.pieHoursJec:settings.pieHoursNoJec;return <section className="panel module-panel"><div className="panel-heading"><div><h2>Programa de Integración Escolar (PIE)</h2><p>{fmt(per)} h cronológicas de apoyo por curso {school.jec?'con':'sin'} JEC · supuesto editable en Indicadores PAL</p></div><button className="secondary-btn" onClick={edit}><Pencil size={15}/>Editar datos PIE</button></div><div className="module-grid"><article className="module-card"><span className="module-eyebrow">Estudiantes</span><div className="module-figures"><Figure label="Cursos con PIE" value={pie.courses}/><Figure label="NEE transitorias" value={pie.neet}/><Figure label="NEE permanentes" value={pie.neep}/></div></article><article className="module-card"><span className="module-eyebrow">Horas de apoyo requeridas</span><div className="module-figures"><Figure label="Transitorias" value={`${fmt(pie.requiredT)} h`}/><Figure label="Permanentes" value={`${fmt(pie.requiredP)} h`}/><Figure label="Total" value={`${fmt(pie.required)} h`}/></div></article><article className="module-card"><span className="module-eyebrow">Horas docentes PIE contratadas</span><div className="module-figures"><Figure label="Contratadas" value={`${fmt(pie.assigned)} h`}/><Figure label={pie.gap<0?'Déficit':'Excedente'} value={signed(pie.gap)} tone={pie.gap<0?'text-amber':'text-teal'}/></div><p>Profesionales asistentes PIE: {fmt(pie.assistantHours)} h</p></article></div></section>;}

function BarList({rows,unit='h'}) {const max=Math.max(1,...rows.map(r=>r.value));return <div className="bar-list">{rows.map(r=><div className="bar-row" key={r.label}><div className="bar-label"><span>{r.label}</span><strong>{fmt(r.value)}{unit&&<small> {unit}</small>}</strong></div><div className="gap-track"><i className={`tone-${r.tone??0}`} style={{width:`${r.value>0?Math.max(2,r.value/max*100):0}%`}}/></div>{r.sub&&<small>{r.sub}</small>}</div>)}</div>;}
const SectionTitle = ({children,hint}) => <div className="section-title"><h2>{children}</h2>{hint&&<p>{hint}</p>}</div>;
function IndicatorsPage({ind,settings,busy,menu,editSettings,openSchool,goPeople,scopeAll}) {
  const t=ind.hourTypes;const hoursOf=f=>ind.funding[f]?.hours??0;
  return <>
    <div className="intro-bar"><div className="info-inline"><ShieldCheck size={18}/>{scopeAll?`${ind.schools} unidades de gestión del SLEP`:'Establecimiento en vista'} · horas de 60 min salvo indicación · datos ficticios</div><ExportMenu busy={busy} items={menu} label="Exportar indicadores"/></div>
    <SectionTitle hint="Personas y horas contratadas hoy. Haz clic en una tarjeta para ver la lista.">Dotación vigente</SectionTitle>
    <section className="kpis"><Kpi icon={Clock3} title="Horas cronológicas docentes vigentes" value={fmt(ind.teachers.hours)} footer={`${fmt(ind.teachers.count)} docentes vigentes`} color="blue" cta="Ver docentes" onClick={()=>goPeople({type:'Docente'})}/><Kpi icon={BriefcaseBusiness} title="Asistentes de la educación" value={fmt(ind.assistants.count)} footer={`${fmt(ind.assistants.hours)} h · ${fmt(ind.assistants.fullTime)} jornadas de 44 h`} color="purple" cta="Ver asistentes" onClick={()=>goPeople({type:'Asistente'})}/><Kpi icon={GraduationCap} title="Educadoras de párvulos VTF" value={fmt(ind.educatorsVtf.count)} footer={`${fmt(ind.educatorsVtf.hours)} h contratadas`} color="teal" cta="Ver educadoras" onClick={()=>goPeople({type:'Docente',mode:'Jardín VTF'})}/><Kpi icon={Sprout} title="Técnicas en atención de párvulos VTF" value={fmt(ind.techniciansVtf.count)} footer={`${fmt(ind.techniciansVtf.hours)} h contratadas`} color="teal" cta="Ver personal VTF" onClick={()=>goPeople({type:'Asistente',mode:'Jardín VTF'})}/></section>
    <SectionTitle hint="Decisiones registradas para el próximo año y personas con protección.">Ajustes proyectados 2027</SectionTitle>
    <section className="kpis"><Kpi icon={UserMinus} title="Horas a suprimir por optimización" value={fmt(ind.reduction.hours)} footer={`${ind.reduction.count} personas con disminución · excedente detectado: ${fmt(ind.surplusPed)} h pedagógicas`} color="orange" cta="Ver disminuciones" onClick={()=>goPeople({situation:'Disminución'})}/><Kpi icon={UserX} title="Contratos no renovados" value={fmt(ind.nonRenewed.count)} footer={`${fmt(ind.nonRenewed.hours)} h al término del periodo legal`} color="orange" cta="Ver no renovados" onClick={()=>goPeople({situation:'No renovación'})}/><Kpi icon={UserPlus} title="Cargos vacantes" value={fmt(ind.vacancies.count)} footer={`${fmt(ind.vacancies.hours)} h de contrato · cubren ${fmt(ind.vacancies.ped)} h pedagógicas`} color="blue" cta="Ver vacantes" onClick={()=>goPeople({situation:'Cargos vacantes'})}/><Kpi icon={Scale} title="Personas con fuero gremial" value={fmt(ind.fuero.count)} footer={`${fmt(ind.fuero.hours)} h contratadas`} color="purple" cta="Ver personas con fuero" onClick={()=>goPeople({situation:'Con fuero gremial'})}/></section>
    <SectionTitle hint="Cómo se reparten las horas contratadas.">Horas</SectionTitle>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-heading"><div><h2>Tipos de horas docentes</h2><p>Docentes de establecimientos escolares · horas cronológicas</p></div></div><BarList rows={[{label:'Lectivas en aula',value:t.aula,tone:0},{label:'Curriculares no lectivas',value:t.noLectivas,tone:1},{label:'Directivas',value:t.directivas,tone:2},{label:'Técnico-pedagógicas',value:t.tecnicas,tone:3}]}/><h3 className="bar-heading">Por fuente de financiamiento</h3><BarList rows={[{label:'Subvención general',value:hoursOf('General'),tone:0},{label:'SEP / PME',value:hoursOf('SEP'),tone:1},{label:'PIE',value:hoursOf('PIE'),tone:2},{label:'VTF (educadoras)',value:hoursOf('VTF'),tone:3}]}/><div className="panel-footer"><span><Utensils size={14}/>Colación: {fmt(ind.lunch.hours)} h semanales</span></div></section>
      <section className="panel"><div className="panel-heading"><div><h2>Horas por modalidad</h2><p>Horas contratadas de docentes y asistentes</p></div></div><BarList rows={ind.byModality.map((m,i)=>({label:`${m.modality} (${m.units})`,value:m.total,tone:i%4,sub:`Docentes ${fmt(m.teacherHours)} h · asistentes ${fmt(m.assistantHours)} h · ${fmt(m.people)} personas`}))}/></section>
    </div>
    <SectionTitle hint="Quiénes forman la dotación y el apoyo a estudiantes con NEE.">Personas y PIE</SectionTitle>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-heading"><div><h2>Dotación por función y categoría</h2><p>Docentes de establecimientos escolares y asistentes de la educación</p></div></div><BarList unit="personas" rows={TEACHER_FUNCTIONS.map((f,i)=>({label:f,value:ind.teacherFunctions[f]?.count??0,tone:i,sub:`${fmt(ind.teacherFunctions[f]?.hours??0)} h`}))}/><h3 className="bar-heading">Asistentes por categoría</h3><BarList unit="personas" rows={Object.entries(ind.assistantCategories).map(([c,v],i)=>({label:c,value:v.count,tone:i%4,sub:`${fmt(v.hours)} h`}))}/></section>
      <section className="panel"><div className="panel-heading"><div><h2>Apoyo PIE: NEE transitorias y permanentes</h2><p>{ind.pie.schools} establecimientos con PIE · {fmt(ind.pie.courses)} cursos</p></div></div><BarList rows={[{label:`Requeridas NEE transitorias (${fmt(ind.pie.neet)} estudiantes)`,value:ind.pie.requiredT,tone:0},{label:`Requeridas NEE permanentes (${fmt(ind.pie.neep)} estudiantes)`,value:ind.pie.requiredP,tone:1},{label:'Horas docentes PIE contratadas',value:ind.pie.assigned,tone:2},{label:'Profesionales asistentes PIE',value:ind.pie.assistantHours,tone:3}]}/></section>
    </div>
    <SectionTitle hint="Haz clic en una fila para abrir la cuadratura del establecimiento.">Por establecimiento</SectionTitle>
    <section className="panel"><div className="table-scroll"><table><thead><tr><th>ESTABLECIMIENTO</th><th>MODALIDAD</th><th>HORAS DOCENTES</th><th>HORAS ASISTENTES</th><th>TOTAL</th><th>HORAS VACANTES</th><th>BRECHA LECTIVA</th><th>ESTADO</th></tr></thead><tbody>{ind.bySchool.map(s=><tr key={s.id} className="clickable" tabIndex={0} onClick={()=>openSchool(s.id)} onKeyDown={e=>{if(e.key==='Enter')openSchool(s.id);}}><td><div className="school-name"><span className="school-icon"><ModeIcon mode={s.modality}/></span><span><strong>{s.name}</strong><small>{s.commune} · {s.id}</small></span></div></td><td>{s.modality}</td><td>{fmt(s.teacherHours)} h</td><td>{fmt(s.assistantHours)} h</td><td><strong>{fmt(s.total)} h</strong></td><td>{s.vacantHours?`${fmt(s.vacantHours)} h`:'—'}</td><td className={s.gap===null?'':s.gap<0?'text-amber':'text-teal'}>{s.gap===null?<span className="text-muted">Por coeficientes</span>:<><strong>{s.gap>0?'+':''}{fmt(s.gap)} h</strong><small>pedagógicas</small></>}</td><td><Status value={s.status}/></td></tr>)}</tbody></table></div></section>
    <SectionTitle hint="Valores de escenario que usan los cálculos de colación y PIE.">Supuestos de cálculo</SectionTitle>
    <section className="panel facts-panel"><div className="panel-heading"><div><h2>Supuestos del escenario</h2><p>Deben validarse con la normativa vigente y los criterios del SLEP antes de usar datos reales</p></div><button className="secondary-btn" onClick={editSettings}><Pencil size={15}/>Editar supuestos</button></div><dl className="facts"><div><dt>Colación diaria</dt><dd>{fmt(settings.lunchMinutesPerDay)} min</dd></div><div><dt>Colación desde jornadas de</dt><dd>{fmt(settings.lunchFromHours)} h semanales</dd></div><div><dt>Apoyo PIE por curso con JEC</dt><dd>{fmt(settings.pieHoursJec)} h</dd></div><div><dt>Apoyo PIE por curso sin JEC</dt><dd>{fmt(settings.pieHoursNoJec)} h</dd></div></dl></section>
  </>;
}

// Déficit y excedente en dos columnas, para ver de un vistazo dónde faltan y dónde sobran horas.
function SideBySide({schools,open}) {
  const list=schools.filter(s=>s.modality!=='Jardín VTF');
  const deficit=list.filter(s=>s.gap<-0.01).sort((a,b)=>a.gap-b.gap); const surplus=list.filter(s=>s.gap>0.01).sort((a,b)=>b.gap-a.gap);
  const total=items=>items.reduce((n,s)=>n+Math.abs(s.gap),0);
  const column=(title,items,tone)=><div className="side-col"><div className={`side-head ${tone}`}><strong>{title} · {items.length}</strong><span>{tone==='deficit'?'Faltan':'Sobran'} {fmt(total(items))} h pedagógicas</span></div><div className="side-items">{items.map(s=><button key={s.id} className="side-item" onClick={()=>open(s.id)}><span><strong>{s.name}</strong><small>{s.commune} · {s.modality}</small></span><b className={tone==='deficit'?'text-amber':'text-teal'}>{s.gap>0?'+':''}{fmt(s.gap)} h</b></button>)}{!items.length&&<p className="field-help padded">Ninguno.</p>}</div></div>;
  return <section className="panel side-panel"><div className="panel-heading"><div><h2>Déficit y excedente, lado a lado</h2><p>Dónde faltan y dónde sobran horas lectivas · haz clic en un colegio para abrir su cuadratura</p></div></div><div className="side-grid">{column('Con déficit',deficit,'deficit')}{column('Con excedente',surplus,'surplus')}</div></section>;
}

function BulkMoveDialog({people,schools,close,save}) {
  const [to,setTo]=useState('');const [reason,setReason]=useState('');const [error,setError]=useState('');
  const origin=new Set(people.map(p=>p.schoolId));
  const submit=e=>{e.preventDefault();if(!to)return setError('Elige el establecimiento de destino.');if(!reason.trim())return setError('Escribe el motivo; queda en la bitácora.');save(to,reason.trim());};
  return <Dialog title={`Mover ${people.length} persona${people.length>1?'s':''}`} subtitle="Cambian de establecimiento conservando sus horas y su contrato. La cuadratura de ambos colegios se recalcula." close={close}><form onSubmit={submit}><div className="dialog-body form-grid">
    <div className="full move-list">{people.slice(0,10).map(p=><span key={p.id}><strong>{p.name}</strong><small>{schools.find(s=>s.id===p.schoolId)?.name}</small></span>)}{people.length>10&&<span><small>y {people.length-10} más</small></span>}</div>
    <label className="full">Establecimiento de destino<select value={to} onChange={e=>setTo(e.target.value)}><option value="">Selecciona un establecimiento</option>{schools.filter(s=>!(origin.size===1&&origin.has(s.id))).map(s=><option key={s.id} value={s.id}>{s.name} · {s.modality}</option>)}</select></label>
    <label className="full">Motivo del traslado<textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Ej.: cubrir el déficit de Matemática de la Escuela Los Canelos"/></label>
    {error&&<p className="error-text full" role="alert">{error}</p>}
  </div><div className="dialog-actions"><button type="button" className="secondary-btn" onClick={close}>Cancelar</button><button className="primary-btn">Mover {people.length} persona{people.length>1?'s':''} <Check size={16}/></button></div></form></Dialog>;
}

const TICKET_TONE = { Abierto: 'amber', 'En curso': 'blue', Resuelto: 'green' };
const fmtDate = ms => new Date(ms).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
const hoursText = h => h < 1 ? 'menos de 1 h' : `${Math.round(h)} h`;
function SlaBadge({ t }) {
  const sla = ticketSla(t);
  const [tone, text] = sla.state === 'met' ? ['green', 'Respondido en plazo'] : sla.state === 'missed' ? ['amber', 'Respondido fuera de plazo'] : sla.state === 'late' ? ['amber', `Vencido hace ${hoursText(sla.hours)}`] : ['blue', `Responder en ${hoursText(sla.hours)}`];
  return <span className={`badge ${tone}`}><span className="status-dot"/>{text}</span>;
}
function SupportPage({ state, setState, notify }) {
  const tickets = state.tickets ?? [];
  const [filter, setFilter] = useState('Todos');
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState({ type: TICKET_TYPES[0], schoolId: '', subject: '', description: '' });
  const [error, setError] = useState('');
  const stats = ticketStats(tickets);
  const field = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const update = (id, fn) => setState(prev => ({ ...prev, tickets: (prev.tickets ?? []).map(t => t.id === id ? fn(t) : t) }));
  const create = e => {
    e.preventDefault();
    if (!form.subject.trim() || !form.description.trim()) return setError('Escribe un asunto y describe el requerimiento.');
    const t = { id: nextTicketId(tickets), createdAt: Date.now(), requester: 'Usuario · Demo', ...form, subject: form.subject.trim(), description: form.description.trim(), status: 'Abierto', firstResponseAt: null, thread: [] };
    setState(prev => ({ ...prev, tickets: [...(prev.tickets ?? []), t] }));
    setForm({ type: TICKET_TYPES[0], schoolId: '', subject: '', description: '' }); setError('');
    notify(`Ticket ${t.id} creado. El soporte responde dentro de ${TICKET_SLA_HOURS} horas.`);
  };
  const shown = tickets.filter(t => filter === 'Todos' || t.status === filter).sort((a, b) => b.createdAt - a.createdAt);
  const open = tickets.find(t => t.id === openId);
  return <>
    <section className="kpis">
      <Kpi icon={LifeBuoy} title="Tickets abiertos" value={stats.open} footer="Abiertos o en curso" color="blue"/>
      <Kpi icon={CheckCircle2} title="Resueltos" value={stats.resolved} footer="Cerrados con respuesta" color="teal"/>
      <Kpi icon={Clock3} title="Respuesta en plazo" value={stats.onTimePct === null ? '—' : `${stats.onTimePct}%`} footer={`Meta: primera respuesta en ${TICKET_SLA_HOURS} h`} color="purple"/>
      <Kpi icon={AlertTriangle} title="Vencidos sin respuesta" value={stats.late} footer="Superaron las 24 horas" color="orange"/>
    </section>
    <section className="panel"><div className="panel-heading"><div><h2>Nuevo requerimiento</h2><p>Reporta un error, pide un ajuste de dotación o consulta cómo usar la plataforma</p></div></div>
      <form onSubmit={create}><div className="form-grid" style={{ padding: 16 }}>
        <label>Tipo<select value={form.type} onChange={e => field('type', e.target.value)}>{TICKET_TYPES.map(v => <option key={v}>{v}</option>)}</select></label>
        <label>Establecimiento (opcional)<select value={form.schoolId} onChange={e => field('schoolId', e.target.value)}><option value="">Todo el SLEP / no aplica</option>{state.schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="full">Asunto<input value={form.subject} onChange={e => field('subject', e.target.value)} placeholder="Ej.: Renuncia de docente, liberar horas"/></label>
        <label className="full">Descripción<textarea value={form.description} onChange={e => field('description', e.target.value)} placeholder="Cuéntanos qué necesitas y en qué establecimiento"/></label>
        {error && <p className="error-text full" role="alert">{error}</p>}
        <div className="full"><button className="primary-btn" type="submit">Enviar requerimiento <Check size={16}/></button></div>
      </div></form>
    </section>
    <section className="panel"><div className="panel-heading"><div><h2>Requerimientos</h2><p>{shown.length} de {tickets.length} · haz clic en uno para responder o cambiar su estado</p></div>
      <select aria-label="Filtrar por estado" value={filter} onChange={e => setFilter(e.target.value)}>{['Todos', ...TICKET_STATUS].map(v => <option key={v}>{v}</option>)}</select></div>
      <div className="table-scroll"><table><thead><tr><th>TICKET</th><th>ASUNTO</th><th>TIPO</th><th>CREADO</th><th>ESTADO</th><th>PLAZO 24 H</th></tr></thead><tbody>
        {shown.map(t => <tr key={t.id}><td><button className="school-name" onClick={() => setOpenId(t.id)}><strong>{t.id}</strong></button></td><td><button className="school-name" onClick={() => setOpenId(t.id)}><span><strong>{t.subject}</strong><small>{t.requester}{t.schoolId ? ` · ${state.schools.find(s => s.id === t.schoolId)?.name ?? ''}` : ''}</small></span></button></td><td>{t.type}</td><td>{fmtDate(t.createdAt)}</td><td><span className={`badge ${TICKET_TONE[t.status]}`}><span className="status-dot"/>{t.status}</span></td><td><SlaBadge t={t}/></td></tr>)}
        {!shown.length && <tr><td colSpan="6">No hay requerimientos en este estado.</td></tr>}
      </tbody></table></div>
    </section>
    {open && <TicketDialog key={open.id} t={open} school={state.schools.find(s => s.id === open.schoolId)} close={() => setOpenId(null)} update={fn => update(open.id, fn)}/>}
  </>;
}
function TicketDialog({ t, school, close, update }) {
  const [text, setText] = useState('');
  const [by, setBy] = useState('Soporte CMEstudios');
  const reply = e => {
    e.preventDefault();
    if (!text.trim()) return;
    const now = Date.now();
    update(x => ({ ...x, thread: [...x.thread, { at: now, by, text: text.trim() }], firstResponseAt: x.firstResponseAt ?? (by === 'Soporte CMEstudios' ? now : null), status: x.status === 'Abierto' && by === 'Soporte CMEstudios' ? 'En curso' : x.status }));
    setText('');
  };
  return <Dialog title={`${t.id} · ${t.subject}`} subtitle={`${t.type} · ${t.requester}${school ? ` · ${school.name}` : ''} · ${fmtDate(t.createdAt)}`} close={close} wide>
    <div className="dialog-body">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}><span className={`badge ${TICKET_TONE[t.status]}`}><span className="status-dot"/>{t.status}</span><SlaBadge t={t}/><span style={{ flex: 1 }}/>{TICKET_STATUS.filter(v => v !== t.status).map(v => <button key={v} type="button" className="secondary-btn" onClick={() => update(x => ({ ...x, status: v }))}>{v === 'Resuelto' ? 'Marcar resuelto' : v === 'Abierto' ? 'Reabrir' : 'Pasar a En curso'}</button>)}</div>
      <div className="move-list"><span><strong>{t.requester}</strong><small>{fmtDate(t.createdAt)}</small>{t.description}</span>{t.thread.map((m, i) => <span key={i}><strong>{m.by}</strong><small>{fmtDate(m.at)}</small>{m.text}</span>)}</div>
      <form onSubmit={reply} className="form-grid" style={{ marginTop: 12 }}>
        <label>Responder como<select value={by} onChange={e => setBy(e.target.value)}><option>Soporte CMEstudios</option><option>Solicitante</option></select></label>
        <label className="full">Mensaje<textarea value={text} onChange={e => setText(e.target.value)} placeholder="Escribe tu respuesta"/></label>
        <div className="full"><button className="primary-btn" type="submit" disabled={!text.trim()}>Enviar respuesta <Check size={16}/></button></div>
      </form>
    </div>
    <div className="dialog-actions"><button type="button" className="secondary-btn" onClick={close}>Cerrar</button></div>
  </Dialog>;
}

function TeacherTable({rows}) {
  return <div className="table-scroll"><table><thead><tr><th>DOCENTE</th><th>COLEGIO</th><th>CONTRATO</th><th>LECTIVAS</th><th>USO DE CAPACIDAD</th><th>ESTADO</th><th>SUGERENCIA</th></tr></thead><tbody>{rows.map(t=><tr key={t.id}><td><strong>{t.name}</strong><small>{t.rut}</small></td><td><span className="truncate" title={t.originName}>{t.originName}</span>{t.otherSchoolName&&<small>+ {t.otherSchoolName}</small>}</td><td>{fmt(t.contract)} → <strong>{fmt(t.contractAfter)}</strong> h</td><td>{fmt(t.lectivasBefore)} → <strong>{fmt(t.lectivasAfter)}</strong> h</td><td>{formatPct(t.utilBefore)} → <strong>{formatPct(t.utilAfter)}</strong></td><td><span className={`badge ${LABEL_TONE[t.label]}`}>{t.label}</span>{t.labelBefore!==t.label&&<small>Antes: {t.labelBefore}</small>}</td><td className="wrap-cell">{t.suggestions.join(' ')}</td></tr>)}</tbody></table>{!rows.length&&<Empty/>}</div>;
}

function EditPerson({person,isNew,schools,close,save,download,busy}) {
  const [p,setP]=useState({changeHours:0,...person});const [error,setError]=useState('');const school=schools.find(s=>s.id===p.schoolId);const check=teacherCheck(p,school);
  const field=(key,val)=>setP(prev=>({...prev,[key]:val}));
  const number=v=>v===''?NaN:Number(v);
  const tp=school?.modality==='Técnico profesional'&&p.type==='Docente';const micro=school?.modality==='Microcentro';
  const needsHours=['Aumento','Disminución'].includes(p.projection)&&!p.vacant;
  const risky=hasFuero(p)&&['Disminución','No renovación'].includes(p.projection);
  const submit=e=>{e.preventDefault();
    if(!p.justification.trim())return setError('Escribe una justificación para registrar el cambio.');
    if(!Number.isFinite(p.contractHours)||p.contractHours<=0||p.contractHours>44||!Number.isFinite(p.assignedPed)||p.assignedPed<0)return setError('Revisa las horas ingresadas.');
    if(p.projection==='No renovación'&&!RENEWABLE.includes(p.contract))return setError('Solo un contrato a plazo fijo o contrata puede quedar como no renovado.');
    if(needsHours&&(!Number.isFinite(p.changeHours)||p.changeHours<=0))return setError('Indica cuántas horas se aumentan o suprimen.');
    if(p.projection==='Disminución'&&p.changeHours>p.contractHours)return setError('No se pueden suprimir más horas que las del contrato.');
    if(p.projection==='Aumento'&&!p.vacant&&p.contractHours+p.changeHours>FULL_TIME)return setError('El aumento supera la jornada máxima de 44 horas.');
    if(tp&&!TP_TRACKS.includes(p.track))return setError('Asigna la formación del docente en el liceo TP.');
    const split=p.hoursBasic===undefined?{}:!p.hoursMedia?{hoursBasic:p.contractHours}:!p.hoursBasic?{hoursMedia:p.contractHours}:{};
    save({...p,...split,assignedPed:p.type==='Asistente'?0:p.assignedPed,changeHours:p.vacant?p.contractHours:needsHours?p.changeHours:0,track:tp?p.track:undefined,ruralSchool:micro?p.ruralSchool:undefined});};
  return <Dialog title={isNew?'Nuevo cargo vacante':p.vacant?'Cargo vacante':person.name} subtitle={isNew?`${school?.name} · se suma a la dotación como cargo por proveer`:`${person.rut||person.id} · ${person.role} · ${school?.name}`} close={close}><form onSubmit={submit}><div className="dialog-body form-grid">
    {!p.vacant&&<><p className="form-section full">Maestro de remuneraciones</p><dl className="full maestro-facts">{[['RUT',person.rut],['Estatuto',person.statute],['Tramo',person.tramo||'No aplica'],['Ingreso',person.startDate],['Término',person.endDate||'Indefinido'],['Horas básica / media',person.hoursBasic===undefined?'No aplica':`${person.hoursBasic} / ${person.hoursMedia}`]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v||'Sin dato'}</dd></div>)}</dl></>}
    <p className="form-section full">Asignación</p>
    <label className="full">Establecimiento<select value={p.schoolId} onChange={e=>setP(prev=>({...prev,schoolId:e.target.value,track:undefined,ruralSchool:undefined}))}>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    {tp&&<label className="full">Formación (liceo TP)<select value={p.track||''} onChange={e=>field('track',e.target.value)}><option value="" disabled>Selecciona</option>{TP_TRACKS.map(t=><option key={t}>{t}</option>)}</select></label>}
    {micro&&<label className="full">Escuela rural<select value={p.ruralSchool||''} onChange={e=>field('ruralSchool',e.target.value||undefined)}><option value="">Sin escuela asignada</option>{school.ruralMembers.map(m=><option key={m.name}>{m.name}</option>)}</select></label>}
    <p className="form-section full">Jornada</p>
    <label>Horas de contrato (60 min)<input type="number" min="0.1" max="44" step="any" required value={p.contractHours} onChange={e=>field('contractHours',number(e.target.value))}/></label>
    <label>Lectivas asignadas (45 min)<input type="number" min="0" step="any" required disabled={p.type==='Asistente'} value={p.assignedPed} onChange={e=>field('assignedPed',number(e.target.value))}/></label>
    {p.type==='Docente'&&<div className={`full ${check.excess>0?'warning-banner':'info-inline'}`}><AlertTriangle size={17}/>{check.excess>0?`Sobrecarga: ${fmt(check.excess)} h sobre el máximo configurado.`:`Capacidad lectiva configurada: ${fmt(check.capacity)} h pedagógicas.`}</div>}
    <p className="form-section full">Contrato</p>
    <label>Tipo de contrato<select value={p.contract} onChange={e=>field('contract',e.target.value)}>{CONTRACTS.map(v=><option key={v}>{v}</option>)}</select></label>
    <label>Financiamiento<select value={p.funding} onChange={e=>field('funding',e.target.value)}>{FUNDING.map(v=><option key={v}>{v}</option>)}</select></label>
    {!p.vacant&&<label className="full">Fuero<select value={hasFuero(p)?'Fuero gremial':''} onChange={e=>field('protection',e.target.value)}><option value="">Sin fuero</option><option>Fuero gremial</option></select></label>}
    <p className="form-section full">Proyección 2027</p>
    <label className={needsHours?'':'full'}>Proyección<select value={p.projection} onChange={e=>field('projection',e.target.value)}>{PROJECTIONS.map(v=><option key={v} disabled={v==='No renovación'&&(p.vacant||!RENEWABLE.includes(p.contract))}>{v}</option>)}</select>{!p.vacant&&!RENEWABLE.includes(p.contract)&&<small>"No renovación" solo aplica a contratos a plazo fijo o contrata.</small>}</label>
    {needsHours&&<label>{p.projection==='Aumento'?'Horas a aumentar (60 min)':'Horas a suprimir (60 min)'}<input type="number" min="0.5" max="44" step="any" required value={Number.isFinite(p.changeHours)&&p.changeHours>0?p.changeHours:''} onChange={e=>field('changeHours',number(e.target.value))}/></label>}
    {risky&&<div className="full warning-banner"><Scale size={17}/>Persona con fuero gremial: una disminución o no renovación requiere revisión jurídica antes de aplicarse.</div>}
    <label className="full">Justificación del cambio<textarea required value={p.justification} onChange={e=>field('justification',e.target.value)} placeholder={p.vacant?'Ej.: cubrir el déficit de Matemática en 7° y 8° básico':'Ej.: ajuste de escenario por cambio de matrícula'}/></label>
    {error&&<p className="error-text full" role="alert">{error}</p>}
    {download&&<div className="full download-row"><FileText size={17}/><span>Carga horaria individual en PDF, con espacio para firma.</span><button type="button" className="link-btn" disabled={busy} onClick={download}>Descargar <Download size={14}/></button></div>}
  </div><div className="dialog-actions"><button type="button" className="secondary-btn" onClick={close}>Cancelar</button><button className="primary-btn" type="submit">{isNew?'Crear cargo vacante':'Guardar cambios'} <Check size={16}/></button></div></form></Dialog>;
}

// Cada sección del establecimiento se edita por separado: el botón abre solo lo que muestra su panel.
function EditSchool({section,school,summary,vtfCount,close,save}) {
  const vtf=school.modality==='Jardín VTF';
  const [s,setS]=useState(()=>({...school,vtfLevels:vtf?vtfLevelsOf(school).map(l=>({...l})):school.vtfLevels,ruralMembers:school.ruralMembers.map(m=>({...m})),pie:school.pie?{...school.pie}:null}));
  const [reason,setReason]=useState(section==='general'?school.justification:'');const [applyAll,setApplyAll]=useState(false);const [error,setError]=useState('');
  const field=(key,val)=>setS(prev=>({...prev,[key]:val}));
  const int=v=>v===''?null:Number(v);
  const setLevel=(i,key,val)=>setS(prev=>({...prev,vtfLevels:prev.vtfLevels.map((l,j)=>j===i?{...l,[key]:val}:l)}));
  const setMember=(i,key,val)=>setS(prev=>({...prev,ruralMembers:prev.ruralMembers.map((m,j)=>j===i?{...m,[key]:val}:m)}));
  const setPie=(key,val)=>setS(prev=>({...prev,pie:{...prev.pie,[key]:val}}));
  const intOk=(v,min)=>Number.isInteger(v)&&v>=min;
  const titles={general:['Parámetros y proyección 2027','Proporción lectiva, jornada y la decisión para el próximo año.'],pie:['Datos del PIE','Cursos con PIE y estudiantes con NEE transitorias y permanentes.'],rural:['Escuelas rurales del microcentro','Matrícula y cursos combinados de cada escuela. Los cursos del plan se recalculan.'],vtf:['Coeficientes de atención VTF','Matrícula y niños por persona en cada nivel del jardín.']}[section];
  const submit=e=>{e.preventDefault();
    if(!reason.trim())return setError('Escribe el motivo del cambio; queda en la bitácora.');
    if(section==='vtf'&&s.vtfLevels.some(l=>!intOk(l.enrollment,0)||(l.educatorPerChildren!==null&&!intOk(l.educatorPerChildren,1))||(l.technicianPerChildren!==null&&!intOk(l.technicianPerChildren,1))))return setError('La matrícula y los coeficientes deben ser números enteros positivos.');
    if(section==='rural'&&s.ruralMembers.some(m=>!intOk(m.enrollment,0)||!intOk(m.groups,1)))return setError('Cada escuela rural necesita matrícula y al menos un curso combinado.');
    if(section==='pie'&&['courses','neet','neep'].some(k=>!intOk(s.pie[k],0)))return setError('Los datos PIE deben ser enteros mayores o iguales a 0.');
    const next={...s,justification:section==='general'?reason.trim():school.justification};
    if(vtf)next.enrollment=s.vtfLevels.reduce((n,l)=>n+l.enrollment,0);
    if(school.modality==='Microcentro')next.enrollment=s.ruralMembers.reduce((n,m)=>n+m.enrollment,0);
    save(next,section,section==='vtf'&&applyAll,reason.trim());};
  return <Dialog title={titles[0]} subtitle={`${school.name} · ${titles[1]}`} close={close} wide={section==='vtf'||section==='rural'}><form onSubmit={submit}><div className="dialog-body form-grid">
    {section==='general'&&<>{!vtf&&<><label>Proporción lectiva / no lectiva<select value={s.lectiveRatio} onChange={e=>field('lectiveRatio',Number(e.target.value))}><option value="0.65">65% lectiva / 35% no lectiva</option><option value="0.6">60% lectiva / 40% no lectiva</option></select><small>Parámetro simplificado por establecimiento; aplicabilidad por docente pendiente de validar.</small></label>
      <label className="check-row align-end"><input type="checkbox" checked={!!s.jec} onChange={e=>field('jec',e.target.checked)}/>Jornada escolar completa (JEC)</label></>}
      <label className="full">Proyección 2027<select value={s.projection} onChange={e=>field('projection',e.target.value)}>{['Mantención','Aumento','Disminución'].map(v=><option key={v}>{v}</option>)}</select></label></>}
    {section==='pie'&&<div className="full triple"><label>Cursos con PIE<input type="number" min="0" step="1" value={s.pie.courses??''} onChange={e=>setPie('courses',int(e.target.value))}/></label><label>Estudiantes NEE transitorias<input type="number" min="0" step="1" value={s.pie.neet??''} onChange={e=>setPie('neet',int(e.target.value))}/></label><label>Estudiantes NEE permanentes<input type="number" min="0" step="1" value={s.pie.neep??''} onChange={e=>setPie('neep',int(e.target.value))}/></label></div>}
    {section==='rural'&&<div className="full table-scroll inline-table"><table><thead><tr><th>ESCUELA RURAL</th><th>MATRÍCULA</th><th>CURSOS COMBINADOS</th></tr></thead><tbody>{s.ruralMembers.map((m,i)=><tr key={m.name}><td><strong>{m.name}</strong></td><td><input aria-label={`Matrícula ${m.name}`} type="number" min="0" step="1" value={m.enrollment??''} onChange={e=>setMember(i,'enrollment',int(e.target.value))}/></td><td><input aria-label={`Cursos combinados ${m.name}`} type="number" min="1" step="1" value={m.groups??''} onChange={e=>setMember(i,'groups',int(e.target.value))}/></td></tr>)}</tbody></table></div>}
    {section==='vtf'&&<><div className="full table-scroll inline-table"><table><thead><tr><th>NIVEL</th><th>MATRÍCULA</th><th>NIÑOS POR EDUCADORA</th><th>NIÑOS POR TÉCNICA</th></tr></thead><tbody>{s.vtfLevels.map((l,i)=><tr key={l.level}><td><strong>{l.level}</strong></td><td><input aria-label={`Matrícula ${l.level}`} type="number" min="0" step="1" value={l.enrollment??''} onChange={e=>setLevel(i,'enrollment',int(e.target.value))}/></td><td><input aria-label={`Niños por educadora ${l.level}`} type="number" min="1" step="1" value={l.educatorPerChildren??''} placeholder="Por validar" onChange={e=>setLevel(i,'educatorPerChildren',int(e.target.value))}/></td><td><input aria-label={`Niños por técnica ${l.level}`} type="number" min="1" step="1" value={l.technicianPerChildren??''} placeholder="Por validar" onChange={e=>setLevel(i,'technicianPerChildren',int(e.target.value))}/></td></tr>)}</tbody></table></div>
      <label className="full check-row"><input type="checkbox" checked={applyAll} onChange={e=>setApplyAll(e.target.checked)}/>Aplicar estos coeficientes a los {vtfCount} jardines VTF (la matrícula de cada jardín no cambia)</label>
      <p className="full field-help">Valores de simulación. Las reglas legales por nivel y edad deben validarse.</p></>}
    <label className="full">{section==='general'?'Justificación técnico-pedagógica':'Motivo del cambio'}<textarea required value={reason} onChange={e=>setReason(e.target.value)} placeholder={section==='general'?'Describe matrícula, plan de estudios o necesidades del escenario':'Queda registrado en la bitácora'}/></label>
    {error&&<p className="error-text full" role="alert">{error}</p>}
  </div><div className="dialog-actions"><button type="button" className="secondary-btn" onClick={close}>Cancelar</button><button className="primary-btn">Guardar cambios <Check size={16}/></button></div></form></Dialog>;
}

function EditPlan({plan,isNew,modality,close,save}) {
  const [p,setP]=useState({...plan});const [reason,setReason]=useState('');const [error,setError]=useState('');
  const tp=modality==='Técnico profesional';const micro=modality==='Microcentro';const diff=tp&&p.track==='Formación diferenciada TP';
  const submit=e=>{e.preventDefault();if(!p.subject.trim()||!reason.trim()||!Number.isInteger(p.groups)||p.groups<1||!Number.isFinite(p.hoursPerGroup)||p.hoursPerGroup<0)return setError('Completa nombre, cursos, horas y justificación.');if(diff&&!p.specialty?.trim())return setError('Indica la especialidad de la formación diferenciada.');save({...p,specialty:diff?p.specialty.trim():undefined},reason);};
  return <Dialog title={isNew?'Agregar asignatura':'Editar plan de estudios'} subtitle="El cambio recalcula las horas requeridas del establecimiento." close={close}><form onSubmit={submit}><div className="dialog-body form-grid">
    <label className="full">Asignatura o componente<input required value={p.subject} onChange={e=>setP({...p,subject:e.target.value})}/></label>
    {tp&&<label>Formación<select value={p.track||'Formación general'} onChange={e=>setP({...p,track:e.target.value})}>{TP_TRACKS.map(t=><option key={t}>{t}</option>)}</select></label>}
    {diff&&<label>Especialidad<input value={p.specialty||''} onChange={e=>setP({...p,specialty:e.target.value})} placeholder="Ej.: Electricidad"/></label>}
    <label>Cursos o grupos<input type="number" required min="1" max="100" step="1" disabled={micro} value={p.groups} onChange={e=>setP({...p,groups:e.target.value===''?NaN:Number(e.target.value)})}/>{micro&&<small>Suma de los cursos combinados de las escuelas rurales; se edita en Parámetros.</small>}</label>
    <label>Horas pedagógicas por curso<input type="number" required min="0" max="100" step="any" value={p.hoursPerGroup} onChange={e=>setP({...p,hoursPerGroup:e.target.value===''?NaN:Number(e.target.value)})}/></label>
    <div className="full calculation-preview">Total requerido <strong>{fmt(p.groups*p.hoursPerGroup)} h pedagógicas</strong></div>
    <label className="full">Justificación<textarea required value={reason} onChange={e=>setReason(e.target.value)} placeholder="Describe el ajuste de este escenario"/></label>
    {error&&<p className="error-text full" role="alert">{error}</p>}
  </div><div className="dialog-actions"><button type="button" className="secondary-btn" onClick={close}>Cancelar</button><button className="primary-btn">Guardar y recalcular <Check size={16}/></button></div></form></Dialog>;
}

function EditSettings({settings,close,save}) {
  const [v,setV]=useState({...settings});const [reason,setReason]=useState('');const [error,setError]=useState('');
  const f=(k,x)=>setV(prev=>({...prev,[k]:x===''?NaN:Number(x)}));
  const submit=e=>{e.preventDefault();if(![v.lunchMinutesPerDay,v.lunchFromHours,v.pieHoursJec,v.pieHoursNoJec].every(x=>Number.isFinite(x)&&x>=0))return setError('Ingresa valores numéricos mayores o iguales a 0.');if(!reason.trim())return setError('Escribe el motivo del cambio.');save(v,reason);};
  return <Dialog title="Parámetros del escenario" subtitle="Se aplican a los indicadores y a la cuadratura PIE de todos los establecimientos." close={close}><form onSubmit={submit}><div className="dialog-body form-grid">
    <label>Colación diaria (minutos)<input type="number" min="0" max="120" step="5" value={v.lunchMinutesPerDay} onChange={e=>f('lunchMinutesPerDay',e.target.value)}/></label>
    <label>Desde jornadas de (horas semanales)<input type="number" min="0" max="44" step="1" value={v.lunchFromHours} onChange={e=>f('lunchFromHours',e.target.value)}/></label>
    <label>Apoyo PIE por curso con JEC (h)<input type="number" min="0" max="44" step="any" value={v.pieHoursJec} onChange={e=>f('pieHoursJec',e.target.value)}/></label>
    <label>Apoyo PIE por curso sin JEC (h)<input type="number" min="0" max="44" step="any" value={v.pieHoursNoJec} onChange={e=>f('pieHoursNoJec',e.target.value)}/></label>
    <p className="full field-help">Valores de escenario para la demostración. Deben validarse con la normativa vigente y los criterios del SLEP antes de usar datos reales.</p>
    <label className="full">Motivo del cambio<textarea required value={reason} onChange={e=>setReason(e.target.value)} placeholder="Ej.: ajuste de criterio PIE acordado con la UATP"/></label>
    {error&&<p className="error-text full" role="alert">{error}</p>}
  </div><div className="dialog-actions"><button type="button" className="secondary-btn" onClick={close}>Cancelar</button><button className="primary-btn">Guardar parámetros <Check size={16}/></button></div></form></Dialog>;
}

function ImportPanel({state,commit,notify,goPeople,readOnly}) {
  const [candidate,setCandidate]=useState(null);const [error,setError]=useState('');const [drag,setDrag]=useState(false);const [done,setDone]=useState(null);const fileRef=useRef();
  const result=useMemo(()=>candidate?validateImport(candidate.rows,state):null,[candidate,state]);
  const prepare=(text,name)=>{try{const rows=parseCSV(text);if(rows.length>10000)throw new Error('Máximo de demostración: 10.000 filas.');setCandidate({rows,name});setError('');setDone(null);}catch(e){setError(e.message);setCandidate(null);setDone(null);}};
  const load=async file=>{if(!file)return; if(!file.name.toLowerCase().endsWith('.csv')){setError('Selecciona un archivo .csv.');return;}if(file.size>5*1024*1024){setError('El archivo supera el máximo de 5 MB.');return;}try{prepare(await file.text(),file.name);}catch{setError('No se pudo leer el archivo.');}};
  const confirm=()=>{if(!result||result.errors.length||readOnly)return;const existing=new Set(state.staff.map(p=>p.id));const updated=result.people.filter(p=>existing.has(p.id)).length;const added=result.people.length-updated;commit(prev=>applyImport(prev,result.people),'Maestro CSV importado',`${candidate.name}: ${added} personas nuevas y ${updated} actualizadas por ID. Todas las filas validadas antes de aplicar.`);setDone({added,updated});setCandidate(null);notify('Importación completada. Dashboard y cuadratura actualizados.');};
  return <div className="import-layout"><div>{readOnly&&<div className="warning-banner"><ShieldCheck size={17}/>La importación está disponible en la vista Sostenedor. Cambia la vista superior para continuar.</div>}<section className="panel import-card"><div className="panel-heading"><div><h2>Importar maestro de personal</h2><p>Tres pasos: prepara el archivo, súbelo y confirma. Nada se aplica sin tu confirmación.</p></div></div><ol className="import-steps"><li><span className="step-number">1</span><div><strong>Prepara el archivo</strong><p>CSV separado por punto y coma o coma, con las columnas del formato de ejemplo.</p><button className="link-btn" onClick={()=>saveDownload('maestro-personal-ejemplo.csv',sampleImport())}>Descargar formato de ejemplo <Download size={14}/></button></div></li><li><span className="step-number">2</span><div><strong>Súbelo aquí abajo</strong><p>Se valida fila por fila antes de tocar los datos.</p></div></li><li><span className="step-number">3</span><div><strong>Revisa y confirma</strong><p>Verás cuántas personas se agregan y cuántas se actualizan.</p></div></li></ol><div className={`dropzone ${drag?'dragging':''}`} onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);if(!readOnly)load(e.dataTransfer.files[0]);}}><span className="upload-icon"><UploadCloud size={31}/></span><h3>Arrastra tu archivo aquí</h3><p>O selecciónalo desde tu equipo. Máximo 5 MB.</p><input ref={fileRef} aria-label="Archivo CSV del maestro" type="file" accept=".csv,text/csv" disabled={readOnly} onChange={e=>{load(e.target.files[0]);e.target.value='';}}/><button disabled={readOnly} className="primary-btn" onClick={()=>fileRef.current.click()}>Seleccionar archivo CSV <Plus size={16}/></button><span className="dropzone-or">¿Solo quieres probar?</span><button disabled={readOnly} className="link-btn" onClick={()=>prepare(sampleImport(),'maestro-personal-ejemplo.csv')}>Usar el archivo de ejemplo (más de 200 personas) <ArrowRight size={14}/></button></div></section>
    {error&&<div className="warning-banner" role="alert"><AlertTriangle size={19}/>{error}</div>}
    {candidate&&<section className="panel preview-card"><div className="panel-heading"><div><h2>Revisión antes de importar</h2><p>{candidate.name} · {candidate.rows.length} filas</p></div><span className={`badge ${result.errors.length?'amber':'green'}`}>{result.errors.length?'Requiere correcciones':'Validación completa'}</span></div>{result.errors.length?<div className="validation-errors" role="alert"><strong>No se aplicó ningún cambio.</strong><ul>{result.errors.slice(0,15).map((e,i)=><li key={i}>{e}</li>)}</ul>{result.errors.length>15&&<p>Y {result.errors.length-15} errores adicionales.</p>}</div>:<><div className="mini-summary"><span><strong>{result.people.filter(p=>!state.staff.some(s=>s.id===p.id)).length}</strong> nuevos</span><span><strong>{result.people.filter(p=>state.staff.some(s=>s.id===p.id)).length}</strong> actualizados por ID</span></div><div className="table-scroll"><table><thead><tr><th>RUT</th><th>NOMBRE</th><th>ESTABLECIMIENTO</th><th>ESTATUTO</th><th>HORAS</th></tr></thead><tbody>{result.people.slice(0,8).map(p=><tr key={p.id}><td>{p.rut||p.id}</td><td>{p.name}</td><td>{p.schoolId}</td><td>{p.statute||'—'}</td><td>{p.contractHours} h contrato</td></tr>)}</tbody></table></div><p className="field-help padded">Los IDs existentes se actualizan; las personas nuevas se agregan. Los registros que no aparecen en el archivo se conservan. Las posibles sobrecargas quedan visibles como alertas.</p></>}<div className="dialog-actions"><button className="secondary-btn" onClick={()=>setCandidate(null)}>Descartar archivo</button><button className="primary-btn" disabled={result.errors.length>0||readOnly} onClick={confirm}>Confirmar importación <Check size={17}/></button></div></section>}
    {done&&<section className="panel import-success"><CheckCircle2 size={35}/><h2>Datos incorporados</h2><p>{done.added} personas nuevas y {done.updated} actualizadas. El cambio quedó en la bitácora.</p><button className="primary-btn" onClick={goPeople}>Revisar dotación <ArrowRight size={16}/></button></section>}</div><aside className="import-aside"><span className="eyebrow">ANTES DE IMPORTAR</span><h2>Un maestro.<br/>Una fuente de verdad.</h2><p>Esta demo utiliza una estructura propia. Adaptaremos el mapeo al maestro real cuando el SLEP entregue sus insumos.</p><div className="import-check"><CheckCircle2 size={18}/><div><strong>Identificación por ID</strong><p>Valida el RUT con su dígito verificador. Los RUT del ejemplo son ficticios.</p></div></div><div className="import-check"><CheckCircle2 size={18}/><div><strong>Asignación por establecimiento</strong><p>Utiliza EST-001 a EST-056, disponibles en Establecimientos.</p></div></div><div className="import-check"><CheckCircle2 size={18}/><div><strong>Sin cambios parciales</strong><p>Si una fila tiene errores, se bloquea el archivo completo.</p></div></div><div className="import-check"><CheckCircle2 size={18}/><div><strong>Unidades de tiempo</strong><p>Contrato en horas de 60 min; lectivas en horas de 45 min.</p></div></div><div className="column-note"><strong>Columnas obligatorias</strong><code>id · nombre · establecimiento_id · tipo · cargo · horas_contrato · horas_lectivas_pedagogicas · financiamiento · contrato</code><strong className="spaced">Columnas del maestro de remuneraciones (opcionales)</strong><code>rut (con dígito verificador) · estatuto · tramo · fecha_ingreso · fecha_termino · horas_basica · horas_media</code><strong className="spaced">Otras columnas opcionales</strong><code>fuero (Sí/No) · formacion_tp (General/Diferenciada) · escuela_rural</code></div></aside></div>;
}

function ReassignPanel({stats,state,commit,notify,readOnly}) {
  const eligible=stats.filter(s=>s.modality!=='Jardín VTF'&&s.status!=='Por validar');
  const surplus=eligible.filter(s=>s.gap>0.01).sort((a,b)=>b.gap-a.gap);
  const deficit=eligible.filter(s=>s.gap<-0.01).sort((a,b)=>a.gap-b.gap);
  const suggestions=useMemo(()=>suggestReassignments(stats,state.staff),[stats,state.staff]);
  const [skip,setSkip]=useState(()=>new Set());
  const [reason,setReason]=useState('');
  const [error,setError]=useState('');
  const [from,setFrom]=useState('');const [personId,setPersonId]=useState('');const [to,setTo]=useState('');const [manualReason,setManualReason]=useState('');const [manualError,setManualError]=useState('');
  const chosen=suggestions.filter(m=>!skip.has(m.personId));
  const byId=new Map(stats.map(s=>[s.id,s]));
  const projected=useMemo(()=>{const next=applyReassignments(state,chosen);return state.schools.map(sc=>summarizeSchool(sc,next.staff,next.plans));},[state,chosen]);
  const stillDeficit=projected.filter(s=>s.modality!=='Jardín VTF'&&s.status==='Déficit').length;
  const hoursMoved=chosen.reduce((a,m)=>a+m.hours,0);
  const toggle=id=>setSkip(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});
  const applyChosen=()=>{
    if(!chosen.length)return setError('Selecciona al menos un movimiento.');
    if(!reason.trim())return setError('Escribe una justificación para registrar la reasignación.');
    commit(prev=>applyReassignments(prev,chosen),'Reasignación de dotación',`${chosen.length} docentes reasignados (${fmt(hoursMoved)} h lectivas): ${chosen.map(m=>`${m.name} (${m.personId}) ${m.fromId}→${m.toId}`).join('; ')}. Motivo: ${reason}`);
    setReason('');setError('');setSkip(new Set());notify(`${chosen.length} reasignaciones aplicadas. La cuadratura se recalculó.`);
  };
  const candidates=state.staff.filter(p=>p.schoolId===from&&movableTeachers(p));
  const person=candidates.find(p=>p.id===personId);
  const src=byId.get(from),dst=byId.get(to);
  const manualOk=person&&dst&&from!==to;
  const applyManual=()=>{
    if(!manualOk)return setManualError('Elige origen, docente y destino distintos.');
    if(!manualReason.trim())return setManualError('Escribe una justificación para registrar el movimiento.');
    commit(prev=>({...prev,staff:prev.staff.map(x=>x.id===person.id?{...x,schoolId:to}:x)}),'Reasignación manual',`${person.name} (${person.id}): ${src.name} → ${dst.name}, ${fmt(person.assignedPed)} h lectivas. Motivo: ${manualReason}`);
    setPersonId('');setManualReason('');setManualError('');notify('Docente reasignado. La cuadratura se recalculó.');
  };
  const SchoolList=({rows,sign})=><div className="table-scroll"><table><thead><tr><th>ESTABLECIMIENTO</th><th>COMUNA</th><th>BRECHA (h ped.)</th></tr></thead><tbody>{rows.map(s=><tr key={s.id}><td>{s.name}</td><td>{s.commune}</td><td><strong>{sign}{fmt(Math.abs(s.gap))}</strong></td></tr>)}{!rows.length&&<tr><td colSpan="3">Sin establecimientos.</td></tr>}</tbody></table></div>;
  return <>
    {readOnly&&<div className="warning-banner"><ShieldCheck size={17}/>Las reasignaciones están disponibles en la vista Sostenedor. Cambia la vista superior para aplicarlas.</div>}
    <section className="kpis"><Kpi icon={TrendingUp} title="Excedente total" value={fmt(surplus.reduce((a,s)=>a+s.gap,0))} footer={`${surplus.length} establecimientos · horas pedagógicas`} color="blue"/><Kpi icon={AlertTriangle} title="Déficit total" value={fmt(deficit.reduce((a,s)=>a-s.gap,0))} footer={`${deficit.length} establecimientos · horas pedagógicas`} color="orange"/><Kpi icon={ArrowLeftRight} title="Movimientos sugeridos" value={suggestions.length} footer={`${fmt(suggestions.reduce((a,m)=>a+m.hours,0))} h lectivas por mover`} color="teal"/><Kpi icon={CheckCircle2} title="Déficit tras aplicar" value={stillDeficit} footer="Establecimientos que seguirían en déficit con la selección" color="purple"/></section>
    <div className="info-banner"><CircleHelp size={18}/><div><strong>Cómo se calcula.</strong><span>Se mueven docentes de aula completos con sus horas lectivas. Ningún origen queda en déficit ni el destino se excede. Se priorizan movimientos dentro de la misma comuna. Se excluyen personas con fuero y los Jardines VTF.</span></div></div>
    <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><h2>Con excedente</h2><p>Horas asignadas sobre el plan</p></div></div><SchoolList rows={surplus} sign="+"/></section><section className="panel"><div className="panel-heading"><div><h2>Con déficit</h2><p>Horas del plan sin cubrir</p></div></div><SchoolList rows={deficit} sign="−"/></section></div>
    <section className="panel"><div className="panel-heading"><div><h2>Sugerencias de reasignación</h2><p>{chosen.length} de {suggestions.length} seleccionadas · {fmt(hoursMoved)} h lectivas</p></div></div>
      <div className="table-scroll"><table><thead><tr><th></th><th>DOCENTE</th><th>HORAS LECTIVAS</th><th>ORIGEN</th><th>DESTINO</th><th>COMUNA</th></tr></thead><tbody>{suggestions.map(m=><tr key={m.personId}><td><input type="checkbox" aria-label={`Incluir ${m.name}`} checked={!skip.has(m.personId)} onChange={()=>toggle(m.personId)}/></td><td>{m.name}<br/><small>{m.personId}</small></td><td>{fmt(m.hours)}</td><td>{m.from}</td><td>{m.to}</td><td>{m.sameCommune?'Misma comuna':'Otra comuna'}</td></tr>)}{!suggestions.length&&<tr><td colSpan="6">No hay movimientos posibles con las reglas actuales.</td></tr>}</tbody></table></div>
      {!readOnly&&suggestions.length>0&&<div className="form-grid" style={{padding:16}}><label className="full">Justificación<textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Ej.: cuadratura 2027 entre establecimientos de la misma comuna"/></label>{error&&<p className="error-text full" role="alert">{error}</p>}<div className="full"><button className="primary-btn" onClick={applyChosen}>Aplicar {chosen.length} reasignaciones <Check size={16}/></button></div></div>}
    </section>
    <section className="panel"><div className="panel-heading"><div><h2>Reasignación manual</h2><p>Mueve un docente de aula específico entre establecimientos</p></div></div>
      <div className="form-grid" style={{padding:16}}>
        <label>Origen<select value={from} onChange={e=>{setFrom(e.target.value);setPersonId('');}}><option value="">Elegir…</option>{eligible.map(s=><option key={s.id} value={s.id}>{s.name} ({s.gap>0?'+':''}{fmt(s.gap)} h)</option>)}</select></label>
        <label>Docente<select value={personId} onChange={e=>setPersonId(e.target.value)} disabled={!from}><option value="">Elegir…</option>{candidates.map(p=><option key={p.id} value={p.id}>{p.name} · {fmt(p.assignedPed)} h</option>)}</select></label>
        <label>Destino<select value={to} onChange={e=>setTo(e.target.value)}><option value="">Elegir…</option>{eligible.filter(s=>s.id!==from).map(s=><option key={s.id} value={s.id}>{s.name} ({s.gap>0?'+':''}{fmt(s.gap)} h)</option>)}</select></label>
        {manualOk&&<div className="full info-inline"><ArrowLeftRight size={17}/>{src.name}: {fmt(src.gap)} → {fmt(round(src.gap-person.assignedPed))} h · {dst.name}: {fmt(dst.gap)} → {fmt(round(dst.gap+person.assignedPed))} h{src.gap-person.assignedPed<-0.01?' · el origen quedaría en déficit':''}</div>}
        <label className="full">Justificación<textarea value={manualReason} onChange={e=>setManualReason(e.target.value)} placeholder="Motivo del movimiento"/></label>
        {manualError&&<p className="error-text full" role="alert">{manualError}</p>}
        <div className="full"><button className="primary-btn" disabled={readOnly} onClick={applyManual}>Mover docente <Check size={16}/></button></div>
      </div></section>
  </>;
}

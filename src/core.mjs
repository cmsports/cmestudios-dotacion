export const MODALITIES = ['Escuela regular', 'Liceo', 'Técnico profesional', 'Escuela especial', 'Jardín VTF', 'Microcentro'];
export const STORAGE_KEY = 'cmestudios.dotacion.demo.v2';
export const STATE_VERSION = 2;
export const FUNDING = ['General', 'SEP', 'PIE', 'VTF'];
export const CONTRACTS = ['Indefinido', 'Plazo fijo', 'Titular', 'Contrata'];
export const RENEWABLE = ['Plazo fijo', 'Contrata'];
export const PROJECTIONS = ['Mantención', 'Aumento', 'Disminución', 'No renovación'];
export const TP_TRACKS = ['Formación general', 'Formación diferenciada TP'];
export const TEACHER_FUNCTIONS = ['Docente de aula', 'Directiva', 'Técnico-pedagógica'];
// Campos del Maestro de Remuneraciones (bases técnicas, insumos del Servicio Local).
export const STATUTES = ['Estatuto Docente', 'Ley 21.109', 'Código del Trabajo'];
export const TRAMOS = ['Inicial', 'Temprano', 'Avanzado', 'Experto I', 'Experto II'];
// RUT con dígito verificador módulo 11. Los del escenario son ficticios y quedan fuera del rango de personas naturales.
export function rutDv(body) { let sum = 0, factor = 2; for (const d of String(body).split('').reverse()) { sum += Number(d) * factor; factor = factor === 7 ? 2 : factor + 1; } const r = 11 - (sum % 11); return r === 11 ? '0' : r === 10 ? 'K' : String(r); }
export const formatRut = body => `${String(body).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${rutDv(body)}`;
export function parseRut(text) { const m = String(text).replace(/[.\s]/g, '').toUpperCase().match(/^(\d{7,8})-?([\dK])$/); return m && rutDv(m[1]) === m[2] ? formatRut(m[1]) : null; }
// Acepta AAAA-MM-DD o DD-MM-AAAA (también con /) y devuelve AAAA-MM-DD, o null si la fecha no existe.
export function parseDate(text) {
  const t = String(text).trim(); let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/); let y, mo, d;
  if (m) [, y, mo, d] = m; else if ((m = t.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/))) [, d, mo, y] = m; else return null;
  const date = new Date(Date.UTC(+y, +mo - 1, +d));
  return date.getUTCFullYear() === +y && date.getUTCMonth() === +mo - 1 && date.getUTCDate() === +d ? `${y}-${mo}-${d}` : null;
}
export const ASSISTANT_CATEGORIES = ['Profesional', 'Técnica', 'Administrativa', 'Auxiliar'];
export const FULL_TIME = 44;
// Parámetros de escenario, editables desde Indicadores. No son valores normativos validados.
export const DEFAULT_SETTINGS = { lunchMinutesPerDay: 30, lunchFromHours: 30, pieHoursJec: 10, pieHoursNoJec: 7 };
export const fmt = (v) => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 }).format(v);
export const round = (v) => Math.round(v * 100) / 100;
const sum = (list, f) => list.reduce((s, x) => s + f(x), 0);

// A classroom pedagogical hour has 45 minutes. Contracts use 60-minute hours.
// The ratio is a scenario parameter, not a determination of legal applicability.
export function capacityPedagogical(contractHours, ratio = 0.65) {
  return round(contractHours * ratio * 60 / 45);
}
export function teacherCheck(person, school) {
  const ratio = school?.lectiveRatio ?? 0.65;
  const capacity = capacityPedagogical(person.contractHours, ratio);
  return { capacity, assigned: person.assignedPed, excess: round(Math.max(0, person.assignedPed - capacity)), lectiveClock: round(person.contractHours * ratio), nonLectiveClock: round(person.contractHours * (1 - ratio)) };
}

export function teacherFunction(role = '') {
  if (/directiv|director|subdirector|inspector general/i.test(role)) return 'Directiva';
  if (/t[ée]cnico-pedag|utp|jefe t[ée]cnico|orientador|evaluador|coordinador/i.test(role)) return 'Técnico-pedagógica';
  return 'Docente de aula';
}
export function assistantCategory(role = '') {
  if (/profesional|psic[oó]log|fonoaudi|trabajador.? social|terapeuta|kinesi/i.test(role)) return 'Profesional';
  if (/t[ée]cnic|asistente de aula|p[áa]rvulos|inspector|paradocente/i.test(role)) return 'Técnica';
  if (/administrativ|secretari|recepcion/i.test(role)) return 'Administrativa';
  if (/auxiliar|manipulador|portero|chofer|aseo|mantenci/i.test(role)) return 'Auxiliar';
  return 'Por clasificar';
}
// Horas cronológicas (60 min) de un docente por tipo. Las lectivas salen de las asignadas (45 min);
// el resto del contrato es directivo, técnico-pedagógico o curricular no lectivo según la función.
export function hourBreakdown(person) {
  const total = person.contractHours;
  const aula = round(Math.min(total, person.assignedPed * 45 / 60));
  const rest = round(total - aula);
  const fn = teacherFunction(person.role);
  return { aula, noLectivas: fn === 'Docente de aula' ? rest : 0, directivas: fn === 'Directiva' ? rest : 0, tecnicas: fn === 'Técnico-pedagógica' ? rest : 0 };
}

export function vtfLevelsOf(school) {
  return school.vtfLevels ?? [{ level: 'Total', enrollment: school.enrollment, educatorPerChildren: school.educatorPerChildren ?? null, technicianPerChildren: school.technicianPerChildren ?? null }];
}
const validCoefficient = v => Number.isInteger(v) && v > 0;

export function summarizeSchool(school, staff, plans) {
  const people = staff.filter(p => p.schoolId === school.id);
  const persons = people.filter(p => !p.vacant);
  const teachers = persons.filter(p => p.type === 'Docente');
  const assistants = persons.filter(p => p.type === 'Asistente');
  const vacancies = people.filter(p => p.vacant);
  const required = plans.filter(p => p.schoolId === school.id).reduce((s, p) => s + p.groups * p.hoursPerGroup, 0);
  const lecturers = people.filter(p => p.type === 'Docente');
  const assigned = sum(lecturers, p => p.assignedPed);
  const vacantPed = round(sum(vacancies.filter(p => p.type === 'Docente'), p => p.assignedPed));
  const capacity = sum(lecturers, p => capacityPedagogical(p.contractHours, school.lectiveRatio));
  const gap = round(assigned - required);
  const overloads = teachers.filter(p => teacherCheck(p, school).excess > 0.01).length;
  const educators = teachers.filter(p => p.role === 'Educadora de párvulos').length;
  const technicians = assistants.filter(p => p.role === 'Técnica en párvulos').length;
  const vtf = school.modality === 'Jardín VTF';
  const levels = vtf ? vtfLevelsOf(school).filter(l => l.enrollment > 0) : [];
  const vtfConfigured = vtf && levels.length > 0 && levels.every(l => validCoefficient(l.educatorPerChildren) && validCoefficient(l.technicianPerChildren));
  const needEducators = vtfConfigured ? sum(levels, l => Math.ceil(l.enrollment / l.educatorPerChildren)) : null;
  const needTechnicians = vtfConfigured ? sum(levels, l => Math.ceil(l.enrollment / l.technicianPerChildren)) : null;
  const enrollment = vtf ? sum(vtfLevelsOf(school), l => l.enrollment) : school.enrollment;
  const deficit = vtf ? vtfConfigured && (educators < needEducators || technicians < needTechnicians) : gap < -0.01;
  const status = vtf && !vtfConfigured ? 'Por validar' : overloads ? 'Sobrecarga' : deficit ? 'Déficit' : !vtf && gap > 0.01 ? 'Excedente' : 'Equilibrado';
  return { ...school, enrollment, teachers: teachers.length, assistants: assistants.length, people: persons.length, vacancies: vacancies.length, vacantPed, required, assigned: round(assigned), capacity: round(capacity), gap, overloads, status, educators, technicians, needEducators, needTechnicians, vtfConfigured, contractHours: sum(persons, p => p.contractHours) };
}

// Liceos TP: formación general y diferenciada se cuadran por separado.
export function summarizeTracks(school, staff, plans) {
  const own = plans.filter(p => p.schoolId === school.id);
  const lecturers = staff.filter(p => p.schoolId === school.id && p.type === 'Docente');
  const tracks = TP_TRACKS.map(track => {
    const req = sum(own.filter(p => (p.track || 'Formación general') === track), p => p.groups * p.hoursPerGroup);
    const mine = lecturers.filter(p => p.track === track);
    const asg = round(sum(mine, p => p.assignedPed));
    return { track, required: req, assigned: asg, gap: round(asg - req), teachers: mine.filter(p => !p.vacant).length };
  });
  const loose = lecturers.filter(p => !TP_TRACKS.includes(p.track));
  const specialties = [...new Set(own.filter(p => p.specialty).map(p => p.specialty))].map(specialty => {
    const rows = own.filter(p => p.specialty === specialty);
    return { specialty, groups: Math.max(...rows.map(p => p.groups)), required: sum(rows, p => p.groups * p.hoursPerGroup) };
  });
  return { tracks, unassigned: { teachers: loose.length, assigned: round(sum(loose, p => p.assignedPed)) }, specialties };
}

// Microcentros: cada escuela rural multigrado tiene sus cursos combinados y sus docentes.
export function summarizeRural(school, staff, plans) {
  const perGroup = sum(plans.filter(p => p.schoolId === school.id), p => p.hoursPerGroup);
  const lecturers = staff.filter(p => p.schoolId === school.id && p.type === 'Docente');
  const names = school.ruralMembers.map(m => m.name);
  const members = school.ruralMembers.map(m => {
    const mine = lecturers.filter(p => p.ruralSchool === m.name);
    const req = m.groups * perGroup; const asg = round(sum(mine, p => p.assignedPed));
    return { ...m, required: req, assigned: asg, gap: round(asg - req), teachers: mine.filter(p => !p.vacant).length };
  });
  const loose = lecturers.filter(p => !names.includes(p.ruralSchool));
  return { perGroup, members, unassigned: { teachers: loose.length, assigned: round(sum(loose, p => p.assignedPed)) } };
}

// PIE: horas de apoyo requeridas por curso (con o sin JEC) contra horas docentes financiadas por PIE.
export function summarizePie(school, staff, settings = DEFAULT_SETTINGS) {
  if (!school.pie) return null;
  const { courses, neet, neep } = school.pie;
  const required = courses * (school.jec ? settings.pieHoursJec : settings.pieHoursNoJec);
  const students = neet + neep;
  const people = staff.filter(p => p.schoolId === school.id && p.funding === 'PIE');
  const assigned = sum(people.filter(p => p.type === 'Docente'), p => p.contractHours);
  return { courses, neet, neep, required, requiredT: round(students ? required * neet / students : 0), requiredP: round(students ? required * neep / students : 0), assigned, gap: round(assigned - required), assistantHours: sum(people.filter(p => p.type === 'Asistente'), p => p.contractHours) };
}

export function computeIndicators(schools, staff, plans, settings = DEFAULT_SETTINGS) {
  const bySchool = new Map(schools.map(s => [s.id, s]));
  const people = staff.filter(p => bySchool.has(p.schoolId));
  const persons = people.filter(p => !p.vacant);
  const vacancies = people.filter(p => p.vacant);
  const teachers = persons.filter(p => p.type === 'Docente');
  const assistants = persons.filter(p => p.type === 'Asistente');
  const isVtf = p => bySchool.get(p.schoolId).modality === 'Jardín VTF';
  const group = (list, key, labels) => { const out = Object.fromEntries(labels.map(l => [l, { count: 0, hours: 0 }])); for (const p of list) { const k = key(p); out[k] ??= { count: 0, hours: 0 }; out[k].count++; out[k].hours += p.contractHours; } return out; };
  const summaries = schools.map(s => summarizeSchool(s, staff, plans));
  const classroom = teachers.filter(p => !isVtf(p));
  const types = { aula: 0, noLectivas: 0, directivas: 0, tecnicas: 0 };
  for (const p of classroom) { const b = hourBreakdown(p); for (const k in types) types[k] += b[k]; }
  for (const k in types) types[k] = round(types[k]);
  const educators = teachers.filter(p => isVtf(p) && p.role === 'Educadora de párvulos');
  const technicians = assistants.filter(p => isVtf(p) && /t[ée]cnica en p[áa]rvulos/i.test(p.role));
  const reduced = persons.filter(p => p.projection === 'Disminución');
  const increased = people.filter(p => p.projection === 'Aumento');
  const nonRenewed = persons.filter(p => p.projection === 'No renovación');
  const protectedPeople = persons.filter(p => /fuero/i.test(p.protection || ''));
  const lunchPeople = persons.filter(p => p.contractHours >= settings.lunchFromHours);
  const pies = schools.map(s => summarizePie(s, staff, settings)).filter(Boolean);
  const assistantHours = sum(assistants, p => p.contractHours);
  return {
    schools: schools.length,
    teachers: { count: teachers.length, hours: sum(teachers, p => p.contractHours) },
    assistants: { count: assistants.length, hours: assistantHours, fullTime: round(assistantHours / FULL_TIME) },
    educatorsVtf: { count: educators.length, hours: sum(educators, p => p.contractHours) },
    techniciansVtf: { count: technicians.length, hours: sum(technicians, p => p.contractHours) },
    reduction: { count: reduced.length, hours: round(sum(reduced, p => p.changeHours || 0)) },
    surplusPed: round(sum(summaries.filter(s => s.modality !== 'Jardín VTF' && s.gap > 0), s => s.gap)),
    increase: { count: increased.length, hours: round(sum(increased, p => p.changeHours || 0)) },
    nonRenewed: { count: nonRenewed.length, hours: sum(nonRenewed, p => p.contractHours) },
    vacancies: { count: vacancies.length, hours: sum(vacancies, p => p.contractHours), ped: round(sum(vacancies, p => p.assignedPed)) },
    hourTypes: types,
    vtfEducatorHours: sum(educators, p => p.contractHours),
    funding: group(teachers, p => p.funding, FUNDING),
    assistantFunding: group(assistants, p => p.funding, FUNDING),
    lunch: { count: lunchPeople.length, hours: round(lunchPeople.length * settings.lunchMinutesPerDay * 5 / 60) },
    fuero: { count: protectedPeople.length, hours: sum(protectedPeople, p => p.contractHours) },
    teacherFunctions: group(classroom, p => teacherFunction(p.role), TEACHER_FUNCTIONS),
    assistantCategories: group(assistants, p => assistantCategory(p.role), ASSISTANT_CATEGORIES),
    pie: { schools: pies.length, courses: sum(pies, p => p.courses), neet: sum(pies, p => p.neet), neep: sum(pies, p => p.neep), required: round(sum(pies, p => p.required)), requiredT: round(sum(pies, p => p.requiredT)), requiredP: round(sum(pies, p => p.requiredP)), assigned: sum(pies, p => p.assigned), assistantHours: sum(pies, p => p.assistantHours) },
    byModality: MODALITIES.map(m => { const list = persons.filter(p => bySchool.get(p.schoolId).modality === m); const t = sum(list.filter(p => p.type === 'Docente'), p => p.contractHours); const a = sum(list.filter(p => p.type === 'Asistente'), p => p.contractHours); return { modality: m, units: schools.filter(s => s.modality === m).length, people: list.length, teacherHours: t, assistantHours: a, total: t + a }; }).filter(m => m.units > 0),
    bySchool: summaries.map(s => { const list = persons.filter(p => p.schoolId === s.id); const t = sum(list.filter(p => p.type === 'Docente'), p => p.contractHours); const a = sum(list.filter(p => p.type === 'Asistente'), p => p.contractHours); return { id: s.id, name: s.name, modality: s.modality, commune: s.commune, teacherHours: t, assistantHours: a, total: t + a, vacantHours: sum(vacancies.filter(p => p.schoolId === s.id), p => p.contractHours), gap: s.modality === 'Jardín VTF' ? null : s.gap, status: s.status }; }),
  };
}

export function indicatorRows(ind) {
  const r = (Seccion, Indicador, Valor, Unidad) => ({ Seccion, Indicador, Valor, Unidad });
  return [
    r('Dotación', 'Horas cronológicas docentes vigentes', ind.teachers.hours, 'horas (60 min)'),
    r('Dotación', 'Docentes vigentes', ind.teachers.count, 'personas'),
    r('Dotación', 'Asistentes de la educación', ind.assistants.count, 'personas'),
    r('Dotación', 'Horas contratadas de asistentes', ind.assistants.hours, 'horas (60 min)'),
    r('Dotación', 'Jornadas de asistentes equivalentes a 44 h', ind.assistants.fullTime, 'jornadas'),
    r('VTF', 'Educadoras de párvulos en jardines VTF', ind.educatorsVtf.count, 'personas'),
    r('VTF', 'Técnicas en atención de párvulos VTF', ind.techniciansVtf.count, 'personas'),
    r('Ajustes', 'Horas a suprimir por optimización pedagógica', ind.reduction.hours, 'horas (60 min)'),
    r('Ajustes', 'Excedente pedagógico detectado en la cuadratura', ind.surplusPed, 'horas pedagógicas (45 min)'),
    r('Ajustes', 'Contratos no renovados al término del periodo', ind.nonRenewed.count, 'contratos'),
    r('Ajustes', 'Horas de contratos no renovados', ind.nonRenewed.hours, 'horas (60 min)'),
    r('Ajustes', 'Cargos vacantes', ind.vacancies.count, 'cargos'),
    r('Ajustes', 'Horas vacantes', ind.vacancies.hours, 'horas (60 min)'),
    r('Tipos de hora', 'Lectivas en aula', ind.hourTypes.aula, 'horas (60 min)'),
    r('Tipos de hora', 'Curriculares no lectivas', ind.hourTypes.noLectivas, 'horas (60 min)'),
    r('Tipos de hora', 'Horas directivas', ind.hourTypes.directivas, 'horas (60 min)'),
    r('Tipos de hora', 'Horas técnico-pedagógicas', ind.hourTypes.tecnicas, 'horas (60 min)'),
    ...FUNDING.map(f => r('Financiamiento docente', f === 'SEP' ? 'Horas SEP / PME' : f === 'PIE' ? 'Horas PIE' : f === 'VTF' ? 'Horas VTF' : 'Horas subvención general', ind.funding[f]?.hours ?? 0, 'horas (60 min)')),
    r('Jornada', 'Horas de colación (escenario)', ind.lunch.hours, 'horas (60 min)'),
    r('Jornada', 'Personas con fuero gremial', ind.fuero.count, 'personas'),
    r('Jornada', 'Horas de personas con fuero gremial', ind.fuero.hours, 'horas (60 min)'),
    ...TEACHER_FUNCTIONS.map(f => r('Docentes por función', f, ind.teacherFunctions[f]?.count ?? 0, 'personas')),
    ...Object.entries(ind.assistantCategories).map(([c, v]) => r('Asistentes por categoría', c, v.count, 'personas')),
    r('PIE', 'Estudiantes NEE transitorias', ind.pie.neet, 'estudiantes'),
    r('PIE', 'Estudiantes NEE permanentes', ind.pie.neep, 'estudiantes'),
    r('PIE', 'Horas de apoyo requeridas NEE transitorias', ind.pie.requiredT, 'horas (60 min)'),
    r('PIE', 'Horas de apoyo requeridas NEE permanentes', ind.pie.requiredP, 'horas (60 min)'),
    r('PIE', 'Horas docentes financiadas por PIE', ind.pie.assigned, 'horas (60 min)'),
    ...ind.byModality.map(m => r('Horas por modalidad', m.modality, m.total, 'horas (60 min)')),
  ];
}

const SPECIALTIES = ['Mecánica automotriz', 'Administración', 'Atención de párvulos', 'Electricidad', 'Gastronomía', 'Construcción', 'Agropecuaria', 'Turismo'];
const SUBJECTS = {
  'Escuela regular': [['Lenguaje', 8], ['Matemática', 8], ['Ciencias', 4], ['Historia', 4], ['Inglés', 4], ['Artes y tecnología', 4], ['Educación física', 4]],
  Microcentro: [['Lenguaje', 8], ['Matemática', 8], ['Ciencias', 4], ['Historia', 4], ['Inglés', 4], ['Artes y tecnología', 4], ['Educación física', 4]],
  Liceo: [['Lengua y literatura', 6], ['Matemática', 7], ['Ciencias', 6], ['Historia y ciencias sociales', 4], ['Inglés', 4], ['Educación física', 2], ['Artes', 2], ['Electivos de formación diferenciada', 6]],
  'Técnico profesional': [['Lengua y literatura', 6], ['Matemática', 6], ['Inglés', 3], ['Historia y ciencias sociales', 4], ['Ciencias', 4], ['Educación física', 2]],
  'Escuela especial': [['Aprendizaje integral', 22], ['Talleres de autonomía', 14]],
};

export function createSeed() {
  const regularNames = ['Lago Llanquihue', 'Horizonte del Sur', 'Los Arrayanes', 'Nueva Esperanza', 'Bosques de Frutillar', 'Valle del Maullín', 'Puertas del Lago', 'Los Canelos', 'Río Blanco', 'Mirador Austral', 'Los Alerces', 'Camino del Sur', 'Las Vertientes', 'Estrella del Lago', 'Los Coihues', 'Senderos del Bosque', 'Villa del Río', 'Piedra Azul', 'Los Avellanos', 'Raíces del Sur', 'El Manantial', 'Los Copihues', 'Luz del Horizonte', 'Entre Lagos', 'Loma Verde'];
  const communes = ['Frutillar', 'Llanquihue', 'Los Muermos', 'Fresia', 'Puerto Varas'];
  const schools = [];
  const add = (name, modality, index) => {
    const id = `EST-${String(schools.length + 1).padStart(3, '0')}`;
    const vtf = modality === 'Jardín VTF'; const micro = modality === 'Microcentro';
    const school = { id, name, modality, commune: communes[index % 5], enrollment: 200 + index * 17, lectiveRatio: index % 6 === 0 ? 0.6 : 0.65, jec: index % 5 !== 3, justification: '', projection: 'Mantención', ruralMembers: [], vtfLevels: null, pie: null };
    if (vtf) {
      school.vtfLevels = [{ level: 'Sala cuna', enrollment: 8 + (index % 3) * 4, educatorPerChildren: null, technicianPerChildren: null }, { level: 'Nivel medio', enrollment: 20 + index * 3, educatorPerChildren: null, technicianPerChildren: null }];
      school.enrollment = school.vtfLevels[0].enrollment + school.vtfLevels[1].enrollment;
    }
    if (micro) {
      school.ruralMembers = Array.from({ length: index === 3 ? 7 : 6 }, (_, i) => ({ name: `Escuela rural ficticia ${index * 6 + i + 1}`, enrollment: 9 + ((index * 6 + i) * 7) % 23, groups: 2 + (i + index) % 2 }));
      school.enrollment = school.ruralMembers.reduce((s, m) => s + m.enrollment, 0);
    }
    schools.push(school);
  };
  regularNames.forEach((n, i) => add(`Escuela ${n}`, 'Escuela regular', i));
  Array.from({length: 11}, (_, i) => add(`Liceo ${['Austral', 'del Lago', 'Los Volcanes', 'Valle Verde', 'Bicentenario del Sur', 'Horizonte', 'Nueva Ruta', 'Los Ríos', 'de Frutillar', 'Raíces', 'del Maullín'][i]}`, i < 4 ? 'Técnico profesional' : 'Liceo', i));
  add('Escuela especial Amanecer', 'Escuela especial', 0);
  add('Escuela especial Encuentro', 'Escuela especial', 1);
  Array.from({ length: 14 }, (_, i) => add(`Jardín ${['Rayito de Sol', 'Semillitas', 'Pequeños Exploradores', 'Arcoíris', 'Los Peumos', 'Luna Nueva', 'Rondas del Sur', 'Brotecitos', 'El Trébol', 'Mi Refugio', 'Estrellitas', 'El Nido', 'Manzanitas', 'La Ronda'][i]}`, 'Jardín VTF', i));
  Array.from({ length: 4 }, (_, i) => add(`Microcentro ${['Costa', 'Cordillera', 'Valle', 'Lago'][i]}`, 'Microcentro', i));

  const plans = [];
  schools.filter(s => s.modality !== 'Jardín VTF').forEach((s, i) => {
    const groups = s.modality === 'Microcentro' ? s.ruralMembers.reduce((n, m) => n + m.groups, 0) : s.modality === 'Escuela especial' ? 11 + i % 3 : 15 + i % 8;
    SUBJECTS[s.modality].forEach(([subject, hoursPerGroup], k) => plans.push({ id: `PLAN-${s.id}-${k}`, schoolId: s.id, subject, groups, hoursPerGroup, ...(s.modality === 'Técnico profesional' ? { track: 'Formación general' } : {}) }));
    if (s.modality === 'Técnico profesional') {
      [SPECIALTIES[(i * 2) % 8], SPECIALTIES[(i * 2 + 1) % 8]].forEach((specialty, k) => plans.push({ id: `PLAN-${s.id}-TP${k}`, schoolId: s.id, subject: `Módulos de ${specialty}`, groups: Math.ceil(groups / 4), hoursPerGroup: 24, track: 'Formación diferenciada TP', specialty }));
    }
    if (!['Escuela especial'].includes(s.modality)) {
      const courses = Math.round(groups * 0.6);
      s.pie = { courses, neet: courses * 4 + i % 3, neep: courses + i % 2 };
    }
  });

  const first = ['Ana', 'Matías', 'Camila', 'Tomás', 'Daniela', 'Felipe', 'Valentina', 'Gabriel', 'Javiera', 'Pablo', 'Sofía', 'Nicolás', 'María', 'Andrés', 'Isidora', 'Diego', 'Paula', 'Sebastián', 'Francisca', 'Vicente'];
  const last = ['Rojas', 'Soto', 'Vargas', 'Pérez', 'Contreras', 'González', 'Araya', 'Fuentes', 'Castro', 'Torres', 'Paredes', 'Navarro', 'Silva', 'Gómez', 'Muñoz', 'Vera', 'Reyes'];
  // 1.100 docentes y 1.100 asistentes repartidos según el tamaño de cada modalidad.
  const teacherSlots = { 'Jardín VTF': 4, 'Escuela especial': 18, Microcentro: 20, 'Técnico profesional': 26, Liceo: 24 };
  const assistantSlots = { 'Jardín VTF': 9, 'Escuela especial': 20, Microcentro: 14, 'Técnico profesional': 22, Liceo: 20 };
  const fill = (slots, total) => { const fixed = schools.reduce((n, s) => n + (slots[s.modality] ?? 0), 0); const regular = schools.filter(s => s.modality === 'Escuela regular'); const base = Math.floor((total - fixed) / regular.length); const extra = total - fixed - base * regular.length; return schools.map(s => slots[s.modality] ?? base + (regular.indexOf(s) < extra ? 1 : 0)); };
  const counts = { Docente: fill(teacherSlots, 1100), Asistente: fill(assistantSlots, 1100) };
  const staff = [];
  let i = 0;
  for (const type of ['Docente', 'Asistente']) schools.forEach((school, si) => {
    for (let k = 0; k < counts[type][si]; k++, i++) {
      const isTeacher = type === 'Docente';
      const vtf = school.modality === 'Jardín VTF';
      const contractHours = isTeacher ? [30, 36, 44, 44, 24][i % 5] : [44, 44, 30, 36, 22, 44][i % 6];
      const role = vtf ? isTeacher ? 'Educadora de párvulos' : k % 9 === 8 ? 'Auxiliar' : 'Técnica en párvulos' : isTeacher ? k % 13 === 0 ? 'Directiva' : k % 13 === 6 ? 'Técnico-pedagógica' : 'Docente de aula' : ['Asistente de aula', 'Auxiliar', 'Profesional PIE', 'Administrativo', 'Asistente de aula', 'Inspector de patio'][k % 6];
      const classroom = isTeacher && !vtf && role === 'Docente de aula';
      const assignedPed = classroom ? round(capacityPedagogical(contractHours, school.lectiveRatio) * [0.85, 0.9, 1, 0.95][si % 4]) : isTeacher && !vtf ? [0, 2, 4, 6][k % 4] : 0;
      const funding = vtf ? 'VTF' : role === 'Profesional PIE' ? 'PIE' : isTeacher && k % 8 === 3 ? 'PIE' : k % 5 === 1 ? 'SEP' : 'General';
      const contract = i % 6 === 0 ? 'Plazo fijo' : 'Indefinido';
      const protection = i % 71 === 0 ? 'Fuero gremial' : '';
      let projection = 'Mantención', changeHours = 0, justification = '';
      if (!protection && classroom && i % 37 === 5) { projection = 'Disminución'; changeHours = [2, 4, 6][i % 3]; justification = 'Escenario demo: menor matrícula proyectada en el nivel.'; }
      else if (!protection && contract === 'Plazo fijo' && i % 29 === 0) { projection = 'No renovación'; justification = 'Escenario demo: término de reemplazo al cierre del periodo.'; }
      else if (classroom && i % 41 === 3 && contractHours < 44) { projection = 'Aumento'; changeHours = Math.min(4, 44 - contractHours); justification = 'Escenario demo: nueva sección proyectada.'; }
      const person = { id: `DEMO-${String(i + 1).padStart(4, '0')}`, name: `${first[i % 20]} ${last[Math.floor(i / 20) % 17]} ${last[(Math.floor(i / 340) + 5) % 17]}`, schoolId: school.id, type, role, contractHours, assignedPed, funding, contract, protection, projection, changeHours, justification, vacant: false };
      if (isTeacher && school.modality === 'Técnico profesional') person.track = k % 5 < 2 ? 'Formación diferenciada TP' : 'Formación general';
      if (school.modality === 'Microcentro') person.ruralSchool = school.ruralMembers[k % school.ruralMembers.length].name;
      const media = ['Liceo', 'Técnico profesional'].includes(school.modality);
      Object.assign(person, { rut: formatRut(45000000 + i * 37 + 11), statute: vtf ? 'Código del Trabajo' : isTeacher ? 'Estatuto Docente' : 'Ley 21.109', startDate: `${2001 + (i * 7) % 25}-${String(i % 12 + 1).padStart(2, '0')}-01`, endDate: contract === 'Plazo fijo' ? (i % 4 ? '2026-12-31' : '2027-02-28') : '' });
      if (isTeacher && !vtf) Object.assign(person, { tramo: TRAMOS[(i * 3) % 5], hoursBasic: media ? 0 : contractHours, hoursMedia: media ? contractHours : 0 });
      staff.push(person);
    }
  });
  // Cargos vacantes por proveer en algunos establecimientos con déficit del escenario.
  schools.filter(s => !['Jardín VTF', 'Escuela especial'].includes(s.modality)).filter((_, k) => k % 3 === 1).forEach((s, k) => {
    const contractHours = k % 2 ? 30 : 44;
    staff.push({ id: `VAC-${String(k + 1).padStart(3, '0')}`, name: 'Cargo vacante por proveer', schoolId: s.id, type: 'Docente', role: 'Docente de aula', contractHours, assignedPed: capacityPedagogical(contractHours, s.lectiveRatio), funding: 'General', contract: 'Contrata', protection: '', projection: 'Aumento', changeHours: contractHours, justification: 'Escenario demo: cargo para cubrir déficit de la cuadratura.', vacant: true, ...(s.modality === 'Técnico profesional' ? { track: 'Formación general' } : {}), ...(s.modality === 'Microcentro' ? { ruralSchool: s.ruralMembers[0].name } : {}) });
  });
  const events = [{ id: 'seed', date: new Date().toISOString(), action: 'Escenario de demostración creado', detail: '52 establecimientos, 4 microcentros, 2.200 personas ficticias y cargos vacantes de ejemplo. Sin datos del SLEP.', author: 'CMEstudios · Demo' }];
  return { version: STATE_VERSION, settings: { ...DEFAULT_SETTINGS }, schools, staff, plans, events };
}

export function serializeCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = v => `"${String(v ?? '').replaceAll('"', '""')}"`;
  return '﻿' + [headers.map(escape).join(';'), ...rows.map(r => headers.map(h => escape(r[h])).join(';'))].join('\r\n');
}

export function parseCSV(text) {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/)[0];
  const delimiter = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
  const rows = []; let row = []; let field = ''; let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (c === '"') {
      if (quoted && clean[i + 1] === '"') { field += '"'; i++; }
      else if (quoted) quoted = false;
      else if (field.trim() === '') quoted = true;
      else throw new Error('Comillas inesperadas en el CSV.');
    } else if (c === delimiter && !quoted) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && clean[i + 1] === '\n') i++;
      row.push(field); if (row.some(v => v.trim())) rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (quoted) throw new Error('El CSV contiene comillas sin cerrar.');
  row.push(field); if (row.some(v => v.trim())) rows.push(row);
  if (!rows.length) throw new Error('El archivo está vacío.');
  const headers = rows.shift().map(h => h.trim().toLowerCase());
  if (new Set(headers).size !== headers.length) throw new Error('Hay columnas duplicadas.');
  return rows.map((r, i) => {
    if (r.length !== headers.length) throw new Error(`Fila ${i + 2}: cantidad de columnas incorrecta.`);
    return Object.fromEntries(headers.map((h, j) => [h, r[j].trim()]));
  });
}

export const CSV_HEADERS = ['id', 'nombre', 'establecimiento_id', 'tipo', 'cargo', 'horas_contrato', 'horas_lectivas_pedagogicas', 'financiamiento', 'contrato'];
export const CSV_OPTIONAL = ['rut', 'estatuto', 'tramo', 'fecha_ingreso', 'fecha_termino', 'horas_basica', 'horas_media', 'fuero', 'formacion_tp', 'escuela_rural'];
const TRACK_ALIASES = { general: 'Formación general', 'formación general': 'Formación general', 'formacion general': 'Formación general', diferenciada: 'Formación diferenciada TP', 'formación diferenciada tp': 'Formación diferenciada TP', 'formacion diferenciada tp': 'Formación diferenciada TP' };
export function validateImport(rows, state) {
  const errors = []; const people = []; const seen = new Set(); const seenRut = new Set();
  if (rows.length === 0) return { errors: ['El archivo no contiene personas.'], people: [] };
  for (const h of CSV_HEADERS) if (!(h in rows[0])) errors.push(`Falta la columna ${h}.`);
  if (errors.length) return { errors, people };
  const number = v => v === '' ? NaN : Number(v.replace(',', '.'));
  rows.forEach((r, i) => {
    const line = i + 2; const school = state.schools.find(s => s.id === r.establecimiento_id);
    const contractHours = number(r.horas_contrato); const assignedPed = number(r.horas_lectivas_pedagogicas);
    if (!r.id || !r.nombre || !r.cargo) errors.push(`Fila ${line}: ID, nombre y cargo son obligatorios.`);
    if (seen.has(r.id)) errors.push(`Fila ${line}: ID ${r.id} duplicado dentro del archivo.`);
    seen.add(r.id);
    if (!school) errors.push(`Fila ${line}: establecimiento ${r.establecimiento_id} desconocido.`);
    if (!['Docente', 'Asistente'].includes(r.tipo)) errors.push(`Fila ${line}: tipo debe ser Docente o Asistente.`);
    if (!Number.isFinite(contractHours) || contractHours <= 0 || contractHours > 44) errors.push(`Fila ${line}: horas de contrato deben estar entre 0 y 44 (mayor que 0).`);
    if (!Number.isFinite(assignedPed) || assignedPed < 0) errors.push(`Fila ${line}: horas lectivas deben ser un número mayor o igual a 0.`);
    if (r.tipo === 'Asistente' && assignedPed !== 0) errors.push(`Fila ${line}: un asistente no tiene horas docentes lectivas en este modelo.`);
    if (!FUNDING.includes(r.financiamiento)) errors.push(`Fila ${line}: financiamiento debe ser General, SEP, PIE o VTF.`);
    if (!CONTRACTS.includes(r.contrato)) errors.push(`Fila ${line}: tipo de contrato no reconocido.`);
    const fuero = (r.fuero ?? '').trim().toLowerCase();
    if (fuero && !['sí', 'si', 'no'].includes(fuero)) errors.push(`Fila ${line}: fuero debe ser Sí o No.`);
    const trackText = (r.formacion_tp ?? '').trim();
    const track = trackText ? TRACK_ALIASES[trackText.toLowerCase()] : undefined;
    if (trackText && !track) errors.push(`Fila ${line}: formación TP debe ser General o Diferenciada.`);
    if (trackText && school && school.modality !== 'Técnico profesional') errors.push(`Fila ${line}: la formación TP solo aplica a liceos técnico-profesionales.`);
    const rural = (r.escuela_rural ?? '').trim();
    if (rural && school && school.modality !== 'Microcentro') errors.push(`Fila ${line}: escuela rural solo aplica a microcentros.`);
    else if (rural && school && !school.ruralMembers.some(m => m.name === rural)) errors.push(`Fila ${line}: la escuela rural "${rural}" no pertenece a ${school.name}.`);
    const rutText = (r.rut ?? '').trim(); const rut = rutText ? parseRut(rutText) : null;
    if (rutText && !rut) errors.push(`Fila ${line}: el RUT ${rutText} no es válido (revisa el dígito verificador).`);
    if (rut && seenRut.has(rut)) errors.push(`Fila ${line}: RUT ${rut} repetido dentro del archivo.`);
    if (rut) seenRut.add(rut);
    const startText = (r.fecha_ingreso ?? '').trim(), endText = (r.fecha_termino ?? '').trim();
    const startDate = startText ? parseDate(startText) : null, endDate = endText ? parseDate(endText) : null;
    if (startText && !startDate) errors.push(`Fila ${line}: fecha de ingreso inválida (usa AAAA-MM-DD o DD-MM-AAAA).`);
    if (endText && !endDate) errors.push(`Fila ${line}: fecha de término inválida (usa AAAA-MM-DD o DD-MM-AAAA).`);
    if (startDate && endDate && endDate < startDate) errors.push(`Fila ${line}: la fecha de término es anterior a la de ingreso.`);
    const statute = (r.estatuto ?? '').trim();
    if (statute && !STATUTES.includes(statute)) errors.push(`Fila ${line}: estatuto debe ser ${STATUTES.join(', ')}.`);
    const tramo = (r.tramo ?? '').trim();
    if (tramo && !TRAMOS.includes(tramo)) errors.push(`Fila ${line}: tramo debe ser ${TRAMOS.join(', ')}.`);
    else if (tramo && r.tipo === 'Asistente') errors.push(`Fila ${line}: el tramo de desarrollo profesional solo aplica a docentes.`);
    const basicText = (r.horas_basica ?? '').trim(), mediaText = (r.horas_media ?? '').trim();
    const hoursBasic = basicText ? number(basicText) : undefined, hoursMedia = mediaText ? number(mediaText) : undefined;
    if ((basicText && !(hoursBasic >= 0)) || (mediaText && !(hoursMedia >= 0))) errors.push(`Fila ${line}: horas básica y media deben ser números mayores o iguales a 0.`);
    else if ((basicText || mediaText) && Number.isFinite(contractHours) && Math.abs((hoursBasic ?? 0) + (hoursMedia ?? 0) - contractHours) > 0.01) errors.push(`Fila ${line}: horas básica + media (${(hoursBasic ?? 0) + (hoursMedia ?? 0)}) deben sumar las horas de contrato (${contractHours}).`);
    const old = state.staff.find(p => p.id === r.id);
    const sameSchool = old?.schoolId === r.establecimiento_id;
    // Columna presente en el archivo: manda su valor, aunque venga vacío. Columna ausente: se conserva lo anterior.
    const pick = (key, value, previous) => key in r ? value : previous;
    people.push({ ...old, id: r.id, name: r.nombre, schoolId: r.establecimiento_id, type: r.tipo, role: r.cargo, contractHours, assignedPed, funding: r.financiamiento, contract: r.contrato, protection: fuero ? (fuero === 'no' ? '' : 'Fuero gremial') : old?.protection || '', projection: old?.projection || 'Mantención', changeHours: old?.changeHours || 0, justification: old?.justification || '', vacant: false, track: track ?? (sameSchool ? old?.track : undefined), ruralSchool: rural || (sameSchool ? old?.ruralSchool : undefined), rut: pick('rut', rut ?? undefined, old?.rut), statute: pick('estatuto', statute || undefined, old?.statute), tramo: pick('tramo', tramo || undefined, old?.tramo), startDate: pick('fecha_ingreso', startDate ?? undefined, old?.startDate), endDate: pick('fecha_termino', endDate ?? '', old?.endDate), hoursBasic: pick('horas_basica', hoursBasic, old?.hoursBasic), hoursMedia: pick('horas_media', hoursMedia, old?.hoursMedia) });
  });
  return { errors, people };
}
export function applyImport(state, people) {
  const byId = new Map(state.staff.map(p => [p.id, p]));
  people.forEach(p => byId.set(p.id, p));
  return { ...state, staff: [...byId.values()] };
}
// Archivo de ejemplo de carga masiva: actualiza personas existentes por ID e incorpora personas nuevas
// en todas las modalidades, con las columnas opcionales de TP, microcentro y fuero.
export function sampleImport() {
  const seed = createSeed();
  const rows = [];
  const row = (p, changes = {}) => ({ id: p.id, rut: p.rut ?? '', nombre: p.name, establecimiento_id: p.schoolId, tipo: p.type, cargo: p.role, estatuto: p.statute ?? '', tramo: p.tramo ?? '', contrato: p.contract, fecha_ingreso: p.startDate ?? '', fecha_termino: p.endDate ?? '', horas_contrato: p.contractHours, horas_basica: p.hoursBasic ?? '', horas_media: p.hoursMedia ?? '', horas_lectivas_pedagogicas: p.assignedPed, financiamiento: p.funding, fuero: p.protection ? 'Sí' : 'No', formacion_tp: p.track === 'Formación diferenciada TP' ? 'Diferenciada' : p.track ? 'General' : '', escuela_rural: p.ruralSchool || '', ...changes });
  seed.staff.filter(p => !p.vacant).filter((_, i) => i % 12 === 0).forEach((p, k) => {
    const grow = p.type === 'Docente' && k % 9 === 0 && p.contractHours < 44;
    const h = Math.min(44, p.contractHours + 2);
    rows.push(row(p, grow ? { horas_contrato: h, ...(p.hoursBasic === undefined ? {} : p.hoursMedia ? { horas_media: h } : { horas_basica: h }) } : {}));
  });
  const names = ['Elena Ejemplo Demo', 'Jorge Ejemplo Demo', 'Marta Prueba Demo', 'Luis Muestra Demo', 'Carla Ficticia Demo', 'Raúl Ensayo Demo'];
  for (let k = 0; k < 60; k++) {
    const s = seed.schools[(k * 7) % seed.schools.length];
    const vtf = s.modality === 'Jardín VTF'; const teacher = k % 3 !== 2;
    const contractHours = [30, 36, 44, 24][k % 4];
    const assignedPed = teacher && !vtf ? round(capacityPedagogical(contractHours, s.lectiveRatio) * 0.9) : 0;
    const cargo = vtf ? teacher ? 'Educadora de párvulos' : 'Técnica en párvulos' : teacher ? 'Docente de aula' : ['Asistente de aula', 'Administrativo', 'Auxiliar', 'Profesional PIE'][k % 4];
    const media = ['Liceo', 'Técnico profesional'].includes(s.modality); const docente = teacher && !vtf;
    rows.push({ id: `IMPORT-${String(k + 1).padStart(4, '0')}`, rut: formatRut(46000000 + k * 53 + 7), nombre: names[k % names.length].replace('Demo', `Demo ${k + 1}`), establecimiento_id: s.id, tipo: teacher ? 'Docente' : 'Asistente', cargo, estatuto: vtf ? 'Código del Trabajo' : teacher ? 'Estatuto Docente' : 'Ley 21.109', tramo: docente ? TRAMOS[k % 3] : '', contrato: k % 4 === 0 ? 'Plazo fijo' : 'Contrata', fecha_ingreso: '2027-03-01', fecha_termino: k % 4 === 0 ? '2027-12-31' : '', horas_contrato: contractHours, horas_basica: docente ? (media ? 0 : contractHours) : '', horas_media: docente ? (media ? contractHours : 0) : '', horas_lectivas_pedagogicas: assignedPed, financiamiento: vtf ? 'VTF' : cargo === 'Profesional PIE' ? 'PIE' : k % 5 === 0 ? 'SEP' : 'General', fuero: 'No', formacion_tp: teacher && s.modality === 'Técnico profesional' ? k % 2 ? 'Diferenciada' : 'General' : '', escuela_rural: s.modality === 'Microcentro' ? s.ruralMembers[k % s.ruralMembers.length].name : '' });
  }
  return serializeCSV(rows);
}

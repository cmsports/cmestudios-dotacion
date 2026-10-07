export const MODALITIES = ['Escuela regular', 'Liceo', 'Técnico profesional', 'Escuela especial', 'Jardín VTF', 'Microcentro'];
export const STORAGE_KEY = 'cmestudios.dotacion.demo.v1';
export const fmt = (v) => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 }).format(v);
export const round = (v) => Math.round(v * 100) / 100;

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
export function summarizeSchool(school, staff, plans) {
  const people = staff.filter(p => p.schoolId === school.id);
  const teachers = people.filter(p => p.type === 'Docente');
  const assistants = people.filter(p => p.type === 'Asistente');
  const required = plans.filter(p => p.schoolId === school.id).reduce((s, p) => s + p.groups * p.hoursPerGroup, 0);
  const assigned = teachers.reduce((s, p) => s + p.assignedPed, 0);
  const capacity = teachers.reduce((s, p) => s + capacityPedagogical(p.contractHours, school.lectiveRatio), 0);
  const gap = round(assigned - required);
  const overloads = teachers.filter(p => teacherCheck(p, school).excess > 0.01).length;
  const educators = teachers.filter(p => p.role === 'Educadora de párvulos').length;
  const technicians = assistants.filter(p => p.role === 'Técnica en párvulos').length;
  const vtf = school.modality === 'Jardín VTF';
  const vtfConfigured = vtf && Number.isInteger(school.educatorPerChildren) && Number.isInteger(school.technicianPerChildren) && school.educatorPerChildren > 0 && school.technicianPerChildren > 0;
  const needEducators = vtfConfigured ? Math.ceil(school.enrollment / school.educatorPerChildren) : null;
  const needTechnicians = vtfConfigured ? Math.ceil(school.enrollment / school.technicianPerChildren) : null;
  const deficit = vtf ? vtfConfigured && (educators < needEducators || technicians < needTechnicians) : gap < -0.01;
  const status = vtf && !vtfConfigured ? 'Por validar' : overloads ? 'Sobrecarga' : deficit ? 'Déficit' : !vtf && gap > 0.01 ? 'Excedente' : 'Equilibrado';
  return { ...school, teachers: teachers.length, assistants: assistants.length, people: people.length, required, assigned: round(assigned), capacity: round(capacity), gap, overloads, status, educators, technicians, needEducators, needTechnicians, vtfConfigured, contractHours: people.reduce((s, p) => s + p.contractHours, 0) };
}

export function createSeed() {
  const regularNames = ['Lago Llanquihue', 'Horizonte del Sur', 'Los Arrayanes', 'Nueva Esperanza', 'Bosques de Frutillar', 'Valle del Maullín', 'Puertas del Lago', 'Los Canelos', 'Río Blanco', 'Mirador Austral', 'Los Alerces', 'Camino del Sur', 'Las Vertientes', 'Estrella del Lago', 'Los Coihues', 'Senderos del Bosque', 'Villa del Río', 'Piedra Azul', 'Los Avellanos', 'Raíces del Sur', 'El Manantial', 'Los Copihues', 'Luz del Horizonte', 'Entre Lagos', 'Loma Verde'];
  const communes = ['Frutillar', 'Llanquihue', 'Los Muermos', 'Fresia', 'Puerto Varas'];
  const schools = [];
  const add = (name, modality, index) => {
    const id = `EST-${String(schools.length + 1).padStart(3, '0')}`;
    schools.push({ id, name, modality, commune: communes[index % 5], enrollment: modality === 'Jardín VTF' ? 28 + index * 3 : 200 + index * 17, lectiveRatio: index % 6 === 0 ? 0.6 : 0.65, educatorPerChildren: null, technicianPerChildren: null, justification: '', projection: 'Mantención', ruralMembers: modality === 'Microcentro' ? Array.from({ length: index === 3 ? 7 : 6 }, (_, i) => `Escuela rural ficticia ${index * 6 + i + 1}`) : [] });
  };
  regularNames.forEach((n, i) => add(`Escuela ${n}`, 'Escuela regular', i));
  Array.from({length: 11}, (_, i) => add(`Liceo ${['Austral', 'del Lago', 'Los Volcanes', 'Valle Verde', 'Bicentenario del Sur', 'Horizonte', 'Nueva Ruta', 'Los Ríos', 'de Frutillar', 'Raíces', 'del Maullín'][i]}`, i < 4 ? 'Técnico profesional' : 'Liceo', i));
  add('Escuela especial Amanecer', 'Escuela especial', 0);
  add('Escuela especial Encuentro', 'Escuela especial', 1);
  Array.from({ length: 14 }, (_, i) => add(`Jardín ${['Rayito de Sol', 'Semillitas', 'Pequeños Exploradores', 'Arcoíris', 'Los Peumos', 'Luna Nueva', 'Rondas del Sur', 'Brotecitos', 'El Trébol', 'Mi Refugio', 'Estrellitas', 'El Nido', 'Manzanitas', 'La Ronda'][i]}`, 'Jardín VTF', i));
  Array.from({ length: 4 }, (_, i) => add(`Microcentro ${['Costa', 'Cordillera', 'Valle', 'Lago'][i]}`, 'Microcentro', i));
  const first = ['Ana', 'Matías', 'Camila', 'Tomás', 'Daniela', 'Felipe', 'Valentina', 'Gabriel', 'Javiera', 'Pablo', 'Sofía', 'Nicolás', 'María', 'Andrés', 'Isidora', 'Diego', 'Paula', 'Sebastián', 'Francisca', 'Vicente'];
  const last = ['Rojas', 'Soto', 'Vargas', 'Pérez', 'Contreras', 'González', 'Araya', 'Fuentes', 'Castro', 'Torres', 'Paredes', 'Navarro', 'Silva', 'Gómez', 'Muñoz', 'Vera', 'Reyes'];
  const staff = [];
  for (let i = 0; i < 2200; i++) {
    const school = schools[i % schools.length];
    const isTeacher = i < 1100;
    const contractHours = [30, 36, 44, 44, 24][i % 5];
    const assignedPed = isTeacher && school.modality !== 'Jardín VTF' ? round(capacityPedagogical(contractHours, school.lectiveRatio) * [0.85, 0.9, 1, 0.95][i % 4]) : 0;
    const role = school.modality === 'Jardín VTF' ? isTeacher ? 'Educadora de párvulos' : 'Técnica en párvulos' : isTeacher ? i % 17 === 0 ? 'Directiva' : i % 13 === 0 ? 'Técnico-pedagógica' : 'Docente de aula' : ['Profesional PIE', 'Asistente de aula', 'Administrativo', 'Auxiliar'][i % 4];
    staff.push({ id: `DEMO-${String(i + 1).padStart(4, '0')}`, name: `${first[i % 20]} ${last[Math.floor(i / 20) % 17]} ${last[(Math.floor(i / 340) + 5) % 17]}`, schoolId: school.id, type: isTeacher ? 'Docente' : 'Asistente', role, contractHours, assignedPed, funding: i % 7 === 0 ? 'PIE' : i % 5 === 0 ? 'SEP' : 'General', contract: i % 6 === 0 ? 'Plazo fijo' : 'Indefinido', protection: i % 71 === 0 ? 'Fuero gremial' : '', projection: 'Mantención', justification: '' });
  }
  const plans = [];
  schools.filter(s => s.modality !== 'Jardín VTF').forEach((s, i) => {
    const groups = s.modality === 'Microcentro' ? 12 + i % 5 : 12 + i % 12;
    const subjects = s.modality === 'Técnico profesional' ? [['Formación general', 20], ['Especialidad TP', 16]] : s.modality === 'Escuela especial' ? [['Aprendizaje integral', 22], ['Talleres de autonomía', 14]] : [['Lenguaje', 8], ['Matemática', 8], ['Ciencias', 4], ['Historia', 4], ['Inglés', 4], ['Artes y tecnología', 4], ['Educación física', 4]];
    subjects.forEach(([subject, hoursPerGroup], k) => plans.push({ id: `PLAN-${s.id}-${k}`, schoolId: s.id, subject, groups, hoursPerGroup }));
  });
  const events = [{ id: 'seed', date: new Date().toISOString(), action: 'Escenario de demostración creado', detail: '52 establecimientos, 4 microcentros y 2.200 personas ficticias. Sin datos del SLEP.', author: 'CMEstudios · Demo' }];
  return { version: 1, schools, staff, plans, events };
}

export function serializeCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = v => `"${String(v ?? '').replaceAll('"', '""')}"`;
  return '\uFEFF' + [headers.map(escape).join(';'), ...rows.map(r => headers.map(h => escape(r[h])).join(';'))].join('\r\n');
}

export function parseCSV(text) {
  const clean = text.replace(/^\uFEFF/, '');
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
export function validateImport(rows, state) {
  const errors = []; const people = []; const seen = new Set();
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
    if (!['General', 'SEP', 'PIE'].includes(r.financiamiento)) errors.push(`Fila ${line}: financiamiento debe ser General, SEP o PIE.`);
    if (!['Indefinido', 'Plazo fijo', 'Titular', 'Contrata'].includes(r.contrato)) errors.push(`Fila ${line}: tipo de contrato no reconocido.`);
    const old = state.staff.find(p => p.id === r.id);
    people.push({ ...old, id: r.id, name: r.nombre, schoolId: r.establecimiento_id, type: r.tipo, role: r.cargo, contractHours, assignedPed, funding: r.financiamiento, contract: r.contrato, protection: old?.protection || '', projection: old?.projection || 'Mantención', justification: old?.justification || '' });
  });
  return { errors, people };
}
export function applyImport(state, people) {
  const byId = new Map(state.staff.map(p => [p.id, p]));
  people.forEach(p => byId.set(p.id, p));
  return { ...state, staff: [...byId.values()] };
}
export function sampleImport() {
  return serializeCSV([
    { id: 'DEMO-0001', nombre: 'Ana Rojas Vera', establecimiento_id: 'EST-001', tipo: 'Docente', cargo: 'Docente de aula', horas_contrato: 44, horas_lectivas_pedagogicas: 36, financiamiento: 'General', contrato: 'Indefinido' },
    { id: 'IMPORT-0001', nombre: 'Elena Ejemplo Demo', establecimiento_id: 'EST-002', tipo: 'Docente', cargo: 'Docente de aula', horas_contrato: 30, horas_lectivas_pedagogicas: 26, financiamiento: 'SEP', contrato: 'Plazo fijo' },
    { id: 'IMPORT-0002', nombre: 'Jorge Ejemplo Demo', establecimiento_id: 'EST-039', tipo: 'Asistente', cargo: 'Técnica en párvulos', horas_contrato: 44, horas_lectivas_pedagogicas: 0, financiamiento: 'General', contrato: 'Indefinido' }
  ]);
}

// Lectura del resultado del PPL para las personas: resumen general, horas por categoría de cada
// establecimiento, eficiencia de la carga de cada docente y sugerencias concretas.
import { round, fmt, summarizeSchool } from './core.mjs';

export const EFFICIENCY = ['Eficiente', 'Aceptable', 'Ineficiente', 'Sin clases', 'No disponible'];
const share = (a, b) => b > 0 ? a / b : null;
const pct = v => v === null ? '—' : `${Math.round(v * 100)}%`;
function efficiencyOf(util, available) {
  if (!(available > 0)) return 'No disponible';
  if (!util) return 'Sin clases';
  return util >= 0.9 ? 'Eficiente' : util >= 0.7 ? 'Aceptable' : 'Ineficiente';
}

export function buildReport(state, D, R) {
  const T = D.T; const schoolName = id => D.E[id]?.name ?? state.schools.find(s => s.id === id)?.name ?? id;
  const gById = Object.fromEntries(D.groups.map(g => [g.id, g]));
  const active = (i, t) => !(i.ret != null && t >= i.ret) && (i.lic[t] ?? 0) < 1;
  const avg = list => list.length ? list.reduce((n, x) => n + x, 0) / list.length : 0;

  // ---- Docentes: carga antes (distribución vigente) y después (propuesta) ----
  const before = {}; for (const [key, n] of Object.entries(D.q0)) { const [d, g] = key.split('|'); const grp = gById[g]; (before[d] ??= { usado: 0, lectivas: 0, cursos: 0, asignaturas: new Set() }); before[d].usado += n * grp.h * grp.kap; before[d].lectivas += n * grp.h; before[d].cursos += n; before[d].asignaturas.add(grp.subject); }
  const teachers = R.people.map(p => {
    const i = D.doc[p.id]; const base = before[p.id] ?? { usado: 0, lectivas: 0, cursos: 0, asignaturas: new Set() };
    const availBefore = (i.H.GEN ?? 0) - i.Hnl;
    const utilBefore = i.H.GEN ? share(base.usado, availBefore) : null;
    const periods = T.filter(t => active(i, t) && (p.renueva !== false || i.fin == null || t < i.fin));
    const availAfter = avg(periods.map(t => Math.max(0, p.per[t].contrato - (i.H.PIE ? 0 : i.Hnl)) * (1 - (i.lic[t] ?? 0))));
    const usedAfter = avg(periods.map(t => p.per[t].usado));
    const utilAfter = i.H.GEN ? share(usedAfter, availAfter) : null;
    const extension = Math.max(...T.map(t => p.per[t].extension));
    const otherSchool = p.migra[0] ?? null;
    // El traslado se mide en el periodo en que ocurre (puede ser solo agosto–diciembre) y distingue clases de apoyo PIE.
    const moveT = otherSchool ? [...T].sort((a, b) => ((p.per[b].porColegio[otherSchool] ?? 0) + (p.per[b].piePorColegio[otherSchool] ?? 0)) - ((p.per[a].porColegio[otherSchool] ?? 0) + (p.per[a].piePorColegio[otherSchool] ?? 0)))[0] : null;
    const t0 = moveT ?? periods[0] ?? T[0];
    const destPie = otherSchool ? round(p.per[t0].piePorColegio[otherSchool] ?? 0) : 0; const originPie = round(p.per[t0].piePorColegio[p.origin] ?? 0);
    const destHours = otherSchool ? round(p.per[t0].porColegio[otherSchool] ?? 0) : 0; const originHours = round(p.per[t0].porColegio[p.origin] ?? 0);
    const label = i.H.PIE ? 'Apoyo PIE' : efficiencyOf(utilAfter, availAfter);
    const labelBefore = i.H.PIE ? 'Apoyo PIE' : efficiencyOf(utilBefore, availBefore);
    const suggestions = [];
    if (i.ret != null) suggestions.push(`Se retira en ${T.find(t => t === i.ret) === 2 ? 'agosto' : 'marzo'}: sus cursos quedan reasignados desde ese periodo.`);
    if (Object.keys(i.lic).length) suggestions.push(`Con licencia ${Object.entries(i.lic).map(([t, f]) => `${f >= 1 ? 'todo' : `${Math.round(f * 100)}% de`} ${t === '1' ? 'marzo–julio' : 'agosto–diciembre'}`).join(' y ')}: el plan cubre esos cursos con otros docentes.`);
    if (p.renueva === true) suggestions.push(`Renovar la contrata: cubre ${p.per[t0].cursos} cursos.`);
    if (p.renueva === false) suggestions.push(`No renovar la contrata: sus ${fmt(p.contrato)} h no son necesarias para cubrir el plan.`);
    if (otherSchool && destHours === 0) suggestions.push(`Dar ${fmt(destPie)} h de apoyo PIE en ${schoolName(otherSchool)}${t0 === 2 ? ' desde agosto' : ''}, sin dejar su colegio.`);
    else if (otherSchool) suggestions.push(originHours + originPie > 0 ? `Hacer ${fmt(destHours)} h lectivas en ${schoolName(otherSchool)} (${p.per[t0].asignaturas.join(', ')}) y mantener ${fmt(originHours)} h en su colegio.` : `Cambiarse a ${schoolName(otherSchool)} con ${fmt(destHours)} h lectivas (${p.per[t0].asignaturas.join(', ')}).`);
    if (extension > 0) suggestions.push(`Extender la jornada en ${fmt(extension)} h (de ${fmt(p.contrato)} a ${fmt(p.contrato + extension)} h) para cubrir cursos sin docente.`);
    if (p.supresion > 0) suggestions.push(`Suprimir ${fmt(p.supresion)} h de contrato que quedan sin clases.`);
    if (!suggestions.length && label === 'Ineficiente') suggestions.push(`Usa ${pct(utilAfter)} de su capacidad lectiva y su contrato está protegido (${i.fuero ? 'fuero' : i.tipo}): revisar otras tareas o redistribución manual.`);
    if (!suggestions.length && label === 'Sin clases') suggestions.push('Tiene horas pagadas sin clases asignadas: revisar funciones o redistribución.');
    if (!suggestions.length) suggestions.push('Carga adecuada: mantener.');
    return { id: p.id, name: p.name, rut: p.rut, origin: p.origin, originName: schoolName(p.origin), contract: p.contrato, contractAfter: round(avg(periods.map(t => p.per[t].contrato))) || 0, tipo: i.tipo, fuero: i.fuero, lectivasBefore: round(base.lectivas), lectivasAfter: round(avg(periods.map(t => p.per[t].lectivas))), cursosBefore: base.cursos, cursosAfter: p.per[t0].cursos, subjects: p.per[t0].asignaturas, utilBefore, utilAfter, labelBefore, label, renueva: p.renueva, extension, supresion: p.supresion, otherSchool, otherSchoolName: otherSchool ? schoolName(otherSchool) : null, destHours, originHours, destPie, originPie, movePeriod: t0, contractAtMove: round(p.per[t0].contrato), pie: !!i.H.PIE, suggestions, changed: !!(otherSchool || extension || p.supresion || p.renueva === false) };
  });
  const byId = new Map(teachers.map(t => [t.id, t]));

  // ---- Traslados sugeridos (docentes que pasan a hacer clases en otro colegio) ----
  const moves = teachers.filter(t => t.otherSchool).map(t => ({ id: t.id, name: t.name, rut: t.rut, from: t.origin, fromName: t.originName, to: t.otherSchool, toName: t.otherSchoolName, destHours: t.destHours, originHours: t.originHours, destPie: t.destPie, period: t.movePeriod, contract: t.contract, contractAtMove: t.contractAtMove, subjects: t.subjects, kind: t.destHours === 0 ? 'Apoyo PIE' : t.originHours + t.originPie > 0 ? 'Comparte jornada' : 'Cambio completo', applicable: t.destHours > 0 }));

  // ---- Establecimientos: horas por categoría antes y después ----
  const schools = Object.keys(D.E).map(e => {
    const s = state.schools.find(x => x.id === e); const sum = summarizeSchool(s, state.staff, state.plans);
    const groups = D.groups.filter(g => g.e === e);
    const required = round(groups.reduce((n, g) => n + g.n * g.h, 0));
    const baseUncovered = round(groups.reduce((n, g) => n + (g.n - Object.entries(D.q0).filter(([k]) => k.endsWith(`|${g.id}`)).reduce((m, [, c]) => m + c, 0)) * g.h, 0));
    const per = Object.fromEntries(T.map(t => {
      const rows = R.plan[`${e}|${t}`] ?? [];
      const own = round(rows.filter(r => r.teacher && r.origin === e).reduce((n, r) => n + r.hours, 0));
      const visitors = round(rows.filter(r => r.teacher && r.origin !== e).reduce((n, r) => n + r.hours, 0));
      const vacant = round(rows.filter(r => !r.teacher).reduce((n, r) => n + r.hours, 0));
      const staffHere = R.people.filter(p => p.origin === e);
      const pieReq = D.RPIE[e] ?? 0; const piePend = R.piePend.filter(x => x.e === e && x.t === t).reduce((n, x) => n + x.horas, 0);
      return [t, {
        requeridas: required, propias: own, llegadas: visitors, vacantes: vacant,
        contratoAntes: round(staffHere.reduce((n, p) => n + p.contrato, 0)), contratoDespues: round(staffHere.reduce((n, p) => n + p.per[t].contrato, 0)),
        directivas: round(Object.values(D.doc).filter(i => i.o === e).reduce((n, i) => n + i.Hnl, 0)),
        pieRequeridas: round(pieReq), pieCubiertas: round(pieReq - piePend), piePendientes: round(piePend),
        extensiones: round(staffHere.reduce((n, p) => n + p.per[t].extension, 0)),
      }];
    }));
    const suppressions = round(R.people.filter(p => p.origin === e).reduce((n, p) => n + p.supresion, 0));
    const incoming = moves.filter(m => m.to === e); const outgoing = moves.filter(m => m.from === e);
    const vacByPeriod = R.vacantes.filter(v => v.e === e);
    const suggestions = [];
    for (const t of T) { const list = vacByPeriod.filter(v => v.t === t); if (list.length) suggestions.push(`${t === 1 ? 'Marzo–julio' : 'Agosto–diciembre'}: contratar para ${list.map(v => `${v.subject} (${v.cursos} curso${v.cursos > 1 ? 's' : ''}, ${fmt(v.horas)} h)`).join(', ')}.`); }
    for (const m of incoming) suggestions.push(`Recibir a ${m.name} desde ${m.fromName}: ${fmt(m.destHours)} h de ${m.subjects.join(', ')}.`);
    for (const m of outgoing) suggestions.push(`${m.kind === 'Cambio completo' ? 'Trasladar' : 'Compartir'} a ${m.name} con ${m.toName} (${fmt(m.destHours)} h).`);
    const staffHere = teachers.filter(t => t.origin === e);
    const ext = staffHere.filter(t => t.extension > 0); if (ext.length) suggestions.push(`Extender jornada a ${ext.length} docente${ext.length > 1 ? 's' : ''}: ${ext.slice(0, 4).map(t => `${t.name} (+${fmt(t.extension)} h)`).join(', ')}${ext.length > 4 ? '…' : ''}.`);
    const notRenewed = staffHere.filter(t => t.renueva === false); if (notRenewed.length) suggestions.push(`No renovar ${notRenewed.length} contrata${notRenewed.length > 1 ? 's' : ''}: ${notRenewed.map(t => t.name).join(', ')}.`);
    const sup = staffHere.filter(t => t.supresion > 0); if (sup.length) suggestions.push(`Suprimir ${fmt(suppressions)} h de contrato: ${sup.map(t => `${t.name} (${fmt(t.supresion)} h)`).join(', ')}.`);
    const piePend = R.piePend.filter(x => x.e === e); if (piePend.length) suggestions.push(`Apoyo PIE pendiente: ${piePend.map(x => `${fmt(x.horas)} h en ${x.t === 1 ? 'marzo–julio' : 'agosto–diciembre'}`).join(' y ')}.`);
    const ineff = staffHere.filter(t => t.label === 'Ineficiente' || t.label === 'Sin clases'); if (ineff.length) suggestions.push(`${ineff.length} docente${ineff.length > 1 ? 's' : ''} con carga ineficiente: revisar en la pestaña Docentes.`);
    if (!suggestions.length) suggestions.push('Dotación equilibrada: mantener.');
    const vacantAfter = round(avg(T.map(t => per[t].vacantes)));
    return { id: e, name: s.name, modality: s.modality, commune: s.commune, gapBefore: sum.gap, statusBefore: sum.status, uncoveredBefore: baseUncovered, uncoveredAfter: vacantAfter, required, per, suppressions, incoming, outgoing, suggestions, teachers: staffHere.length, efficient: staffHere.filter(t => t.label === 'Eficiente').length };
  });

  // ---- Resumen general ----
  const gen = teachers.filter(t => !t.pie);
  const count = label => key => gen.filter(t => t[key] === label).length;
  const idle = (util, avail) => avail > 0 ? Math.max(0, avail * (1 - (util ?? 0))) : 0;
  const summary = {
    schools: schools.length, teachers: teachers.length,
    uncoveredBefore: round(schools.reduce((n, s) => n + s.uncoveredBefore, 0)), uncoveredAfter: round(schools.reduce((n, s) => n + s.uncoveredAfter, 0)),
    deficitBefore: schools.filter(s => s.gapBefore < -0.01).length, withVacanciesBefore: schools.filter(s => s.uncoveredBefore > 0.01).length, withVacanciesAfter: schools.filter(s => s.uncoveredAfter > 0.01).length,
    contractBefore: round(teachers.reduce((n, t) => n + t.contract, 0)), contractAfter: round(teachers.reduce((n, t) => n + t.contractAfter, 0)),
    hireCourses: round(avg(T.map(t => R.vacantes.filter(v => v.t === t).reduce((n, v) => n + v.cursos, 0)))),
    moves: moves.length, extensions: teachers.filter(t => t.extension > 0).length, extensionHours: round(teachers.reduce((n, t) => n + t.extension, 0)),
    suppressions: teachers.filter(t => t.supresion > 0).length, suppressionHours: round(teachers.reduce((n, t) => n + t.supresion, 0)),
    renewed: teachers.filter(t => t.renueva === true).length, notRenewed: teachers.filter(t => t.renueva === false).length,
    efficientBefore: count('Eficiente')('labelBefore'), efficientAfter: count('Eficiente')('label'), inefficientBefore: gen.filter(t => ['Ineficiente', 'Sin clases'].includes(t.labelBefore)).length, inefficientAfter: gen.filter(t => ['Ineficiente', 'Sin clases'].includes(t.label)).length,
    idleBefore: round(gen.reduce((n, t) => n + idle(t.utilBefore, D.doc[t.id].H.GEN - D.doc[t.id].Hnl), 0)),
    theta: R.theta, phases: R.log, failed: R.failed,
  };
  return { summary, schools, teachers, moves, byId };
}
export const formatPct = pct;

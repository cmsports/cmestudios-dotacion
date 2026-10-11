// Mesa de ayuda: canal formal de requerimientos (tickets) con respuesta en 24 h desde el levantamiento.
export const TICKET_SLA_HOURS = 24;
export const TICKET_TYPES = ['Error o incidencia', 'Ajuste de dotación', 'Consulta de uso', 'Capacitación o manual'];
export const TICKET_STATUS = ['Abierto', 'En curso', 'Resuelto'];
const HOUR = 3600e3;

export function nextTicketId(tickets) {
  const max = tickets.reduce((m, t) => Math.max(m, parseInt(t.id.slice(4), 10) || 0), 0);
  return `TCK-${String(max + 1).padStart(4, '0')}`;
}

// Plazo de primera respuesta. ok = en plazo, late = vencido sin responder, met/missed = ya respondido.
export function ticketSla(t, now = Date.now()) {
  const due = t.createdAt + TICKET_SLA_HOURS * HOUR;
  if (t.firstResponseAt) return { due, state: t.firstResponseAt <= due ? 'met' : 'missed' };
  return { due, state: now > due ? 'late' : 'ok', hours: Math.abs(due - now) / HOUR };
}

export function ticketStats(tickets, now = Date.now()) {
  const slas = tickets.map(t => ticketSla(t, now));
  const answered = slas.filter(s => s.state === 'met' || s.state === 'missed');
  return {
    open: tickets.filter(t => t.status !== 'Resuelto').length,
    resolved: tickets.filter(t => t.status === 'Resuelto').length,
    late: slas.filter(s => s.state === 'late').length,
    onTimePct: answered.length ? Math.round(answered.filter(s => s.state === 'met').length / answered.length * 100) : null,
  };
}

export function seedTickets(now = Date.now()) {
  const at = h => now - h * HOUR;
  return [
    { id: 'TCK-0001', createdAt: at(52), requester: 'Dirección · Escuela Los Canelos', schoolId: 'EST-008', type: 'Consulta de uso', subject: 'No encuentro dónde descargar la ficha para firma', description: 'Necesito la ficha del establecimiento en PDF con el espacio para la firma del director.', status: 'Resuelto', firstResponseAt: at(49),
      thread: [{ at: at(49), by: 'Soporte CMEstudios', text: 'Se descarga desde Cuadratura → Exportar → Ficha para firma (PDF). Te dejamos el paso a paso en el manual.' }, { at: at(48), by: 'Solicitante', text: 'Listo, ya la descargué. Gracias.' }] },
    { id: 'TCK-0002', createdAt: at(20), requester: 'Subdirección · SLEP Llanquihue', schoolId: '', type: 'Ajuste de dotación', subject: 'Renuncia voluntaria de docente en Liceo Austral', description: 'Se informa la renuncia de una docente con 30 horas. Se solicita liberar las horas y dejar el cargo vacante.', status: 'En curso', firstResponseAt: at(17),
      thread: [{ at: at(17), by: 'Soporte CMEstudios', text: 'Recibido. Estamos liberando las horas y creando el cargo vacante; te avisamos al terminar.' }] },
    { id: 'TCK-0003', createdAt: at(2), requester: 'Dirección · Liceo del Lago', schoolId: 'EST-027', type: 'Error o incidencia', subject: 'La brecha no cambia después de editar una asignatura', description: 'Cambié las horas de Matemática y la brecha sigue igual en la tabla.', status: 'Abierto', firstResponseAt: null, thread: [] },
  ];
}

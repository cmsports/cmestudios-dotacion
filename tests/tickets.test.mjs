import test from 'node:test';
import assert from 'node:assert/strict';
import { ticketSla, ticketStats, nextTicketId, seedTickets, TICKET_SLA_HOURS } from '../src/tickets.mjs';

const H = 3600e3, now = 1e12;
test('first response is measured against 24 h from creation', () => {
  assert.equal(ticketSla({ createdAt: now - 2 * H, firstResponseAt: null }, now).state, 'ok');
  assert.equal(ticketSla({ createdAt: now - 25 * H, firstResponseAt: null }, now).state, 'late');
  assert.equal(ticketSla({ createdAt: now - 30 * H, firstResponseAt: now - 10 * H }, now).state, 'met');
  assert.equal(ticketSla({ createdAt: now - 50 * H, firstResponseAt: now - 20 * H }, now).state, 'missed');
  assert.equal(TICKET_SLA_HOURS, 24);
});
test('stats and ids over the seed tickets', () => {
  const t = seedTickets(now);
  assert.deepEqual(ticketStats(t, now), { open: 2, resolved: 1, late: 0, onTimePct: 100 });
  assert.equal(nextTicketId(t), 'TCK-0004');
  assert.equal(nextTicketId([]), 'TCK-0001');
});

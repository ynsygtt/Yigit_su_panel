const test = require('node:test');
const assert = require('node:assert/strict');
const { getLocalDateString, parseLocalDate, getLocalDayRange, getMsUntilTime } = require('../utils/dateHelpers');

test('getLocalDateString formats YYYY-MM-DD', () => {
  const date = new Date(2026, 1, 4, 10, 30, 0, 0);
  assert.equal(getLocalDateString(date), '2026-02-04');
});

test('parseLocalDate returns day start/end', () => {
  const start = parseLocalDate('2026-02-04');
  const end = parseLocalDate('2026-02-04', true);
  assert.equal(start.getHours(), 0);
  assert.equal(start.getMinutes(), 0);
  assert.equal(end.getHours(), 23);
  assert.equal(end.getMinutes(), 59);
});

test('getLocalDayRange returns expected bounds', () => {
  const { start, end } = getLocalDayRange('2026-02-04', '2026-02-04');
  assert.ok(start <= end);
  assert.equal(start.getDate(), 4);
  assert.equal(end.getDate(), 4);
});

test('getMsUntilTime returns positive value', () => {
  const ms = getMsUntilTime(23, 59, 0, new Date(2026, 1, 4, 10, 0, 0, 0));
  assert.ok(ms > 0);
});

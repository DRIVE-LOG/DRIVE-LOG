import test from 'node:test';
import assert from 'node:assert/strict';
import { nextSort, sortLogs, filterLogs, SORT_COLUMNS } from '../functions/lib/query.js';

const rows = [
  { id: 'a', timestamp: '2025-07-05T00:00:00Z', user: 'user2', log_level: 'WARNING', message: 'brake', Speed: 10, EngTemp: 30 },
  { id: 'b', timestamp: '2025-07-06T00:00:00Z', user: 'user10', log_level: 'CRITICAL', message: 'airbag', Speed: 2, EngTemp: null },
  { id: 'c', timestamp: '2025-07-07T00:00:00Z', user: 'user1', log_level: 'INFO', message: 'cruise', Speed: null, EngTemp: -10 },
];
const ids = values => values.map(row => row.id);

test('each header cycles default, ascending, descending, default; switching headers starts ascending', () => {
  for (const key of Object.keys(SORT_COLUMNS)) {
    const ascending = nextSort({ key: null, direction: 'default' }, key);
    assert.deepEqual(ascending, { key, direction: 'asc' });
    const descending = nextSort(ascending, key);
    assert.deepEqual(descending, { key, direction: 'desc' });
    assert.deepEqual(nextSort(descending, key), { key: null, direction: 'default' });
  }
  assert.deepEqual(nextSort({ key: 'Speed', direction: 'desc' }, 'user'), { key: 'user', direction: 'asc' });
});

test('all six columns sort by their data type, keep missing values last, and restore latest first', () => {
  const expected = {
    timestamp: [['a','b','c'], ['c','b','a']],
    log_level: [['c','a','b'], ['b','a','c']],
    user: [['c','a','b'], ['b','a','c']],
    message: [['b','a','c'], ['c','a','b']],
    Speed: [['b','a','c'], ['a','b','c']],
    EngTemp: [['c','a','b'], ['a','c','b']],
  };
  for (const [key, [asc, desc]] of Object.entries(expected)) {
    assert.deepEqual(ids(sortLogs(rows, { key, direction: 'asc' })), asc, key);
    assert.deepEqual(ids(sortLogs(rows, { key, direction: 'desc' })), desc, key);
  }
  assert.deepEqual(ids(sortLogs(rows)), ['c','b','a']);
  assert.deepEqual(ids(rows), ['a','b','c'], 'source order must not be mutated');
});

test('sort spans all filtered results before pagination and resolves ties consistently', () => {
  const many = Array.from({ length: 45 }, (_, i) => ({ ...rows[0], id: String(i).padStart(2, '0'), Speed: 45 - i }));
  const sorted = sortLogs(filterLogs(many, { user: 'user2', level: 'WARNING' }), { key: 'Speed', direction: 'asc' });
  assert.equal(sorted[0].Speed, 1);
  assert.equal(sorted[20].Speed, 21);
  const tied = [{ ...rows[0], id: 'z' }, { ...rows[1], Speed: 10 }, { ...rows[0], id: 'a' }];
  assert.deepEqual(ids(sortLogs(tied, { key: 'Speed', direction: 'asc' })), ['b','a','z']);
});

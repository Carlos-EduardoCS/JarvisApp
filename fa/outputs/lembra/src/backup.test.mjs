import assert from 'node:assert/strict';
import test from 'node:test';
// Node's type stripping keeps the tests independent of the iPhone runtime.
import { createBackup, mergeBackup, parseBackup, MAX_BACKUP_BYTES } from './backup.ts';

const task = { id: 'lembra-123-abc', title: 'Reunião', notes: 'Descrição com acentos', done: false, dueAt: '2030-05-01T12:00:00.000Z', minutesBefore: 10 };
test('backup round trip preserves tasks and all theme preferences', () => {
  for (const theme of ['light', 'dark', 'system']) {
    const parsed = parseBackup(JSON.stringify(createBackup([task], theme)));
    assert.deepEqual(parsed.tasks, [task]);
    assert.equal(parsed.preferences.theme, theme);
  }
});
test('restore is idempotent and preserves the current version of existing tasks', () => {
  const current = [{ ...task, title: 'Título editado', done: true }];
  const other = { ...task, id: 'lembra-456-def' };
  const backup = createBackup([task, other], 'dark');
  const first = mergeBackup(current, backup);
  assert.deepEqual(first.tasks, [...current, other]);
  assert.equal(first.skipped, 1);
  assert.equal(mergeBackup(first.tasks, backup).added.length, 0);
  assert.deepEqual(mergeBackup(first.tasks, backup).tasks, first.tasks);
});
test('empty backup does not remove current tasks', () => {
  assert.deepEqual(mergeBackup([task], createBackup([], 'system')).tasks, [task]);
});
test('invalid, oversized, foreign and future-version files are rejected', () => {
  for (const raw of ['not json', 'null', '[]', ' '.repeat(MAX_BACKUP_BYTES + 1)]) assert.throws(() => parseBackup(raw));
  const backup = createBackup([task], 'light');
  for (const override of [{ app: 'other' }, { version: 2 }, { preferences: { theme: 'unknown' } }, { createdAt: 'invalid' }]) assert.throws(() => parseBackup(JSON.stringify({ ...backup, ...override })));
});
test('bad task fields and duplicate IDs reject the entire file', () => {
  const backup = createBackup([task], 'light');
  for (const override of [{ id: '__proto__' }, { title: '' }, { title: 'a'.repeat(101) }, { dueAt: 'invalid' }, { minutesBefore: -1 }, { done: 'false' }, { notes: null }]) assert.throws(() => parseBackup(JSON.stringify({ ...backup, tasks: [{ ...task, ...override }] })));
  assert.throws(() => parseBackup(JSON.stringify({ ...backup, tasks: [task, task] })));
});
test('export strips notification identifiers and unrelated fields', () => {
  const backup = createBackup([{ ...task, notificationId: 'old-device' }], 'light');
  assert.equal('notificationId' in backup.tasks[0], false);
});

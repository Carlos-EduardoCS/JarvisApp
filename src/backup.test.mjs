import assert from 'node:assert/strict';
import test from 'node:test';
// Node's type stripping keeps the tests independent of the iPhone runtime.
import { createBackup, mergeBackup, parseBackup, MAX_BACKUP_BYTES } from './backup.ts';
import { meetingLink, mapLink } from './tasks.ts';

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
test('address and meeting survive export and restore, including URL query parameters', () => {
  const extended = { ...task, location: 'Av. Paulista, 1000, São Paulo', meetingUrl: 'https://teams.microsoft.com/l/meetup-join/abc?context=%7B%22Tid%22%3A%22123%22%7D' };
  const backup = parseBackup(JSON.stringify(createBackup([extended], 'dark')));
  assert.deepEqual(mergeBackup([], backup).tasks, [extended]);
});
test('optional fields can be removed and older backups remain valid', () => {
  assert.deepEqual(parseBackup(JSON.stringify(createBackup([task], 'light'))).tasks, [task]);
  const cleared = { ...task, location: '', meetingUrl: '' };
  assert.deepEqual(createBackup([cleared], 'light').tasks, [cleared]);
});
test('map query encodes accents and separators without adding URL parameters', () => {
  const address = 'Rua São João, 12 & 14 #2, São Paulo';
  const url = new URL(mapLink(address));
  assert.equal(url.hostname, 'maps.apple.com');
  assert.equal(url.searchParams.get('q'), address);
  assert.equal([...url.searchParams].length, 1);
  assert.throws(() => mapLink(' '));
});
test('meeting links preserve provider links and normalize omitted protocol', () => {
  for (const url of ['https://meet.google.com/abc-defg-hij', 'https://us02web.zoom.us/j/123?pwd=ABC', 'https://teams.microsoft.com/l/meetup-join/abc?context=xyz']) assert.equal(meetingLink(url), url);
  assert.equal(meetingLink(' meet.google.com/abc-defg-hij '), 'https://meet.google.com/abc-defg-hij');
  assert.equal(meetingLink(''), '');
});
test('invalid links are rejected both in the form helper and backup import', () => {
  for (const meetingUrl of ['javascript:alert(1)', 'file:///tmp/test', 'https://user:pass@example.com', 'reunião amanhã', 'https://', 'https://localhost']) {
    assert.throws(() => meetingLink(meetingUrl));
    assert.throws(() => createBackup([{ ...task, meetingUrl }], 'light'));
  }
  assert.throws(() => createBackup([{ ...task, location: 123 }], 'light'));
  assert.throws(() => createBackup([{ ...task, meetingUrl: {} }], 'light'));
});

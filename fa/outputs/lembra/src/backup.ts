import type { Task } from './tasks';

export type BackupTheme = 'light' | 'dark' | 'system';
export type Backup = { app: 'jarvis'; version: 1; createdAt: string; preferences: { theme: BackupTheme }; tasks: Task[] };
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
export function parseBackup(text: string): Backup {
  if (text.length > MAX_BACKUP_BYTES) throw new Error('O arquivo ultrapassa o limite de 5 MB.');
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error('O arquivo não contém um backup válido.'); }
  if (!data || data.app !== 'jarvis' || data.version !== 1 || !Array.isArray(data.tasks) || data.tasks.length > 10000 || !['light', 'dark', 'system'].includes(data.preferences?.theme) || typeof data.createdAt !== 'string' || !Number.isFinite(Date.parse(data.createdAt))) throw new Error('Formato ou versão de backup não compatível com o Jarvis.');
  const ids = new Set<string>();
  const tasks = data.tasks.map((t: any): Task => {
    if (!t || typeof t.id !== 'string' || !/^lembra-[a-zA-Z0-9-]{1,150}$/.test(t.id) || ids.has(t.id) || typeof t.title !== 'string' || !t.title.trim() || t.title.length > 100 || typeof t.notes !== 'string' || t.notes.length > 1000 || typeof t.done !== 'boolean' || ![0, 10, 30, 1440].includes(t.minutesBefore) || typeof t.dueAt !== 'string' || !Number.isFinite(Date.parse(t.dueAt))) throw new Error('O backup contém tarefas inválidas ou identificadores repetidos.');
    ids.add(t.id);
    return { id: t.id, title: t.title, notes: t.notes, done: t.done, minutesBefore: t.minutesBefore, dueAt: new Date(t.dueAt).toISOString() };
  });
  return { app: 'jarvis', version: 1, createdAt: new Date(data.createdAt).toISOString(), preferences: { theme: data.preferences.theme }, tasks };
}
export function createBackup(tasks: Task[], theme: BackupTheme): Backup {
  return parseBackup(JSON.stringify({ app: 'jarvis', version: 1, createdAt: new Date().toISOString(), preferences: { theme }, tasks }));
}
export function mergeBackup(current: Task[], backup: Backup) {
  const existing = new Set(current.map(t => t.id));
  const added = backup.tasks.filter(t => !existing.has(t.id));
  return { tasks: [...current, ...added], added, skipped: backup.tasks.length - added.length };
}

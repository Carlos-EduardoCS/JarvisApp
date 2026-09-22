export type Task = { id: string; title: string; notes: string; dueAt: string; minutesBefore: number; done: boolean; location?: string; meetingUrl?: string; isMeeting?: boolean };
export function meetingLink(value: string): string {
  const input = value.trim();
  if (!input) return '';
  if (input.length > 4096 || /\s/.test(input)) throw new Error('Cole apenas o link completo da reunião, sem o texto do convite.');
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`;
  let url: URL;
  try { url = new URL(candidate); } catch { throw new Error('O link da reunião não é válido.'); }
  if (!['https:', 'http:'].includes(url.protocol) || !url.hostname.includes('.') || url.username || url.password) throw new Error('Use um link da reunião que comece com https://.');
  return url.href;
}
export function mapLink(address: string): string {
  const value = address.trim();
  if (!value || value.length > 500) throw new Error('Informe um endereço de até 500 caracteres.');
  return `https://maps.apple.com/?q=${encodeURIComponent(value)}`;
}
export const reminderDate = (task: Task) => new Date(Date.parse(task.dueAt) - task.minutesBefore * 60000);
export function visibleTasks(tasks: Task[], filter: string, now = new Date()) {
  return tasks.filter(t => {
    if (filter === 'Concluídas') return t.done;
    if (t.done) return false;
    const today = new Date(t.dueAt).toDateString() === now.toDateString();
    return filter === 'Hoje' ? today || new Date(t.dueAt) < now : !today && new Date(t.dueAt) > now;
  }).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

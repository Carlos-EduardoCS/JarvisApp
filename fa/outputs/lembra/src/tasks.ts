export type Task = { id: string; title: string; notes: string; dueAt: string; minutesBefore: number; done: boolean };
export const reminderDate = (task: Task) => new Date(Date.parse(task.dueAt) - task.minutesBefore * 60000);
export function visibleTasks(tasks: Task[], filter: string, now = new Date()) {
  return tasks.filter(t => {
    if (filter === 'Concluídas') return t.done;
    if (t.done) return false;
    const today = new Date(t.dueAt).toDateString() === now.toDateString();
    return filter === 'Hoje' ? today || new Date(t.dueAt) < now : !today && new Date(t.dueAt) > now;
  }).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

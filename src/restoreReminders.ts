import * as Notifications from 'expo-notifications';
import { Task, reminderDate } from './tasks';
import { scheduleReminder } from './reminders';

export async function restoreReminders(tasks: Task[]) {
  const future = tasks.filter(t => !t.done && reminderDate(t).getTime() > Date.now()).sort((a, b) => reminderDate(a).getTime() - reminderDate(b).getTime());
  if (!future.length) return { scheduled: 0, missing: 0 };
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return { scheduled: 0, missing: future.length };
  const pending = new Set((await Notifications.getAllScheduledNotificationsAsync()).map(n => n.identifier));
  let scheduled = 0;
  let missing = 0;
  for (const task of future) {
    // Leave room below the iOS pending-notification limit. Never cancel unrelated alerts.
    if (!pending.has(task.id) && pending.size >= 60) { missing++; continue; }
    try {
      if (pending.has(task.id)) await Notifications.cancelScheduledNotificationAsync(task.id);
      if (await scheduleReminder(task)) { pending.add(task.id); scheduled++; }
      else missing++;
    } catch { missing++; }
  }
  return { scheduled, missing };
}

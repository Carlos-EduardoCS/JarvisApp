import * as Notifications from 'expo-notifications';
import { Task, reminderDate } from './tasks';
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
export const cancelReminder = (task: Task) => Notifications.cancelScheduledNotificationAsync(task.id);
export async function scheduleReminder(task: Task) {
  if (task.done || reminderDate(task).getTime() <= Date.now()) return false;
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;
  await Notifications.scheduleNotificationAsync({
    identifier: task.id,
    content: { title: task.title, body: task.minutesBefore ? `Seu compromisso é em ${task.minutesBefore === 1440 ? '1 dia' : `${task.minutesBefore} minutos`}.` : 'Está na hora!', sound: 'default' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderDate(task) },
  });
  return true;
}

import React, { useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { StatusBar } from 'expo-status-bar';
import { Task, reminderDate, visibleTasks } from './src/tasks';
import { cancelReminder, scheduleReminder } from './src/reminders';

const KEY = 'lembra.tasks.v1';
const filters = ['Hoje', 'Próximas', 'Concluídas'];
const options = [{ label: 'Na hora', value: 0 }, { label: '10 min', value: 10 }, { label: '30 min', value: 30 }, { label: '1 dia', value: 1440 }];
export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('Hoje');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date());
  const [minutes, setMinutes] = useState(10);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    AsyncStorage.getItem(KEY).then(raw => {
      const data: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(data) || !data.every(t => typeof t.id === 'string' && typeof t.title === 'string' && typeof t.notes === 'string' && typeof t.done === 'boolean' && Number.isFinite(t.minutesBefore) && Number.isFinite(Date.parse(t.dueAt)))) throw new Error('Invalid data');
      setTasks(data); setReady(true);
    }).catch(() => Alert.alert('Falha ao carregar', 'Feche e abra o app novamente. Seus dados não foram substituídos.'));
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  async function persist(next: Task[]) { await AsyncStorage.setItem(KEY, JSON.stringify(next)); setTasks(next); }
  function showForm(task?: Task) {
    setEditing(task ?? null); setTitle(task?.title ?? ''); setNotes(task?.notes ?? '');
    setDate(task ? new Date(task.dueAt) : new Date(Date.now() + 3600000)); setMinutes(task?.minutesBefore ?? 10); setOpen(true);
  }
  async function save() {
    if (!title.trim()) return Alert.alert('Falta o título', 'Dê um nome à sua tarefa.');
    const task: Task = { id: editing?.id ?? `lembra-${Date.now()}-${Math.random().toString(36).slice(2)}`, title: title.trim(), notes: notes.trim(), dueAt: date.toISOString(), minutesBefore: minutes, done: editing?.done ?? false };
    if (!task.done && reminderDate(task).getTime() <= Date.now()) return Alert.alert('Ajuste o lembrete', 'Escolha uma data e antecedência que deixem o aviso no futuro.');
    setBusy(true);
    try {
      await persist(editing ? tasks.map(t => t.id === task.id ? task : t) : [...tasks, task]); setOpen(false);
      try {
        await cancelReminder(task);
        if (!await scheduleReminder(task) && !task.done) Alert.alert('Salva sem aviso', 'Permita notificações nos Ajustes do iPhone. Depois, edite e salve esta tarefa novamente.');
      } catch { Alert.alert('Tarefa salva', 'Falha ao atualizar o aviso. Edite e salve a tarefa novamente para tentar reagendar.'); }
    } catch { Alert.alert('Falha ao salvar', 'Tente novamente.'); }
    finally { setBusy(false); }
  }
  async function change(task: Task, remove: boolean) {
    setBusy(true);
    try {
      await cancelReminder(task);
      await persist(remove ? tasks.filter(t => t.id !== task.id) : tasks.map(t => t.id === task.id ? { ...t, done: true } : t));
    } catch { Alert.alert('Falha ao atualizar', 'A tarefa pode estar sem aviso. Edite e salve novamente para reagendar.'); }
    finally { setBusy(false); }
  }
  const list = visibleTasks(tasks, filter, now);
  return <SafeAreaProvider><SafeAreaView style={s.page}><StatusBar style="dark" />
    <View style={s.header}><Text style={s.brand}>Jarvis<Text style={{ color: '#D57543' }}>.</Text></Text><Text style={s.muted}>Um pouco mais de espaço na sua cabeça.</Text></View>
    <View style={s.tabs}>{filters.map(f => <Pressable accessibilityRole="tab" accessibilityState={{ selected: f === filter }} key={f} onPress={() => setFilter(f)} style={[s.tab, f === filter && s.active]}><Text style={{ color: f === filter ? '#fff' : '#244B40' }}>{f}</Text></Pressable>)}</View>
    <Text style={s.count}>{ready ? `${list.length} ${list.length === 1 ? 'tarefa' : 'tarefas'}` : 'Carregando…'}</Text>
    <FlatList data={list} keyExtractor={t => t.id} contentContainerStyle={s.list} ListEmptyComponent={ready ? <View style={s.empty}><Text style={s.sun}>☀</Text><Text style={s.heading}>{filter === 'Concluídas' ? 'Cada passo conta.' : 'Espaço para o que importa.'}</Text><Text style={[s.muted, { textAlign: 'center', marginTop: 12 }]}>{filter === 'Concluídas' ? 'Suas tarefas concluídas aparecerão aqui.' : 'Adicione uma tarefa e escolha quando receber o lembrete.'}</Text></View> : null} renderItem={({ item }) => <View style={s.card}>
      <Pressable disabled={busy} accessibilityLabel={`Editar ${item.title}`} onPress={() => showForm(item)}><Text style={[s.task, item.done && { textDecorationLine: 'line-through', opacity: 0.6 }]}>{item.title}</Text><Text style={s.meta}>{new Date(item.dueAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}{!item.done && new Date(item.dueAt) < now ? ' · Atrasada' : ''}</Text>{item.notes ? <Text style={s.muted}>{item.notes}</Text> : null}</Pressable>
      <View style={s.actions}>{!item.done && <Pressable disabled={busy} style={s.link} onPress={() => change(item, false)}><Text style={s.green}>Concluir</Text></Pressable>}<Pressable disabled={busy} style={s.link} onPress={() => Alert.alert('Excluir tarefa?', item.title, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', style: 'destructive', onPress: () => change(item, true) }])}><Text style={{ color: '#A95036' }}>Excluir</Text></Pressable></View>
    </View>} />
    <Pressable disabled={!ready || busy} style={[s.primary, (!ready || busy) && { opacity: 0.5 }]} onPress={() => showForm()}><Text style={s.white}>＋ Nova tarefa</Text></Pressable>
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => !busy && setOpen(false)}><SafeAreaView style={s.page}><KeyboardAvoidingView style={{ flex: 1 }} behavior="padding"><ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
      <Text style={s.heading}>{editing ? 'Editar tarefa' : 'O que você quer lembrar?'}</Text>
      <Text style={s.label}>Título</Text><TextInput accessibilityLabel="Título" style={s.input} placeholder="Ex.: Levar o carro para revisão" value={title} onChangeText={setTitle} maxLength={100} />
      <Text style={s.label}>Descrição (opcional)</Text><TextInput accessibilityLabel="Descrição" style={[s.input, { minHeight: 80 }]} placeholder="Algum detalhe importante?" value={notes} onChangeText={setNotes} multiline maxLength={1000} />
      <Text style={s.label}>Data e horário</Text><DateTimePicker value={date} mode="datetime" display="spinner" locale="pt-BR" themeVariant="light" onChange={(_, value) => value && setDate(value)} />
      <Text style={s.label}>Lembrar antes</Text><View style={s.options}>{options.map(o => <Pressable accessibilityRole="radio" accessibilityState={{ checked: minutes === o.value }} key={o.value} onPress={() => setMinutes(o.value)} style={[s.tab, minutes === o.value && s.active]}><Text style={{ color: minutes === o.value ? '#fff' : '#244B40' }}>{o.label}</Text></Pressable>)}</View>
      <Text style={s.helper}>Permita notificações no iPhone. O modo Foco e os ajustes de som podem silenciar os avisos.</Text>
      <Pressable disabled={busy} style={s.primary} onPress={save}><Text style={s.white}>{busy ? 'Salvando…' : 'Salvar tarefa'}</Text></Pressable><Pressable disabled={busy} style={s.cancel} onPress={() => setOpen(false)}><Text style={s.green}>Cancelar</Text></Pressable>
    </ScrollView></KeyboardAvoidingView></SafeAreaView></Modal>
  </SafeAreaView></SafeAreaProvider>;
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F8F6F0' }, header: { padding: 24 }, brand: { fontSize: 44, fontWeight: '800', color: '#244B40', letterSpacing: -2 }, muted: { color: '#68766F', lineHeight: 22 }, tabs: { flexDirection: 'row', marginHorizontal: 24, gap: 6 }, tab: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: '#E8ECE3' }, active: { backgroundColor: '#244B40' }, count: { color: '#68766F', margin: 24, marginBottom: 12 }, list: { paddingHorizontal: 24, paddingBottom: 20, flexGrow: 1 }, card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E8DF', borderRadius: 20, padding: 18, marginBottom: 12 }, task: { fontSize: 18, fontWeight: '600', color: '#244B40' }, meta: { color: '#68766F', marginVertical: 8, fontSize: 13 }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }, link: { padding: 12, minHeight: 44 }, green: { color: '#244B40', fontWeight: '600' }, empty: { alignItems: 'center', paddingVertical: 60 }, sun: { fontSize: 48, color: '#D57543', marginBottom: 20 }, heading: { fontSize: 25, fontWeight: '700', color: '#244B40' }, primary: { margin: 24, marginTop: 12, padding: 18, backgroundColor: '#244B40', borderRadius: 18, alignItems: 'center' }, white: { color: '#fff', fontSize: 17, fontWeight: '600' }, form: { padding: 24 }, label: { color: '#244B40', fontWeight: '600', marginTop: 20, marginBottom: 10 }, input: { padding: 16, borderWidth: 1, borderColor: '#E5E8DF', borderRadius: 14, backgroundColor: '#fff', color: '#244B40', fontSize: 16 }, options: { flexDirection: 'row', gap: 8 }, helper: { marginTop: 20, fontSize: 12, color: '#68766F', lineHeight: 18 }, cancel: { alignItems: 'center', padding: 16 },
});

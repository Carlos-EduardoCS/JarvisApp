import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Animated, Easing, FlatList, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { StatusBar } from 'expo-status-bar';
import { Task, reminderDate, visibleTasks } from './src/tasks';
import { cancelReminder, scheduleReminder } from './src/reminders';

type ThemeMode = 'light' | 'dark' | 'system';
const THEME_KEY = 'jarvis.theme.v1';
const palettes = {
  light: { background: '#F5F4F0', surface: '#FFFFFF', text: '#142235', muted: '#647184', subtle: '#E9ECF0', border: '#DFE3E8', accent: '#B49764', primary: '#142235', onPrimary: '#FFFFFF', danger: '#A95036' },
  dark: { background: '#0C1420', surface: '#162235', text: '#F3F4F6', muted: '#AAB6C8', subtle: '#202F44', border: '#334158', accent: '#B49764', primary: '#263D5C', onPrimary: '#FFFFFF', danger: '#F0A38F' },
};
type Palette = typeof palettes.light;
function blendPalette(from: Palette, to: Palette, progress: number): Palette {
  const result = {} as Palette;
  for (const key of Object.keys(to) as (keyof Palette)[]) {
    const channels = [1, 3, 5].map(offset => {
      const start = parseInt(from[key].slice(offset, offset + 2), 16);
      const end = parseInt(to[key].slice(offset, offset + 2), 16);
      return Math.round(start + (end - start) * progress).toString(16).padStart(2, '0');
    });
    result[key] = '#' + channels.join('');
  }
  return result;
}
function useTransitionPalette(target: Palette) {
  const [colors, setColors] = useState(target);
  const current = useRef(target);
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let active = true;
    let receivedEvent = false;
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (active && !receivedEvent) setReduceMotion(value);
    }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      receivedEvent = true;
      setReduceMotion(value);
    });
    return () => { active = false; listener.remove(); };
  }, []);
  useEffect(() => {
    if (reduceMotion) { current.current = target; setColors(target); return; }
    const from = current.current;
    let start: number | undefined;
    let frame: number;
    const tick = (timestamp: number) => {
      if (start === undefined) start = timestamp;
      const progress = Math.min(1, (timestamp - start) / 320);
      const eased = progress * progress * (3 - 2 * progress);
      const next = progress === 1 ? target : blendPalette(from, target, eased);
      current.current = next;
      setColors(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, reduceMotion]);
  return colors;
}
function OpeningAnimation({ colors, onFinish }: { colors: Palette; onFinish: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const offset = useRef(new Animated.Value(10)).current;
  const dotOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    let motionChanged = false;
    const finish = () => { if (active) onFinish(); };
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', enabled => {
      if (enabled) { motionChanged = true; animation?.stop(); finish(); }
    });
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (!active || motionChanged) return;
      if (reduced) { finish(); return; }
      animation = Animated.sequence([
        Animated.parallel([
          Animated.timing(nameOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(offset, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.sequence([
            Animated.delay(550),
            Animated.timing(dotOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
          ]),
        ]),
        Animated.delay(650),
        Animated.timing(opacity, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]);
      animation.start(({ finished }) => { if (finished) finish(); });
    }).catch(finish);
    return () => { active = false; animation?.stop(); listener.remove(); };
  }, [onFinish, opacity, nameOpacity, offset, dotOpacity]);
  return <Animated.View accessibilityViewIsModal accessible accessibilityLabel="Jarvis, abertura" style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', opacity }]}>
    <Animated.View style={{ flexDirection: 'row', alignItems: 'baseline', transform: [{ translateY: offset }] }}>
      <Animated.Text style={{ color: colors.text, fontSize: 48, fontWeight: '600', letterSpacing: -1, opacity: nameOpacity }}>Jarvis</Animated.Text>
      <Animated.Text style={{ color: colors.accent, fontSize: 48, fontWeight: '600', opacity: dotOpacity }}>.</Animated.Text>
    </Animated.View>
  </Animated.View>;
}
const themeOptions: { value: ThemeMode; label: string }[] = [{ value: 'light', label: 'Claro' }, { value: 'dark', label: 'Escuro' }, { value: 'system', label: 'Sistema' }];
const KEY = 'lembra.tasks.v1';
const filters = ['Hoje', 'Próximas', 'Concluídas'];
const options = [{ label: 'Na hora', value: 0 }, { label: '10 min', value: 10 }, { label: '30 min', value: 30 }, { label: '1 dia', value: 1440 }];
export default function App() {
  const systemTheme = useColorScheme();
  const [opening, setOpening] = useState(true);
  const finishOpening = useCallback(() => setOpening(false), []);
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [themeReady, setThemeReady] = useState(false);
  const [themeSaving, setThemeSaving] = useState(false);
  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemTheme === 'dark');
  const colors = useTransitionPalette(palettes[isDark ? 'dark' : 'light']);
  const s = useMemo(() => createStyles(colors), [colors]);
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(value => {
      if (value === 'light' || value === 'dark' || value === 'system') setThemeMode(value);
    }).catch(() => Alert.alert('Aparência', 'Não foi possível recuperar sua preferência de tema.'))
      .finally(() => setThemeReady(true));
  }, []);
  async function chooseTheme(value: ThemeMode) {
    setThemeSaving(true);
    try { await AsyncStorage.setItem(THEME_KEY, value); setThemeMode(value); }
    catch { Alert.alert('Aparência', 'Não foi possível salvar o tema. Tente novamente.'); }
    finally { setThemeSaving(false); }
  }
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
  return <SafeAreaProvider><View style={s.page}><SafeAreaView style={s.page} pointerEvents={opening ? "none" : "auto"} accessibilityElementsHidden={opening} importantForAccessibility={opening ? "no-hide-descendants" : "auto"}><StatusBar animated style={isDark ? "light" : "dark"} />
    <View style={s.header}><Text style={s.brand}>Jarvis<Text style={{ color: colors.accent }}>.</Text></Text><Text style={s.muted}>Um pouco mais de espaço na sua cabeça.</Text><View style={s.themeRow} accessibilityLabel="Aparência">{themeOptions.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.value === 'system' ? 'Seguir tema do iPhone' : 'Tema ' + option.label} accessibilityState={{ checked: themeMode === option.value, disabled: !themeReady || themeSaving }} disabled={!themeReady || themeSaving} onPress={() => chooseTheme(option.value)} style={[s.themeChoice, themeMode === option.value && s.themeSelected]}><Text style={[s.themeText, themeMode === option.value && { color: colors.text, fontWeight: '600' }]}>{option.label}</Text></Pressable>)}</View></View>
    <View style={s.tabs}>{filters.map(f => <Pressable accessibilityRole="tab" accessibilityState={{ selected: f === filter }} key={f} onPress={() => setFilter(f)} style={[s.tab, f === filter && s.active]}><Text style={{ color: f === filter ? colors.onPrimary : colors.text }}>{f}</Text></Pressable>)}</View>
    <Text style={s.count}>{ready ? `${list.length} ${list.length === 1 ? 'tarefa' : 'tarefas'}` : 'Carregando…'}</Text>
    <FlatList data={list} keyExtractor={t => t.id} contentContainerStyle={s.list} ListEmptyComponent={ready ? <View style={s.empty}><Text style={s.sun}>☀</Text><Text style={s.heading}>{filter === 'Concluídas' ? 'Cada passo conta.' : 'Espaço para o que importa.'}</Text><Text style={[s.muted, { textAlign: 'center', marginTop: 12 }]}>{filter === 'Concluídas' ? 'Suas tarefas concluídas aparecerão aqui.' : 'Adicione uma tarefa e escolha quando receber o lembrete.'}</Text></View> : null} renderItem={({ item }) => <View style={s.card}>
      <Pressable disabled={busy} accessibilityLabel={`Editar ${item.title}`} onPress={() => showForm(item)}><Text style={[s.task, item.done && { textDecorationLine: 'line-through', opacity: 0.6 }]}>{item.title}</Text><Text style={s.meta}>{new Date(item.dueAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}{!item.done && new Date(item.dueAt) < now ? ' · Atrasada' : ''}</Text>{item.notes ? <Text style={s.muted}>{item.notes}</Text> : null}</Pressable>
      <View style={s.actions}>{!item.done && <Pressable disabled={busy} style={s.link} onPress={() => change(item, false)}><Text style={s.actionText}>Concluir</Text></Pressable>}<Pressable disabled={busy} style={s.link} onPress={() => Alert.alert('Excluir tarefa?', item.title, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', style: 'destructive', onPress: () => change(item, true) }])}><Text style={{ color: colors.danger }}>Excluir</Text></Pressable></View>
    </View>} />
    <Pressable disabled={!ready || busy} style={[s.primary, (!ready || busy) && { opacity: 0.5 }]} onPress={() => showForm()}><Text style={s.white}>＋ Nova tarefa</Text></Pressable>
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => !busy && setOpen(false)}><SafeAreaView style={s.page}><KeyboardAvoidingView style={{ flex: 1 }} behavior="padding"><ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
      <Text style={s.heading}>{editing ? 'Editar tarefa' : 'O que você quer lembrar?'}</Text>
      <Text style={s.label}>Título</Text><TextInput accessibilityLabel="Título" style={s.input} placeholderTextColor={colors.muted} selectionColor={colors.text} keyboardAppearance={isDark ? "dark" : "light"} placeholder="Ex.: Levar o carro para revisão" value={title} onChangeText={setTitle} maxLength={100} />
      <Text style={s.label}>Descrição (opcional)</Text><TextInput accessibilityLabel="Descrição" style={[s.input, { minHeight: 80 }]} placeholderTextColor={colors.muted} selectionColor={colors.text} keyboardAppearance={isDark ? "dark" : "light"} placeholder="Algum detalhe importante?" value={notes} onChangeText={setNotes} multiline maxLength={1000} />
      <Text style={s.label}>Data e horário</Text><DateTimePicker value={date} mode="datetime" display="spinner" locale="pt-BR" themeVariant={isDark ? "dark" : "light"} accentColor={colors.text} textColor={colors.text} onChange={(_, value) => value && setDate(value)} />
      <Text style={s.label}>Lembrar antes</Text><View style={s.options}>{options.map(o => <Pressable accessibilityRole="radio" accessibilityState={{ checked: minutes === o.value }} key={o.value} onPress={() => setMinutes(o.value)} style={[s.tab, minutes === o.value && s.active]}><Text style={{ color: minutes === o.value ? colors.onPrimary : colors.text }}>{o.label}</Text></Pressable>)}</View>
      <Text style={s.helper}>Permita notificações no iPhone. O modo Foco e os ajustes de som podem silenciar os avisos.</Text>
      <Pressable disabled={busy} style={s.primary} onPress={save}><Text style={s.white}>{busy ? 'Salvando…' : 'Salvar tarefa'}</Text></Pressable><Pressable disabled={busy} style={s.cancel} onPress={() => setOpen(false)}><Text style={s.actionText}>Cancelar</Text></Pressable>
    </ScrollView></KeyboardAvoidingView></SafeAreaView></Modal>
  </SafeAreaView>
    {opening && (themeReady
      ? <OpeningAnimation colors={palettes[isDark ? 'dark' : 'light']} onFinish={finishOpening} />
      : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />)}
  </View></SafeAreaProvider>;
}
const createStyles = (colors: typeof palettes.light) => StyleSheet.create({
  themeRow: { flexDirection: 'row', marginTop: 20, padding: 4, borderRadius: 12, backgroundColor: colors.subtle, gap: 4 },
  themeChoice: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: 'transparent' },
  themeSelected: { backgroundColor: colors.surface, borderColor: colors.accent },
  themeText: { fontSize: 13, color: colors.muted },
  page: { flex: 1, backgroundColor: colors.background }, header: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32 }, brand: { fontSize: 38, fontWeight: '600', color: colors.text, letterSpacing: -0.8, marginBottom: 8 }, muted: { color: colors.muted, lineHeight: 22 }, tabs: { flexDirection: 'row', marginHorizontal: 24, gap: 6 }, tab: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', backgroundColor: colors.subtle }, active: { backgroundColor: colors.primary }, count: { color: colors.muted, margin: 24, marginBottom: 12 }, list: { paddingHorizontal: 24, paddingBottom: 20, flexGrow: 1 }, card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 20, marginBottom: 16 }, task: { fontSize: 18, fontWeight: '600', color: colors.text }, meta: { color: colors.muted, marginVertical: 8, fontSize: 13 }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }, link: { padding: 12, minHeight: 44 }, actionText: { color: colors.text, fontWeight: '600' }, empty: { alignItems: 'center', paddingVertical: 60 }, sun: { fontSize: 48, color: colors.accent, marginBottom: 20 }, heading: { fontSize: 25, fontWeight: '600', color: colors.text }, primary: { margin: 24, marginTop: 12, padding: 18, backgroundColor: colors.primary, borderRadius: 12, alignItems: 'center' }, white: { color: colors.onPrimary, fontSize: 17, fontWeight: '600' }, form: { padding: 24 }, label: { color: colors.text, fontWeight: '600', marginTop: 20, marginBottom: 10 }, input: { padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, color: colors.text, fontSize: 16 }, options: { flexDirection: 'row', gap: 8 }, helper: { marginTop: 20, fontSize: 12, color: colors.muted, lineHeight: 18 }, cancel: { alignItems: 'center', padding: 16 },
});

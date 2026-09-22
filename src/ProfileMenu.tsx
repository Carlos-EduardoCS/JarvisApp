import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';

const PROFILE_KEY = 'jarvis.profile.v1';
type ThemeMode = 'light' | 'dark' | 'system';
const themeOptions: { value: ThemeMode; label: string }[] = [{ value: 'light', label: 'Claro' }, { value: 'dark', label: 'Escuro' }, { value: 'system', label: 'Sistema' }];
type Profile = { name: string; photo: string | null };
type Colors = { background: string; surface: string; text: string; muted: string; border: string; accent: string; primary: string; onPrimary: string; danger: string; subtle: string };
const emptyProfile: Profile = { name: '', photo: null };
const validPhoto = (name: unknown): name is string => typeof name === 'string' && /^jarvis-profile-\d+-[a-z0-9]+\.(jpg|jpeg|png|heic|webp)$/.test(name);
function photoUri(photo: string | null) { return photo && validPhoto(photo) ? new File(Paths.document, photo).uri : null; }
function removePhoto(photo: string | null) {
  if (!photo || !validPhoto(photo)) return;
  try { const file = new File(Paths.document, photo); if (file.exists) file.delete(); } catch {}
}

export function ProfileMenu({ visible, onClose, onBackup, colors, dark, themeMode, themeDisabled, onThemeChange }: { visible: boolean; onClose: () => void; onBackup: () => void; colors: Colors; dark: boolean; themeMode: ThemeMode; themeDisabled: boolean; onThemeChange: (mode: ThemeMode) => void }) {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState<'menu' | 'profile'>('menu');
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const nextBackup = useRef(false);
  const c = colors;
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(PROFILE_KEY).then(raw => {
      const data = raw ? JSON.parse(raw) : emptyProfile;
      if (!data || typeof data.name !== 'string' || data.name.length > 60 || (data.photo !== null && !validPhoto(data.photo))) throw new Error('Perfil inválido');
      if (active) { setProfile(data); setLoaded(true); }
    }).catch(() => { if (active) Alert.alert('Não foi possível carregar o perfil', 'Feche e abra o app para tentar novamente.'); });
    return () => { active = false; };
  }, []);
  useEffect(() => { if (visible) { setPage('menu'); nextBackup.current = false; setImageFailed(false); } }, [visible]);
  function editProfile() {
    setName(profile.name); setPhoto(photoUri(profile.photo)); setImageFailed(false); setPage('profile');
  }
  async function choosePhoto() {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.75 });
      if (!result.canceled) {
        if ((result.assets[0].fileSize ?? 0) > 15 * 1024 * 1024) throw new Error('Escolha uma foto de até 15 MB.');
        setPhoto(result.assets[0].uri); setImageFailed(false);
      }
    } catch (error) { Alert.alert('Não foi possível abrir a foto', error instanceof Error ? error.message : 'Tente novamente.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function saveProfile() {
    if (lock.current) return;
    if (!name.trim()) return Alert.alert('Seu nome', 'Digite como você quer aparecer no Jarvis.');
    lock.current = true; setBusy(true);
    let created: string | null = null;
    try {
      let storedPhoto = profile.photo;
      if (!photo) storedPhoto = null;
      else if (photo !== photoUri(profile.photo)) {
        const source = new File(photo);
        if (!source.exists || source.size > 15 * 1024 * 1024) throw new Error('Selecione novamente uma foto de até 15 MB.');
        const extension = source.extension.toLowerCase();
        const safeExtension = ['.jpg', '.jpeg', '.png', '.heic', '.webp'].includes(extension) ? extension : '.jpg';
        created = `jarvis-profile-${Date.now()}-${Math.random().toString(36).slice(2)}${safeExtension}`;
        await source.copy(new File(Paths.document, created));
        storedPhoto = created;
      }
      const next: Profile = { name: name.trim(), photo: storedPhoto };
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next));
      const previousPhoto = profile.photo;
      setProfile(next); setPage('menu'); setImageFailed(false);
      if (previousPhoto !== storedPhoto) removePhoto(previousPhoto);
    } catch (error) {
      removePhoto(created);
      Alert.alert('Não foi possível salvar o perfil', error instanceof Error ? error.message : 'Tente novamente.');
    } finally { lock.current = false; setBusy(false); }
  }
  const shownPhoto = page === 'profile' ? photo : photoUri(profile.photo);
  const shownName = page === 'profile' ? name : profile.name;
  const initials = shownName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'J';
  const avatar = <View style={[styles.avatar, { backgroundColor: c.subtle, borderColor: c.accent }]}>{shownPhoto && !imageFailed ? <Image source={{ uri: shownPhoto }} style={styles.photo} onError={() => setImageFailed(true)} accessibilityLabel="Foto do perfil" /> : <Text style={{ color: c.text, fontSize: 30, fontWeight: '600' }}>{initials}</Text>}</View>;
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={() => !busy && onClose()} onDismiss={() => { if (nextBackup.current) { nextBackup.current = false; onBackup(); } }}>
    <View style={styles.overlay}>
      <Pressable accessibilityRole="button" accessibilityLabel="Fechar menu" disabled={busy} onPress={onClose} style={StyleSheet.absoluteFill} />
      <SafeAreaView accessibilityViewIsModal style={[styles.panel, { backgroundColor: c.background }]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding"><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.top}><Text accessibilityRole="header" style={[styles.heading, { color: c.text }]}>{page === 'profile' ? 'Seu perfil' : 'Menu'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Fechar menu" disabled={busy} onPress={onClose} style={styles.close}><Text style={{ fontSize: 27, color: c.text }}>×</Text></Pressable></View>
          {page === 'menu' ? <>
            <Pressable accessibilityRole="button" accessibilityLabel="Editar nome e foto do perfil" disabled={!loaded} onPress={editProfile} style={[styles.profile, { borderColor: c.border }]}>
              {avatar}<Text numberOfLines={2} style={[styles.name, { color: c.text }]}>{loaded ? profile.name || 'Seu perfil' : 'Carregando…'}</Text><Text style={{ color: c.muted, marginTop: 6 }}>Editar nome e foto</Text>
            </Pressable>
            <View style={{ paddingVertical: 24, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border }}><Text style={[styles.rowTitle, { color: c.text }]}>Aparência</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>{themeOptions.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.value === 'system' ? 'Seguir tema do iPhone' : 'Tema ' + option.label} accessibilityState={{ checked: themeMode === option.value, disabled: themeDisabled }} disabled={themeDisabled} onPress={() => onThemeChange(option.value)} style={{ flexGrow: 1, minHeight: 44, paddingHorizontal: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: themeMode === option.value ? c.accent : c.border, backgroundColor: themeMode === option.value ? c.text : c.subtle }}><Text style={{ color: themeMode === option.value ? c.background : c.text, fontWeight: themeMode === option.value ? '600' : '400' }}>{option.label}</Text></Pressable>)}</View></View>
            <Pressable accessibilityRole="button" style={[styles.row, { borderColor: c.border }]} onPress={() => { nextBackup.current = true; onClose(); }}><View style={{ flex: 1 }}><Text style={[styles.rowTitle, { color: c.text }]}>Backup</Text><Text style={[styles.description, { color: c.muted }]}>Exportar e restaurar suas tarefas</Text></View><Text style={{ color: c.muted, fontSize: 24 }}>›</Text></Pressable>
            <View accessibilityLabel="Assine o Pro. Em breve" accessibilityState={{ disabled: true }} style={[styles.row, { borderColor: c.border }]}><View style={{ flex: 1 }}><Text style={[styles.rowTitle, { color: c.text }]}>Assine o Pro</Text><Text style={[styles.description, { color: c.muted }]}>Em breve</Text></View><Text style={{ color: c.accent, fontSize: 22 }}>✦</Text></View>
          </> : <>
            <View style={styles.profile}>{avatar}<Pressable accessibilityRole="button" disabled={busy} onPress={choosePhoto} style={styles.button}><Text style={{ color: c.text, fontWeight: '600' }}>{busy ? 'Aguarde…' : 'Escolher foto'}</Text></Pressable>{!!photo && <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setPhoto(null); setImageFailed(false); }} style={styles.button}><Text style={{ color: c.danger }}>Remover foto</Text></Pressable>}</View>
            <Text style={{ color: c.text, marginBottom: 10, fontWeight: '600' }}>Seu nome</Text><TextInput accessibilityLabel="Seu nome" value={name} onChangeText={setName} maxLength={60} editable={!busy} autoCapitalize="words" placeholder="Como podemos chamar você?" placeholderTextColor={c.muted} selectionColor={c.text} keyboardAppearance={dark ? 'dark' : 'light'} style={[styles.input, { backgroundColor: c.surface, color: c.text, borderColor: c.border }]} />
            <Pressable accessibilityRole="button" disabled={busy} onPress={saveProfile} style={[styles.save, { backgroundColor: c.primary, opacity: busy ? 0.5 : 1 }]}><Text style={{ color: c.onPrimary, fontWeight: '600', fontSize: 16 }}>Salvar perfil</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={() => { setPage('menu'); setImageFailed(false); }} style={styles.button}><Text style={{ color: c.text }}>Cancelar</Text></Pressable>
          </>}
        </ScrollView></KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'flex-end' }, panel: { flex: 1, width: '88%', maxWidth: 420 }, content: { padding: 24 }, top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, heading: { fontSize: 23, fontWeight: '600' }, close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, profile: { paddingVertical: 28, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth }, avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, photo: { width: '100%', height: '100%' }, name: { fontSize: 21, fontWeight: '600', marginTop: 16, textAlign: 'center' }, row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 24, borderBottomWidth: StyleSheet.hairlineWidth }, rowTitle: { fontSize: 17, fontWeight: '600' }, description: { fontSize: 13, marginTop: 6, lineHeight: 19 }, button: { minHeight: 44, padding: 12, alignItems: 'center', justifyContent: 'center' }, input: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 16 }, save: { padding: 17, borderRadius: 12, alignItems: 'center', marginTop: 24 },
});

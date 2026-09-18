import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { Backup, MAX_BACKUP_BYTES, parseBackup } from './backup';

export async function exportBackupFile(backup: Backup) {
  if (!await Sharing.isAvailableAsync()) throw new Error('O compartilhamento de arquivos não está disponível.');
  const file = new File(Paths.cache, `Jarvis-backup-${backup.createdAt.replace(/[:.]/g, '-')}.json`);
  try {
    file.create({ overwrite: true });
    await file.write(JSON.stringify(backup, null, 2));
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Salvar backup do Jarvis' });
  } finally { if (file.exists) { try { file.delete(); } catch {} } }
}
export async function pickBackupFile(): Promise<Backup | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  try {
    if ((asset.size ?? file.size) > MAX_BACKUP_BYTES) throw new Error('O arquivo ultrapassa o limite de 5 MB.');
    return parseBackup(await file.text());
  } finally { if (file.uri.startsWith(Paths.cache.uri) && file.exists) { try { file.delete(); } catch {} } }
}

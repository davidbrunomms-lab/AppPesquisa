import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import type { LocalFile } from './api';

function extFromMime(mime: string) {
  const sub = mime.split('/')[1] || 'bin';
  if (sub === 'jpeg') return 'jpg';
  if (sub === 'quicktime') return 'mov';
  return sub.replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
}

function toLocalFile(asset: ImagePicker.ImagePickerAsset): LocalFile {
  const mimeType = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
  const name = asset.fileName || `arquivo-${Date.now()}.${extFromMime(mimeType)}`;
  return { uri: asset.uri, name, mimeType, file: (asset as { file?: Blob }).file ?? null };
}

export type PickKind = 'images' | 'videos' | 'all';

/** Abre a galeria. Retorna null se o usuário cancelar ou negar a permissão. */
export async function pickFromLibrary(kind: PickKind = 'images', options: { square?: boolean } = {}): Promise<LocalFile | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permissão necessária', 'Autorize o acesso às fotos nas configurações do aparelho.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: kind === 'all' ? ['images', 'videos'] : [kind],
    quality: 0.8,
    allowsEditing: options.square ?? false,
    aspect: options.square ? [1, 1] : undefined,
  });
  if (result.canceled || !result.assets?.length) return null;
  return toLocalFile(result.assets[0]);
}

/** Abre a câmera para tirar uma foto. */
export async function takePhoto(): Promise<LocalFile | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permissão necessária', 'Autorize o uso da câmera nas configurações do aparelho.');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
  if (result.canceled || !result.assets?.length) return null;
  return toLocalFile(result.assets[0]);
}

/** Seleciona um documento (PDF, Word, Excel, texto). */
export async function pickDocument(): Promise<LocalFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.length) return null;
  const a = result.assets[0];
  return { uri: a.uri, name: a.name, mimeType: a.mimeType || 'application/octet-stream', file: (a as { file?: Blob }).file ?? null };
}

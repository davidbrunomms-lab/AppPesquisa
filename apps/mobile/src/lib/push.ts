import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';
import { localStore } from './storage';

const PUSH_TOKEN_KEY = 'pp.pushToken';

let handlerConfigured = false;

export function configureNotificationHandler() {
  if (handlerConfigured || Platform.OS === 'web') return;
  handlerConfigured = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch {
    // módulo indisponível (ex.: Expo Go sem suporte a push)
  }
}

/**
 * Registra o token nativo (FCM/APNs) do aparelho em POST /account/devices.
 * Ignora web e simuladores; nunca lança erro (push é opcional).
 */
export async function registerForPush(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Geral',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#C6FF3D',
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    const { data } = await Notifications.getDevicePushTokenAsync();
    const token = typeof data === 'string' ? data : JSON.stringify(data);
    await api.post('/account/devices', { token, platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID' });
    await localStore.setJson(PUSH_TOKEN_KEY, token);
    return token;
  } catch (e) {
    if (__DEV__) console.warn('[push] registro ignorado:', (e as Error)?.message);
    return null;
  }
}

/** Remove o token do aparelho no logout. */
export async function unregisterPush() {
  const token = await localStore.getJson<string>(PUSH_TOKEN_KEY);
  if (!token) return;
  try {
    await api.delete(`/account/devices/${encodeURIComponent(token)}`);
  } catch {
    // ignora
  }
  await localStore.remove(PUSH_TOKEN_KEY);
}

import { Alert, Platform } from 'react-native';
import { errorMessage } from './api';

/** Alert.alert não funciona no react-native-web: usamos window.alert/confirm na web. */
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    globalThis.alert?.(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export function notifyError(error: unknown, title = 'Ops!') {
  notify(title, errorMessage(error));
}

export function confirm(
  title: string,
  message: string,
  options: { confirmText?: string; destructive?: boolean } = {},
): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? false);
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      {
        text: options.confirmText ?? 'Confirmar',
        style: options.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

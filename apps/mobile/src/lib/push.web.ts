// Web: push nativo (FCM/APNs) não se aplica — implementações vazias evitam carregar expo-notifications.
export function configureNotificationHandler() {}
export async function registerForPush(): Promise<string | null> {
  return null;
}
export async function unregisterPush() {}

import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { notify } from '@/lib/alert';
import { GOOGLE_CLIENT_IDS } from '@/lib/config';
import { useTheme } from '@/theme';

WebBrowser.maybeCompleteAuthSession();

export interface SocialToken {
  provider: 'GOOGLE' | 'APPLE';
  idToken: string;
  name?: string;
}

const googleConfigured =
  Platform.OS === 'ios'
    ? !!GOOGLE_CLIENT_IDS.ios
    : Platform.OS === 'android'
      ? !!GOOGLE_CLIENT_IDS.android
      : !!GOOGLE_CLIENT_IDS.web;

function GoogleButtonView({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        height: 50,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceElevated,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#4285F4', fontWeight: '900', fontSize: 14 }}>G</Text>
      </View>
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Entrar com Google</Text>
    </Pressable>
  );
}

/** Usa o hook do expo-auth-session somente quando há client ID configurado (o hook exige o ID da plataforma). */
function GoogleAuthButton({ onToken }: { onToken: (t: SocialToken) => void }) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: GOOGLE_CLIENT_IDS.web || undefined,
    iosClientId: GOOGLE_CLIENT_IDS.ios || undefined,
    androidClientId: GOOGLE_CLIENT_IDS.android || undefined,
  });
  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params.id_token || response.authentication?.idToken;
      if (idToken) onToken({ provider: 'GOOGLE', idToken });
      else notify('Login com Google', 'Não foi possível obter o token do Google.');
    } else if (response?.type === 'error') {
      notify('Login com Google', response.error?.message ?? 'Falha na autenticação.');
    }
  }, [response, onToken]);
  return <GoogleButtonView disabled={!request} onPress={() => void promptAsync()} />;
}

function AppleButton({ onToken }: { onToken: (t: SocialToken) => void }) {
  const { scheme } = useTheme();
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAvailable).catch(() => setAvailable(false));
  }, []);
  if (!available) return null;
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={
        scheme === 'dark' ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
      }
      cornerRadius={12}
      style={{ height: 50, width: '100%' }}
      onPress={async () => {
        try {
          const cred = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });
          if (!cred.identityToken) throw new Error('Token da Apple ausente');
          const name = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(' ') || undefined;
          onToken({ provider: 'APPLE', idToken: cred.identityToken, name });
        } catch (e) {
          if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return;
          notify('Entrar com Apple', (e as Error)?.message ?? 'Falha na autenticação.');
        }
      }}
    />
  );
}

export function SocialButtons({ onToken }: { onToken: (t: SocialToken) => void }) {
  return (
    <View style={{ gap: 10 }}>
      {googleConfigured ? (
        <GoogleAuthButton onToken={onToken} />
      ) : (
        <GoogleButtonView
          onPress={() =>
            notify(
              'Login com Google indisponível',
              'Configure EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID / ANDROID / WEB no arquivo .env do app para habilitar.',
            )
          }
        />
      )}
      {Platform.OS === 'ios' ? <AppleButton onToken={onToken} /> : null}
    </View>
  );
}

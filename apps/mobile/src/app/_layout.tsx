import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Logo } from '@/components/Logo';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { configureNotificationHandler } from '@/lib/push';
import { queryClient } from '@/lib/query';
import { useTheme } from '@/theme';

export default function RootLayout() {
  useEffect(() => {
    configureNotificationHandler();
  }, []);
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { status, role } = useAuth();
  const { colors, scheme } = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: colors.background, card: colors.surface, text: colors.text, border: colors.border, primary: colors.accent },
  };
  const signedIn = status === 'signedIn';

  // Enquanto a sessão é restaurada não montamos o navegador: assim os guards não
  // redirecionam deep links (ex.: personalpro://chat/ID) antes de sabermos o perfil.
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Logo size={34} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="convite/[code]" />
        <Stack.Protected guard={status === 'signedOut'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && role === 'STUDENT'}>
          <Stack.Screen name="aluno" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && role === 'TRAINER'}>
          <Stack.Screen name="professor" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && role === 'ADMIN'}>
          <Stack.Screen name="admin" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="chat/[id]" />
          <Stack.Screen name="notificacoes" />
          <Stack.Screen name="exercicio/[id]" />
          <Stack.Screen name="alterar-senha" />
          <Stack.Screen name="comparar" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

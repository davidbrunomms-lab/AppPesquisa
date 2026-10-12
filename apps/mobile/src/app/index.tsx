import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/features/auth/AuthContext';
import { useTheme } from '@/theme';

/** Redireciona automaticamente pelo perfil após o login. */
export default function Index() {
  const { status, role } = useAuth();
  const { colors } = useTheme();
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <Logo size={34} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (status === 'signedOut') return <Redirect href="/login" />;
  if (role === 'TRAINER') return <Redirect href="/professor" />;
  if (role === 'ADMIN') return <Redirect href="/admin" />;
  return <Redirect href="/aluno" />;
}

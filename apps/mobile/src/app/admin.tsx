import { Linking } from 'react-native';
import { Icon } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { Button, Card, Screen, Spacer, T } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { useTheme } from '@/theme';

const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:3000').replace(/\/+$/, '');

export default function AdminScreen() {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  return (
    <Screen>
      <Spacer size={40} />
      <Logo size={30} />
      <Spacer size={32} />
      <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 32 }}>
        <Icon name="shield" size={40} color={colors.accent} />
        <T variant="h2" center>
          Olá, {user?.name?.split(' ')[0]}
        </T>
        <T tone="secondary" center>
          O painel administrativo (métricas, usuários, planos e assinaturas) está disponível na versão web do PersonalPro.
        </T>
        <Button title="Abrir painel web" icon="external-link" onPress={() => Linking.openURL(`${WEB_URL}/admin`)} />
      </Card>
      <Spacer />
      <Button title="Sair" variant="secondary" icon="logout" onPress={logout} />
    </Screen>
  );
}

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { Button, Card, Input, Screen, Spacer, T } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useTheme } from '@/theme';

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Informe um e-mail válido.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() }, { auth: false });
      setSent(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Esqueci minha senha" back>
      {sent ? (
        <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 32 }}>
          <Icon name="mail" size={40} color={colors.accent} />
          <T variant="h3" center>
            Verifique seu e-mail
          </T>
          <T tone="secondary" center>
            Se existir uma conta para {email.trim()}, você receberá um link para criar uma nova senha.
          </T>
        </Card>
      ) : (
        <>
          <T tone="secondary">Informe o e-mail da sua conta. Enviaremos um link para você redefinir a senha.</T>
          <Spacer size={20} />
          <Input
            label="E-mail"
            icon="mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="voce@email.com"
            error={error}
          />
          <Button title="Enviar link" onPress={submit} loading={loading} />
        </>
      )}
    </Screen>
  );
}

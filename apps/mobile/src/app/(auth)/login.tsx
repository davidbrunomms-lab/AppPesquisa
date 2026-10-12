import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { Logo } from '@/components/Logo';
import { Button, Divider, Input, Row, Screen, Spacer, T } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { SocialButtons } from '@/features/auth/SocialButtons';
import { useSocialAuth } from '@/features/auth/useSocialAuth';
import { errorMessage } from '@/lib/api';

export default function LoginScreen() {
  const { login } = useAuth();
  const social = useSocialAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Informe e-mail e senha.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.replace('/');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <Spacer size={48} />
        <Logo size={32} />
        <T tone="secondary" center style={{ marginTop: 12 }}>
          Seu treino, sua evolução, seu personal — em um só lugar.
        </T>
        <Spacer size={40} />
        <T variant="h1">Entrar</T>
        <Spacer size={20} />
        <Input
          label="E-mail"
          icon="mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="voce@email.com"
          textContentType="emailAddress"
        />
        <Input
          label="Senha"
          icon="lock"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          placeholder="Sua senha"
          onSubmitEditing={submit}
          returnKeyType="go"
        />
        <Link href="/esqueci-senha" asChild>
          <Pressable style={{ alignSelf: 'flex-end', marginBottom: 20 }} hitSlop={8}>
            <T variant="small" tone="accent" style={{ fontWeight: '700' }}>
              Esqueci minha senha
            </T>
          </Pressable>
        </Link>
        {error ? (
          <T tone="danger" style={{ marginBottom: 12 }}>
            {error}
          </T>
        ) : null}
        <Button title="ENTRAR" size="lg" onPress={submit} loading={loading} />
        <Row style={{ marginVertical: 24 }}>
          <Divider style={{ flex: 1 }} />
          <T variant="small" tone="muted">
            ou
          </T>
          <Divider style={{ flex: 1 }} />
        </Row>
        <SocialButtons onToken={social.onToken} />
        <Spacer size={32} />
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          <T tone="secondary">Primeiro acesso?</T>
          <Link href="/cadastro" asChild>
            <Pressable hitSlop={8}>
              <T tone="accent" style={{ fontWeight: '800' }}>
                Criar conta
              </T>
            </Pressable>
          </Link>
        </View>
      </Screen>
      {social.sheet}
    </KeyboardAvoidingView>
  );
}

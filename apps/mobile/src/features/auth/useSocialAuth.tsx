import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, View } from 'react-native';
import { Sheet } from '@/components/Sheet';
import { Button, Checkbox, Chips, Input, T } from '@/components/ui';
import { notify, notifyError } from '@/lib/alert';
import { ApiError } from '@/lib/api';
import { PRIVACY_URL, TERMS_URL } from '@/lib/config';
import { pendingInvite, useAuth } from './AuthContext';
import type { SocialToken } from './SocialButtons';

/**
 * Login social: envia o ID token para POST /auth/social. No primeiro acesso a API responde
 * 422 ROLE_REQUIRED — abrimos uma folha perguntando Aluno/Professor e o aceite dos termos.
 */
export function useSocialAuth() {
  const { socialLogin } = useAuth();
  const [pending, setPending] = useState<SocialToken | null>(null);
  const [role, setRole] = useState<'STUDENT' | 'TRAINER'>('STUDENT');
  const [inviteCode, setInviteCode] = useState('');
  const [accept, setAccept] = useState(false);
  const [loading, setLoading] = useState(false);

  const onToken = useCallback(
    async (token: SocialToken) => {
      try {
        setLoading(true);
        await socialLogin({ provider: token.provider, idToken: token.idToken });
        router.replace('/');
      } catch (e) {
        if (e instanceof ApiError && e.code === 'ROLE_REQUIRED') {
          setInviteCode((await pendingInvite.get()) ?? '');
          setPending(token);
        } else notifyError(e, 'Não foi possível entrar');
      } finally {
        setLoading(false);
      }
    },
    [socialLogin],
  );

  const complete = async () => {
    if (!pending) return;
    if (!accept) {
      notify('Termos de uso', 'Para continuar, aceite os Termos de Uso e a Política de Privacidade.');
      return;
    }
    try {
      setLoading(true);
      const res = await socialLogin({
        provider: pending.provider,
        idToken: pending.idToken,
        name: pending.name,
        role,
        acceptTerms: true,
        inviteCode: role === 'STUDENT' && inviteCode.trim() ? inviteCode.trim().toUpperCase() : undefined,
      });
      await pendingInvite.clear();
      setPending(null);
      if (res.linkError) notify('Conta criada', `Não foi possível vincular ao professor: ${res.linkError}`);
      router.replace('/');
    } catch (e) {
      notifyError(e, 'Não foi possível criar a conta');
    } finally {
      setLoading(false);
    }
  };

  const sheet = (
    <Sheet visible={!!pending} onClose={() => setPending(null)} title="Primeiro acesso">
      <T tone="secondary" style={{ marginBottom: 16 }}>
        Conte pra gente como você vai usar o PersonalPro.
      </T>
      <Chips
        label="Eu sou"
        options={[
          { value: 'STUDENT', label: 'Aluno' },
          { value: 'TRAINER', label: 'Professor' },
        ]}
        value={role}
        onChange={(v) => v && setRole(v)}
      />
      {role === 'STUDENT' ? (
        <Input
          label="Código do professor (opcional)"
          value={inviteCode}
          onChangeText={setInviteCode}
          autoCapitalize="characters"
          placeholder="Ex.: DEMO01"
        />
      ) : null}
      <Checkbox checked={accept} onChange={setAccept}>
        <T variant="small" tone="secondary">
          Li e aceito os{' '}
          <T variant="small" tone="accent" onPress={() => Linking.openURL(TERMS_URL)}>
            Termos de Uso
          </T>{' '}
          e a{' '}
          <T variant="small" tone="accent" onPress={() => Linking.openURL(PRIVACY_URL)}>
            Política de Privacidade
          </T>
          .
        </T>
      </Checkbox>
      <View style={{ height: 8 }} />
      <Button title="Continuar" onPress={complete} loading={loading} />
    </Sheet>
  );

  return { onToken, sheet, loading };
}

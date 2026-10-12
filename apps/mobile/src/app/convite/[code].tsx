import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/Logo';
import { Button, Card, Loading, Screen, Spacer, T } from '@/components/ui';
import { pendingInvite, useAuth } from '@/features/auth/AuthContext';
import { acceptInvite } from '@/features/student/LinkTrainerCard';
import { errorMessage } from '@/lib/api';
import { queryClient } from '@/lib/query';

/** Deep link personalpro://convite/CODE */
export default function InviteDeepLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { status, role } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!code || status === 'loading') return;
    const upper = code.toUpperCase();
    if (status === 'signedOut') {
      void pendingInvite.set(upper);
      router.replace({ pathname: '/cadastro', params: { invite: upper } });
      return;
    }
    if (role !== 'STUDENT') {
      setError(true);
      setMessage('Convites de professor são para contas de aluno.');
      return;
    }
    acceptInvite(upper)
      .then(() => {
        void queryClient.invalidateQueries();
        setMessage('Pronto! Você foi vinculado ao seu professor.');
      })
      .catch((e) => {
        setError(true);
        setMessage(errorMessage(e));
      });
  }, [code, status, role]);

  return (
    <Screen>
      <Spacer size={60} />
      <Logo />
      <Spacer size={32} />
      {message ? (
        <Card style={{ gap: 16 }}>
          <T variant="h3" center tone={error ? 'danger' : 'default'}>
            {message}
          </T>
          <Button title="Continuar" onPress={() => router.replace('/')} />
        </Card>
      ) : (
        <Loading label="Processando convite…" />
      )}
    </Screen>
  );
}
